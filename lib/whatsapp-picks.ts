import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import {
  getCachedUpcomingMatches,
  setCachedUpcomingMatches,
} from "@/lib/whatsapp-market-cache";
import {
  fetchUpcomingMatchesFromMarket,
  extractMatchIds,
  normalizeMarketMatch,
} from "@/lib/whatsapp-market-fetcher";

/**
 * WhatsApp Pick - Formatted pick data for WhatsApp display
 * Enhanced with Market API data (dates, odds, model predictions)
 */
export interface WhatsAppPick {
  matchId: string;
  quickPurchaseId?: string; // Optional - only if QuickPurchase exists
  name: string;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  kickoffDate?: string; // From Market API
  market?: string; // Optional - from QuickPurchase or Market API
  tip?: string; // Optional - from QuickPurchase or Market API
  confidence?: number; // 0-100, optional - from QuickPurchase or Market API
  price?: number; // Optional - only if QuickPurchase exists
  currency?: string; // Optional - only if QuickPurchase exists
  odds?: number; // From QuickPurchase (legacy) or Market API
  valueRating?: string;
  // Enhanced Market API data
  consensusOdds?: {
    home: number;
    draw: number;
    away: number;
  };
  isConsensusOdds?: boolean; // True if from novig_current (Market API consensus), false if single bookmaker
  primaryBook?: string;
  booksCount?: number;
  modelPredictions?: {
    free?: { side: string; confidence: number };
    premium?: { side: string; confidence: number };
  };
  isPurchasable?: boolean; // True if QuickPurchase exists
}

/**
 * Get today's active picks - same data as homepage (all Market API matches)
 * 1. Fetch all Market API matches (with Redis cache) - same as homepage
 * 2. Optionally enhance with QuickPurchase data (price, confidence) if available
 * 3. Return all Market API matches, even if QuickPurchase doesn't exist
 */
/**
 * Get today's picks for WhatsApp
 * Limited to 10 picks to stay within WhatsApp's 4096 character limit
 */
