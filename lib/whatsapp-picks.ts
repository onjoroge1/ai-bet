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
    
    // Return only valid picks (with matchIds)
    return validPicks;

    return sortedPicks;
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
 * Enhanced format with dates, odds, and model predictions
 * Handles optional fields gracefully (matches without QuickPurchase)
 */
export function formatPickForWhatsApp(pick: WhatsAppPick, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}) ` : "";
  
  const lines: string[] = [];
  // Ensure matchId is always displayed (use fallback if missing)
  const displayMatchId = pick.matchId && pick.matchId.trim() !== "" ? pick.matchId : "N/A";
  lines.push(`${prefix}Match ID: ${displayMatchId}`);
  lines.push(`   ${pick.homeTeam} vs ${pick.awayTeam}`);
  
  // Add date if available (from Market API)
  if (pick.kickoffDate) {
    try {
      const date = new Date(pick.kickoffDate);
      const formattedDate = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
      lines.push(`   📅 ${formattedDate}`);
    } catch (e) {
      // Invalid date, skip
    }
  }
  
  // Add league if available
  if (pick.league) {
    lines.push(`   🏆 ${pick.league}`);
  }
  
  // Add market and tip if available
  if (pick.market) {
    lines.push(`   📊 Market: ${pick.market}`);
  }
  if (pick.tip) {
    lines.push(`   💡 Tip: ${pick.tip}`);
  }
  
  // Add confidence if available
  if (pick.confidence !== undefined) {
    const confidencePct = Math.round(pick.confidence);
    lines.push(`   📈 Confidence: ${confidencePct}%`);
  }
  
  // Add price if available (only if purchasable)
  if (pick.price !== undefined && pick.currency) {
    const currencySymbol = pick.currency === "USD" ? "$" : pick.currency;
    lines.push(`   💰 Price: ${currencySymbol}${pick.price.toFixed(2)}`);
  } else if (!pick.isPurchasable) {
    lines.push(`   ⏳ Purchase: Coming soon`);
  }
  
  // Add consensus odds if available (from Market API)
  if (pick.consensusOdds) {
    const odds = pick.consensusOdds;
    lines.push(`   📊 Odds: Home ${odds.home.toFixed(2)} | Draw ${odds.draw.toFixed(2)} | Away ${odds.away.toFixed(2)}`);
  } else if (pick.odds) {
    // Fallback to single odds from QuickPurchase
    lines.push(`   📊 Odds: ${pick.odds.toFixed(2)}`);
  }
  
  // Add bookmakers count if available
  if (pick.booksCount) {
    const bookText = pick.booksCount === 1 ? "bookmaker" : "bookmakers";
    lines.push(`   📚 ${pick.booksCount} ${bookText}`);
    if (pick.primaryBook) {
      lines.push(`   📚 Primary: ${pick.primaryBook}`);
    }
  }
  
  // Add model predictions if available (from Market API)
  if (pick.modelPredictions) {
    if (pick.modelPredictions.premium) {
      const pred = pick.modelPredictions.premium;
      const sideText = pred.side === "home" ? "Home Win" : pred.side === "away" ? "Away Win" : "Draw";
      lines.push(`   🤖 Model: ${sideText} (${Math.round(pred.confidence)}%)`);
    } else if (pick.modelPredictions.free) {
      const pred = pick.modelPredictions.free;
      const sideText = pred.side === "home" ? "Home Win" : pred.side === "away" ? "Away Win" : "Draw";
      lines.push(`   🤖 Model: ${sideText} (${Math.round(pred.confidence)}%)`);
    }
  }
  
  // Add value rating if available
  if (pick.valueRating) {
    lines.push(`   ⭐ Value: ${pick.valueRating}`);
  }

  return lines.join("\n");
}

/**
 * Format multiple picks for WhatsApp message
 */
export function formatPicksList(picks: WhatsAppPick[]): string {
  if (picks.length === 0) {
    return "No picks available for today yet. Check back later 🔄";
  }

  const lines: string[] = [];
  lines.push("Here are today's picks 🔥", "");

  picks.forEach((pick, idx) => {
    // Only include picks with valid matchId
    if (pick.matchId && pick.matchId.trim() !== "") {
      lines.push(formatPickForWhatsApp(pick, idx));
      lines.push(""); // Empty line between picks
    }
  });

  // Find first valid matchId for example (filter out empty/invalid)
  const validPicks = picks.filter(p => p.matchId && p.matchId.trim() !== "");
  const examplePick = validPicks[0];
  const exampleMatchId = examplePick?.matchId || (picks[0]?.matchId || "N/A");

  lines.push("To buy a pick, send the matchId directly:");
  lines.push("");
  lines.push("Example:");
  if (exampleMatchId && exampleMatchId !== "N/A") {
    lines.push(exampleMatchId);
  } else {
    lines.push("(No valid matchId available)");
  }

  return lines.join("\n");
}
