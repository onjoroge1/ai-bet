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
  quickPurchaseId: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  kickoffDate?: string; // From Market API
  market: string;
  tip: string;
  confidence: number; // 0-100
  price: number;
  currency: string;
  odds?: number; // From QuickPurchase (legacy)
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
}

/**
 * Get today's active picks using hybrid approach:
 * 1. Try Market API (with Redis cache) - get all upcoming matches
 * 2. Join with QuickPurchase - get confidence, price, prediction data
 * 3. Fallback to QuickPurchase-only if Market API fails
 */
export async function getTodaysPicks(): Promise<WhatsAppPick[]> {
  try {
    // Step 1: Try to get Market API data (with cache)
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

      // Normalize Market API matches
      for (const match of marketMatches) {
        const normalized = normalizeMarketMatch(match);
        marketDataMap.set(normalized.id, normalized);
      }
    } catch (error) {
      logger.warn("Error fetching Market API data, falling back to QuickPurchase-only", {
        tags: ["whatsapp", "picks", "market", "error"],
        error: error instanceof Error ? error : undefined,
      });
    }

    // Step 2: Get matchIds (from Market API if available, or we'll use QuickPurchase)
    const matchIds = marketDataMap.size > 0 
      ? Array.from(marketDataMap.keys())
      : [];

    // Step 3: Query QuickPurchase for matches with prediction data
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        type: "prediction",
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: Prisma.JsonNull },
        ...(matchIds.length > 0
          ? { matchId: { in: matchIds } }
          : { matchId: { not: null } }),
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
      take: 50, // Get more to filter later
    });

    // Step 4: Merge Market API data with QuickPurchase data
    const picks: WhatsAppPick[] = [];

    for (const qp of quickPurchases) {
      if (!qp.matchId) continue;

      // Get Market API data if available
      const marketData = marketDataMap.get(qp.matchId);

      // Extract match data from QuickPurchase JSON
      const matchData = qp.matchData as
        | {
            homeTeam?: { name?: string };
            awayTeam?: { name?: string };
            league?: { name?: string };
            startTime?: string;
          }
        | null;

      // Extract prediction data from QuickPurchase JSON
      const predictionData = qp.predictionData as
        | {
            prediction?: string;
            market?: string;
            tip?: string;
            analysis?: string;
          }
        | null;

      // Use Market API data if available, otherwise fallback to QuickPurchase
      const homeTeam =
        marketData?.homeTeam ||
        matchData?.homeTeam?.name ||
        qp.name.split(" vs ")[0] ||
        "Team A";
      const awayTeam =
        marketData?.awayTeam ||
        matchData?.awayTeam?.name ||
        qp.name.split(" vs ")[1] ||
        "Team B";
      const league =
        marketData?.league ||
        matchData?.league?.name ||
        undefined;
      const kickoffDate = marketData?.kickoffDate || matchData?.startTime || undefined;

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
        kickoffDate,
        market,
        tip,
        confidence: qp.confidenceScore || 75,
        price: Number(qp.price),
        currency: qp.country.currencyCode || "USD",
        odds: qp.odds ? Number(qp.odds) : undefined,
        valueRating: qp.valueRating || undefined,
        // Enhanced Market API data
        consensusOdds: marketData?.odds?.consensus,
        primaryBook: marketData?.odds?.primaryBook,
        booksCount: marketData?.odds?.booksCount,
        modelPredictions: marketData?.modelPredictions,
      });
    }

    // Step 5: Filter and sort (only matches with prediction data, sorted by confidence)
    const filteredPicks = picks
      .filter((pick) => pick.confidence > 0) // Must have confidence
      .sort((a, b) => b.confidence - a.confidence) // Sort by confidence DESC
      .slice(0, 20); // Top 20 picks

    logger.info("Fetched today's picks for WhatsApp (hybrid approach)", {
      tags: ["whatsapp", "picks"],
      data: {
        totalPicks: filteredPicks.length,
        marketApiMatches: marketDataMap.size,
        quickPurchaseMatches: quickPurchases.length,
        hasMarketData: marketDataMap.size > 0,
      },
    });

    return filteredPicks;
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
 */
export async function getPickByMatchId(
  matchId: string
): Promise<WhatsAppPick | null> {
  try {
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

    if (!quickPurchase) {
      return null;
    }

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
    };
  } catch (error) {
    logger.error("Error fetching pick by matchId", { matchId, error });
    return null;
  }
}

/**
 * Format pick for WhatsApp message display
 * Enhanced format with dates, odds, and model predictions
 */
export function formatPickForWhatsApp(pick: WhatsAppPick, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}) ` : "";
  const confidencePct = Math.round(pick.confidence);
  const currencySymbol = pick.currency === "USD" ? "$" : pick.currency;
  
  const lines: string[] = [];
  lines.push(`${prefix}Match ID: ${pick.matchId}`);
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
  
  lines.push(`   📊 Market: ${pick.market}`);
  lines.push(`   💡 Tip: ${pick.tip}`);
  lines.push(`   📈 Confidence: ${confidencePct}%`);
  lines.push(`   💰 Price: ${currencySymbol}${pick.price.toFixed(2)}`);
  
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
    lines.push(formatPickForWhatsApp(pick, idx));
    lines.push(""); // Empty line between picks
  });

  lines.push("To buy a pick, send the matchId directly:");
  lines.push("");
  lines.push("Example:");
  lines.push(`${picks[0].matchId}`);

  return lines.join("\n");
}