export async function getTodaysPicks(): Promise<WhatsAppPick[]> {
  try {
    // Step 1: Fetch Market API data (with cache) - same as homepage
    let marketMatches: any[] = [];
    let marketDataMap = new Map<string, ReturnType<typeof normalizeMarketMatch>>();

    try {
      // Check cache first
      const cached = await getCachedUpcomingMatches();
      
      if (cached && cached.matches.length > 0) {
        marketMatches = cached.matches;
        logger.debug("Using cached Market API data", {
          tags: ["whatsapp", "picks", "cache"],
          data: { matchCount: marketMatches.length },
        });
      } else {
        // Fetch from Market API
        const marketResponse = await fetchUpcomingMatchesFromMarket(50);
        
        if (marketResponse.matches.length > 0 && !marketResponse.error) {
          marketMatches = marketResponse.matches;
          
          // Cache the result
          await setCachedUpcomingMatches({
            matches: marketMatches,
            total_count: marketResponse.total_count,
          });
          
          logger.info("Fetched Market API data and cached", {
            tags: ["whatsapp", "picks", "market"],
            data: { matchCount: marketMatches.length },
          });
        } else {
          logger.warn("Market API returned no matches or error", {
            tags: ["whatsapp", "picks", "market"],
            data: { error: marketResponse.error },
          });
        }
      }

      // Normalize Market API matches (skip invalid matches)
      let skippedCount = 0;
      for (const match of marketMatches) {
        const normalized = normalizeMarketMatch(match);
        if (normalized) {
          marketDataMap.set(normalized.id, normalized);
        } else {
          skippedCount++;
        }
      }

      if (skippedCount > 0) {
        logger.warn("Skipped matches due to missing/invalid IDs", {
          tags: ["whatsapp", "picks", "normalize"],
          data: { skippedCount, totalMatches: marketMatches.length },
        });
      }
    } catch (error) {
      logger.warn("Error fetching Market API data, falling back to QuickPurchase-only", {
        tags: ["whatsapp", "picks", "market", "error"],
        error: error instanceof Error ? error : undefined,
      });
      
      // If Market API fails, fallback to QuickPurchase-only
      return getQuickPurchaseOnlyPicks();
    }

    // If no Market API matches, fallback to QuickPurchase-only
    if (marketDataMap.size === 0) {
      logger.warn("No Market API matches found, using QuickPurchase-only fallback", {
        tags: ["whatsapp", "picks", "fallback"],
      });
      return getQuickPurchaseOnlyPicks();
    }

    // Step 2: Optionally fetch QuickPurchase data for enhancement (not required)
    const matchIds = Array.from(marketDataMap.keys());
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        type: "prediction",
        isActive: true,
        isPredictionActive: true,
        matchId: { in: matchIds },
      },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true,
          },
        },
      },
      orderBy: {
        confidenceScore: "desc",
      },
      take: 100, // Get all that match
    });

    // Create a map of QuickPurchase data by matchId for quick lookup
    const quickPurchaseMap = new Map<string, typeof quickPurchases[0]>();
    for (const qp of quickPurchases) {
      if (qp.matchId) {
        quickPurchaseMap.set(qp.matchId, qp);
      }
    }

    // Step 3: Build picks from ALL Market API matches (same as homepage)
    const picks: WhatsAppPick[] = [];

    for (const [matchId, marketData] of marketDataMap.entries()) {
      // Skip if marketData is null or matchId is invalid
      if (!marketData) {
        logger.warn("Skipping null market data entry", { matchId });
        continue;
      }
      
      if (!matchId || matchId.trim() === "" || matchId === "undefined" || matchId === "null") {
        logger.warn("Skipping match with invalid matchId", { 
          matchId, 
          marketDataKeys: Object.keys(marketData),
        });
        continue;
      }

      const qp = quickPurchaseMap.get(matchId);
      
      // Extract match name from Market API or QuickPurchase
      const name = qp?.name || `${marketData.homeTeam} vs ${marketData.awayTeam}`;
      
      // Extract prediction data from QuickPurchase if available
      const predictionData = qp?.predictionData as
        | {
            prediction?: string;
            market?: string;
            tip?: string;
            analysis?: string;
          }
        | null;

      // Build pick with Market API as primary, QuickPurchase as enhancement
      const pick: WhatsAppPick = {
        matchId: matchId, // Ensure matchId is always set
        name,
        homeTeam: marketData.homeTeam,
        awayTeam: marketData.awayTeam,
        league: marketData.league,
        kickoffDate: marketData.kickoffDate,
        // Market API data (always available)
        consensusOdds: marketData.odds?.consensus,
        isConsensusOdds: marketData.odds?.isConsensus, // True if novig_current, false if single bookmaker
        primaryBook: marketData.odds?.primaryBook,
        booksCount: marketData.odds?.booksCount,
        modelPredictions: marketData.modelPredictions,
        // QuickPurchase data (optional enhancement)
        isPurchasable: !!qp,
      };

      // Add QuickPurchase data if available
      if (qp) {
        pick.quickPurchaseId = qp.id;
        pick.market = predictionData?.market || qp.predictionType || "1X2";
        pick.tip = predictionData?.tip || predictionData?.prediction || qp.predictionType || "Win";
        pick.confidence = qp.confidenceScore || undefined;
        pick.price = Number(qp.price);
        pick.currency = qp.country.currencyCode || "USD";
        pick.odds = qp.odds ? Number(qp.odds) : undefined;
        pick.valueRating = qp.valueRating || undefined;
      } else {
        // Use Market API model predictions for tip/confidence if available
        if (marketData.modelPredictions?.premium) {
          pick.tip = marketData.modelPredictions.premium.side;
          pick.confidence = marketData.modelPredictions.premium.confidence;
        } else if (marketData.modelPredictions?.free) {
          pick.tip = marketData.modelPredictions.free.side;
          pick.confidence = marketData.modelPredictions.free.confidence;
        }
      }

      picks.push(pick);
    }

    // Step 4: Sort by kickoff date (upcoming first) - same as homepage
    const sortedPicks = picks.sort((a, b) => {
      if (a.kickoffDate && b.kickoffDate) {
        return new Date(a.kickoffDate).getTime() - new Date(b.kickoffDate).getTime();
      }
      if (a.kickoffDate) return -1;
      if (b.kickoffDate) return 1;
      return 0;
    });

    // Filter out picks with invalid matchIds before logging
    const validPicks = sortedPicks.filter(p => p.matchId && p.matchId.trim() !== "");
    
    logger.info("Fetched today's picks for WhatsApp (same as homepage)", {
      tags: ["whatsapp", "picks"],
      data: {
        totalPicks: sortedPicks.length,
        validPicks: validPicks.length,
        marketApiMatches: marketDataMap.size,
        rawMarketMatches: marketMatches.length,
        quickPurchaseMatches: quickPurchases.length,
        purchasableMatches: sortedPicks.filter(p => p.isPurchasable).length,
        firstMatchId: validPicks[0]?.matchId || sortedPicks[0]?.matchId || "N/A",
        sampleMatchIds: validPicks.slice(0, 5).map(p => p.matchId),
        invalidMatchIds: sortedPicks.filter(p => !p.matchId || p.matchId.trim() === "").length,
        // Log first raw match structure for debugging
        firstRawMatch: marketMatches[0] ? {
          keys: Object.keys(marketMatches[0]),
          hasId: !!marketMatches[0].id,
          hasMatchId: !!marketMatches[0].matchId,
          idValue: marketMatches[0].id,
          matchIdValue: marketMatches[0].matchId,
        } : null,
      },
    });
    
    // Return only valid picks (with matchIds), limited to 10 for WhatsApp character limit
    return validPicks.slice(0, 10);
  } catch (error) {
    logger.error("Error fetching today's picks", {
      tags: ["whatsapp", "picks", "error"],
      error: error instanceof Error ? error : undefined,
    });
    
    // Final fallback: QuickPurchase-only
    return getQuickPurchaseOnlyPicks();
  }
}

/**
 * Fallback: Get picks from QuickPurchase only (no Market API)
 */
async function getQuickPurchaseOnlyPicks(): Promise<WhatsAppPick[]> {
  try {
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        type: "prediction",
        isActive: true,
        isPredictionActive: true,
        matchId: { not: null },
        predictionData: { not: Prisma.JsonNull },
      },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true,
          },
        },
      },
      orderBy: {
        confidenceScore: "desc",
      },
      take: 20,
    });

    const picks: WhatsAppPick[] = [];

    for (const qp of quickPurchases) {
      if (!qp.matchId) continue;

      const matchData = qp.matchData as
        | {
            homeTeam?: { name?: string };
            awayTeam?: { name?: string };
            league?: { name?: string };
          }
        | null;

      const predictionData = qp.predictionData as
        | {
            prediction?: string;
            market?: string;
            tip?: string;
          }
        | null;

      const homeTeam =
        matchData?.homeTeam?.name || qp.name.split(" vs ")[0] || "Team A";
      const awayTeam =
        matchData?.awayTeam?.name || qp.name.split(" vs ")[1] || "Team B";
      const league = matchData?.league?.name;
      const market = predictionData?.market || qp.predictionType || "1X2";
      const tip =
        predictionData?.tip ||
        predictionData?.prediction ||
        qp.predictionType ||
        "Win";

      picks.push({
        matchId: qp.matchId,
        quickPurchaseId: qp.id,
        name: qp.name,
        homeTeam,
        awayTeam,
        league,
        market,
        tip,
        confidence: qp.confidenceScore || 75,
        price: Number(qp.price),
        currency: qp.country.currencyCode || "USD",
        odds: qp.odds ? Number(qp.odds) : undefined,
        valueRating: qp.valueRating || undefined,
      });
    }

    logger.info("Fetched picks from QuickPurchase-only (fallback)", {
      tags: ["whatsapp", "picks", "fallback"],
      data: { count: picks.length },
    });

    return picks;
  } catch (error) {
    logger.error("Error in QuickPurchase-only fallback", {
      tags: ["whatsapp", "picks", "fallback", "error"],
      error: error instanceof Error ? error : undefined,
    });
    return [];
  }
}

/**
 * Get a specific pick by matchId
 * Tries QuickPurchase first, then falls back to Market API
 */
export async function getPickByMatchId(
  matchId: string
): Promise<WhatsAppPick | null> {
  try {
    // First try QuickPurchase
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true,
          },
        },
      },
    });

    if (quickPurchase) {
      // Extract match data from JSON
      const matchData = quickPurchase.matchData as
        | {
            homeTeam?: { name?: string };
            awayTeam?: { name?: string };
            league?: { name?: string };
          }
        | null;

      // Extract prediction data from JSON
      const predictionData = quickPurchase.predictionData as
        | {
            prediction?: string;
            market?: string;
            tip?: string;
            analysis?: string;
          }
        | null;

      const homeTeam =
        matchData?.homeTeam?.name ||
        quickPurchase.name.split(" vs ")[0] ||
        "Team A";
      const awayTeam =
        matchData?.awayTeam?.name ||
        quickPurchase.name.split(" vs ")[1] ||
        "Team B";
      const market = predictionData?.market || quickPurchase.predictionType || "1X2";
      const tip =
        predictionData?.tip ||
        predictionData?.prediction ||
        quickPurchase.predictionType ||
        "Win";

      return {
        matchId: quickPurchase.matchId!,
        quickPurchaseId: quickPurchase.id,
        name: quickPurchase.name,
        homeTeam,
        awayTeam,
        market,
        tip,
        confidence: quickPurchase.confidenceScore || 75,
        price: Number(quickPurchase.price),
        currency: quickPurchase.country.currencyCode || "USD",
        odds: quickPurchase.odds ? Number(quickPurchase.odds) : undefined,
        valueRating: quickPurchase.valueRating || undefined,
        isPurchasable: true,
      };
    }

    // If no QuickPurchase, try Market API
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/market?match_id=${matchId}&include_v2=false`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        next: {
          revalidate: 0,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          matches?: any[];
        };

        if (data.matches && data.matches.length > 0) {
          const match = data.matches[0];
          const normalized = normalizeMarketMatch(match);
          
          // If normalization failed, return null
          if (!normalized) {
            logger.warn("Failed to normalize match from Market API", { matchId });
            return null;
          }
          
          if (!normalized.id) {
            logger.warn("Normalized match missing ID", { matchId });
            return null;
          }

          return {
            matchId: normalized.id, // Use normalized.id, not the input matchId
            name: `${normalized.homeTeam} vs ${normalized.awayTeam}`,
            homeTeam: normalized.homeTeam,
            awayTeam: normalized.awayTeam,
            league: normalized.league,
            kickoffDate: normalized.kickoffDate,
            consensusOdds: normalized.odds?.consensus,
            isConsensusOdds: normalized.odds?.isConsensus, // True if novig_current, false if single bookmaker
            primaryBook: normalized.odds?.primaryBook,
            booksCount: normalized.odds?.booksCount,
            modelPredictions: normalized.modelPredictions,
            tip: normalized.modelPredictions?.premium?.side || normalized.modelPredictions?.free?.side,
            confidence: normalized.modelPredictions?.premium?.confidence || normalized.modelPredictions?.free?.confidence,
            isPurchasable: false,
          };
        }
      }
    } catch (marketError) {
      logger.warn("Error fetching from Market API for matchId", {
        matchId,
        error: marketError instanceof Error ? marketError : undefined,
      });
    }

    return null;
  } catch (error) {
    logger.error("Error fetching pick by matchId", { matchId, error });
    return null;
  }
}

/**
 * Format pick for WhatsApp message display
 * New action-driving format with cleaner layout and better visual hierarchy
 */
/**
 * Format a single pick for WhatsApp (compact version to stay under character limit)
 */
export function formatPickForWhatsApp(pick: WhatsAppPick, index?: number): string {
  const lines: string[] = [];
  
  // Ensure matchId is always displayed
  const displayMatchId = pick.matchId && pick.matchId.trim() !== "" ? pick.matchId : "N/A";
  
  // Numbered format: "1) Team vs Team"
  const numberPrefix = index !== undefined ? `${index + 1})` : "";
  lines.push(`${numberPrefix} ${pick.homeTeam} vs ${pick.awayTeam}`);
  lines.push("");
  
  // Match ID with 🆔 emoji
  lines.push(`🆔 ${displayMatchId}`);
  
  // Date formatting: "Dec 2 – 9:38 AM EST" (optional)
  if (pick.kickoffDate) {
    try {
      const date = new Date(pick.kickoffDate);
      const month = date.toLocaleDateString("en-US", { month: "short" });
      const day = date.getDate();
      const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const timezone = "EST"; // You can make this dynamic if needed
      lines.push(`📅 ${month} ${day} – ${time} ${timezone}`);
    } catch {
      // If date parsing fails, skip date line
    }
  }
  
  // League on its own line (optional)
  if (pick.league) {
    lines.push(`🏆 ${pick.league}`);
  }
  
  // Pick/Tip
  let pickText = "";
  if (pick.tip) {
    const tipLower = pick.tip.toLowerCase();
    if (tipLower.includes("no bet") || tipLower.includes("info only") || tipLower.includes("skip")) {
      pickText = "No Bet (Info Only)";
    } else if (tipLower.includes("home") || tipLower === "1") {
      pickText = "Home Win";
    } else if (tipLower.includes("away") || tipLower === "2") {
      pickText = "Away Win";
    } else if (tipLower.includes("draw") || tipLower === "x") {
      pickText = "Draw";
    } else {
      pickText = pick.tip;
    }
  } else if (pick.modelPredictions?.premium) {
    const pred = pick.modelPredictions.premium;
    pickText = pred.side === "home" ? "Home Win" : pred.side === "away" ? "Away Win" : "Draw";
  } else if (pick.modelPredictions?.free) {
    const pred = pick.modelPredictions.free;
    pickText = pred.side === "home" ? "Home Win" : pred.side === "away" ? "Away Win" : "Draw";
  }
  
  if (pickText) {
    lines.push(`📊 Pick: ${pickText}`);
  }
  
  // Confidence and Value on one line
  let confidenceText = "";
  if (pick.confidence !== undefined) {
    confidenceText = `${Math.round(pick.confidence)}%`;
  } else if (pick.modelPredictions?.premium) {
    confidenceText = `${Math.round(pick.modelPredictions.premium.confidence)}%`;
  } else if (pick.modelPredictions?.free) {
    confidenceText = `${Math.round(pick.modelPredictions.free.confidence)}%`;
  }
  
  let valueText = "";
  if (pick.valueRating) {
    const valueLower = pick.valueRating.toLowerCase();
    if (valueLower.includes("high") || valueLower.includes("very")) {
      valueText = pick.confidence && pick.confidence >= 60 ? "VERY HIGH" : "High";
    } else if (valueLower.includes("medium")) {
      valueText = "Medium";
    } else if (valueLower.includes("low")) {
      valueText = "Low";
    }
  } else if (pick.confidence !== undefined) {
    if (pick.confidence >= 60) valueText = "VERY HIGH";
    else if (pick.confidence >= 40) valueText = "High";
    else if (pick.confidence >= 25) valueText = "Medium";
    else valueText = "Low";
  }
  
  if (confidenceText && valueText) {
    lines.push(`💡 Confidence: ${confidenceText} | ⭐ Value: ${valueText}`);
  } else if (confidenceText) {
    lines.push(`💡 Confidence: ${confidenceText}`);
  } else if (valueText) {
    lines.push(`⭐ Value: ${valueText}`);
  }
  
  // Compact odds format: "🔢 H: 2.89 | D: 3.08 | A: 2.45"
  if (pick.consensusOdds && pick.consensusOdds.home > 0 && pick.consensusOdds.draw > 0 && pick.consensusOdds.away > 0) {
    const odds = pick.consensusOdds;
    lines.push(`🔢 H: ${odds.home.toFixed(2)} | D: ${odds.draw.toFixed(2)} | A: ${odds.away.toFixed(2)}`);
  }
  
  // Call to action
  if (pick.isPurchasable) {
    lines.push(`👉 Reply: ${displayMatchId}`);
  }
  
  return lines.join("\n");
}

/**
 * Format multiple picks for WhatsApp message
 */
export function formatPicksList(picks: WhatsAppPick[], limit: number = 10): string {
  if (picks.length === 0) {
    return "No picks available for today yet. Check back later 🔄";
  }

  // Filter valid picks and limit to 10 to stay within WhatsApp's 4096 character limit
  const validPicks = picks
    .filter(p => p.matchId && p.matchId.trim() !== "")
    .slice(0, limit);

  if (validPicks.length === 0) {
    return "No valid picks available for today yet. Check back later 🔄";
  }

  const lines: string[] = [];
  
  // Header with tagline and website
  lines.push("🔥 TODAY'S TOP PICKS");
  lines.push("");
  lines.push("Smart AI predictions. Get your tips instantly.");
  lines.push("");
  lines.push("🌐 More details & live matches: https://www.snapbet.bet");
  lines.push("");

  // Format each pick with border separator
  validPicks.forEach((pick, idx) => {
    lines.push(formatPickForWhatsApp(pick, idx));
    if (idx < validPicks.length - 1) {
      lines.push(""); // Border/separator between picks
    }
  });

  // Footer with instructions
  lines.push("");
  lines.push("");
  lines.push("💰 To get a pick:");
  lines.push("");
  lines.push("Reply with the Match ID (Example: " + (validPicks[0]?.matchId || "123456") + ")");
  lines.push("");
  lines.push("📌 Extra Options");
  lines.push("");
  lines.push("Reply HELP — How SnapBet works");
  lines.push("");
  lines.push("To get more matches visit 🌐 https://www.snapbet.bet");

  return lines.join("\n");
}
