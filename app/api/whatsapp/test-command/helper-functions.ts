/**
 * Helper functions for test-command route
 * These return message strings (don't send directly)
 */

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { hasWhatsAppPremiumAccess } from "@/lib/whatsapp-premium";
import { logger } from "@/lib/logger";

/**
 * Get upcoming matches from MarketMatch table and join with QuickPurchase
 * Returns map of matchId -> { marketData, quickPurchase }
 */
async function getUpcomingMatchesWithPredictions() {
  try {
    const now = new Date();
    
    // Step 1: Query MarketMatch table for upcoming matches
    const marketMatches = await prisma.marketMatch.findMany({
      where: {
        status: "UPCOMING",
        kickoffDate: {
          gt: now, // Greater than current date/time
        },
        isActive: true,
      },
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        consensusOdds: true,
        isConsensusOdds: true,
        primaryBook: true,
        booksCount: true,
        v1Model: true,
        v2Model: true,
        modelPredictions: true,
      },
      orderBy: {
        kickoffDate: 'asc', // Order by earliest kickoff first
      },
      take: 50, // Limit to 50 matches
    });

    if (marketMatches.length === 0) {
      logger.warn("No upcoming matches found in MarketMatch table");
      return new Map();
    }

    // Step 2: Fetch QuickPurchase records for these matchIds
    const matchIds = marketMatches.map((m) => m.matchId);
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        matchId: { in: matchIds },
        predictionData: { not: Prisma.JsonNull },
      },
      select: {
        id: true,
        matchId: true,
        name: true,
        matchData: true,
        predictionData: true,
      },
    });

    // Create map of QuickPurchase by matchId
    const quickPurchaseMap = new Map<string, typeof quickPurchases[0]>();
    for (const qp of quickPurchases) {
      if (qp.matchId) {
        quickPurchaseMap.set(qp.matchId, qp);
      }
    }

    // Step 3: Combine market data with QuickPurchase data
    const result = new Map();
    for (const marketMatch of marketMatches) {
      const qp = quickPurchaseMap.get(marketMatch.matchId);
      if (qp) {
        // Format market data to match the expected structure
        const marketData = {
          id: marketMatch.matchId,
          homeTeam: marketMatch.homeTeam,
          awayTeam: marketMatch.awayTeam,
          league: marketMatch.league,
          kickoffDate: marketMatch.kickoffDate.toISOString(),
          odds: {
            consensus: marketMatch.consensusOdds as { home: number; draw: number; away: number } | undefined,
            isConsensus: marketMatch.isConsensusOdds,
            primaryBook: marketMatch.primaryBook,
            booksCount: marketMatch.booksCount,
          },
          modelPredictions: marketMatch.modelPredictions as {
            free?: { side: string; confidence: number };
            premium?: { side: string; confidence: number };
          } | undefined,
        };

        result.set(marketMatch.matchId, {
          marketData,
          quickPurchase: qp,
        });
      }
    }

    logger.info("Fetched upcoming matches with predictions from MarketMatch table", {
      marketMatches: marketMatches.length,
      quickPurchases: quickPurchases.length,
      matched: result.size,
    });

    return result;
  } catch (error) {
    logger.error("Error fetching upcoming matches with predictions", { error });
    return new Map();
  }
}

/**
 * Get BTTS picks message (browse mode)
 */
export async function getBTTSPicksMessage(to: string, page: number = 0): Promise<string> {
  try {
    const limit = 5;
    const skip = page * limit;
    
    // Get upcoming matches from Market API and join with QuickPurchase
    const upcomingMatches = await getUpcomingMatchesWithPredictions();
    
    if (upcomingMatches.size === 0) {
      return "⚽ **BTTS PICKS**\n\nNo BTTS predictions available right now.\n\nSend '1' to see today's picks!";
    }

    const bttsMatches = Array.from(upcomingMatches.values())
      .map(({ marketData, quickPurchase }) => {
        const match = quickPurchase;
        const predictionData = match.predictionData as any;
        
        // Try additional_markets_flat first (most complete)
        const flat = predictionData?.additional_markets_flat;
        // Then additional_markets_v2
        const v2 = predictionData?.additional_markets_v2;
        // Fallback to old structure
        const additionalMarkets = predictionData?.additional_markets || 
                                  predictionData?.prediction?.additional_markets;
        
        let bttsYes: number | undefined;
        let bttsNo: number | undefined;
        
        if (flat) {
          bttsYes = flat.btts_yes;
          bttsNo = flat.btts_no;
        } else if (v2?.btts) {
          bttsYes = v2.btts.yes;
          bttsNo = v2.btts.no;
        } else if (additionalMarkets?.both_teams_score) {
          bttsYes = additionalMarkets.both_teams_score.yes;
          bttsNo = additionalMarkets.both_teams_score.no;
        }
        
        if (bttsYes === undefined && bttsNo === undefined) {
          return null;
        }

        // Use market data for team names and dates (more reliable for upcoming matches)
        const homeTeam = marketData.homeTeam;
        const awayTeam = marketData.awayTeam;
        const league = marketData.league;
        const startTime = marketData.kickoffDate;
        
        return {
          matchId: match.matchId!,
          name: match.name || `${homeTeam} vs ${awayTeam}`,
          homeTeam,
          awayTeam,
          league,
          startTime,
          bttsYes: bttsYes || 0,
          bttsNo: bttsNo || 0,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.bttsYes - a.bttsYes)
      .slice(skip, skip + limit);

    if (bttsMatches.length === 0) {
      return "⚽ **BTTS PICKS**\n\nNo BTTS predictions available right now.\n\nSend '1' to see today's picks!";
    }

    const premiumStatus = await hasWhatsAppPremiumAccess(to);
    const isPremium = premiumStatus.hasAccess;
    const showLimit = isPremium ? bttsMatches.length : Math.min(3, bttsMatches.length);

    const lines: string[] = [];
    lines.push("⚽ **BTTS OPPORTUNITIES**");
    lines.push("");
    lines.push("Top matches with BTTS YES.");
    lines.push("");

    bttsMatches.slice(0, showLimit).forEach((match, idx) => {
      const bttsYesPct = (match.bttsYes * 100).toFixed(0);
      const bttsNoPct = (match.bttsNo * 100).toFixed(0);
      
      lines.push(`${idx + 1}. ${match.homeTeam} vs ${match.awayTeam}`);
      lines.push("");
      lines.push(`   Match ID: ${match.matchId}`);
      if (match.startTime) {
        const date = new Date(match.startTime);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[date.getMonth()];
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        lines.push(`   ⏰ ${month} ${day}, ${displayHours}:${displayMinutes} ${ampm}`);
      }
      lines.push(`   BTTS Yes: ${bttsYesPct}% | No: ${bttsNoPct}%`);
      lines.push(`   Reply: BTTS ${match.matchId} for details`);
      lines.push("");
    });

    if (!isPremium && bttsMatches.length > 3) {
      lines.push("🔒 Upgrade to VIP to see all BTTS picks!");
      lines.push("Send 'BUY' to unlock premium markets.");
      lines.push("");
    }

    lines.push("👉 Want goal lines or score predictions?");
    lines.push("");
    lines.push("Reply with:");
    lines.push("");
    lines.push("OVERS [MATCH ID]");
    lines.push("UNDERS [MATCH ID]");

    return lines.join("\n");
  } catch (error) {
    return "Sorry, couldn't fetch BTTS picks. Please try again later.";
  }
}

/**
 * Get BTTS details for a specific match
 */
export async function getBTTSForMatchMessage(to: string, matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    
    // Try additional_markets_flat first (most complete)
    const flat = predictionData?.additional_markets_flat;
    const v2 = predictionData?.additional_markets_v2;
    const additionalMarkets = predictionData?.additional_markets || 
                              predictionData?.prediction?.additional_markets;
    
    let bttsYes: number | undefined;
    let bttsNo: number | undefined;
    
    if (flat) {
      bttsYes = flat.btts_yes;
      bttsNo = flat.btts_no;
    } else if (v2?.btts) {
      bttsYes = v2.btts.yes;
      bttsNo = v2.btts.no;
    } else if (additionalMarkets?.both_teams_score) {
      bttsYes = additionalMarkets.both_teams_score.yes;
      bttsNo = additionalMarkets.both_teams_score.no;
    }

    if (bttsYes === undefined && bttsNo === undefined) {
      return `BTTS data not available for Match ID ${matchId}.\n\nSend '1' to see matches with BTTS predictions.`;
    }

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";
    const league = matchData?.league?.name || "Unknown League";

    const bttsYesPct = ((bttsYes || 0) * 100).toFixed(1);
    const bttsNoPct = ((bttsNo || 0) * 100).toFixed(1);
    const recommendation = (bttsYes || 0) > (bttsNo || 0) ? "Yes" : "No";
    const confidence = Math.abs((bttsYes || 0) - (bttsNo || 0)) * 100;

    const premiumStatus = await hasWhatsAppPremiumAccess(to);
    const isPremium = premiumStatus.hasAccess;

    const lines: string[] = [];
    lines.push("⚽ **BTTS ANALYSIS**");
    lines.push("");
    lines.push("🎯 **ADDITIONAL MARKETS:**");
    lines.push("");
    lines.push(`Both Teams Score (Yes): ${bttsYesPct}%`);
    lines.push(`Both Teams Score (No): ${bttsNoPct}%`);
    lines.push(`Reply with OVER [Matchid] for over/under`);
    lines.push("");
    lines.push("👉 Want goal lines or score predictions?");
    lines.push("");
    lines.push("Reply with:");
    lines.push("");
    lines.push(`OVERS ${matchId}`);
    lines.push(`CS ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch BTTS data for Match ID ${matchId}.`;
  }
}

/**
 * Get Over/Under picks message (browse mode)
 */
export async function getOversPicksMessage(to: string, page: number = 0): Promise<string> {
  try {
    const limit = 5;
    const skip = page * limit;
    
    // Get upcoming matches from Market API and join with QuickPurchase
    const upcomingMatches = await getUpcomingMatchesWithPredictions();
    
    if (upcomingMatches.size === 0) {
      return "📊 **OVER/UNDER GOALS**\n\nNo Over/Under predictions available right now.\n\nSend '1' to see today's picks!";
    }

    const oversMatches = Array.from(upcomingMatches.values())
      .map(({ marketData, quickPurchase }) => {
        const match = quickPurchase;
        const predictionData = match.predictionData as any;
        
        // Try additional_markets_flat first (most complete)
        const flat = predictionData?.additional_markets_flat;
        // Then additional_markets_v2.totals
        const totalsV2 = predictionData?.additional_markets_v2?.totals;
        // Fallback to old structure
        const additionalMarkets = predictionData?.additional_markets || 
                                  predictionData?.prediction?.additional_markets;
        const totalGoals = additionalMarkets?.total_goals;
        
        let over25: number | undefined;
        let under25: number | undefined;
        
        if (flat) {
          over25 = flat.totals_over_2_5;
          under25 = flat.totals_under_2_5;
        } else if (totalsV2?.['2_5']) {
          over25 = totalsV2['2_5'].over;
          under25 = totalsV2['2_5'].under;
        } else if (totalGoals) {
          over25 = totalGoals.over_2_5 || totalGoals['over_2.5'];
          under25 = totalGoals.under_2_5 || totalGoals['under_2.5'];
        }
        
        if (over25 === undefined && under25 === undefined) {
          return null;
        }

        // Use market data for team names and dates (more reliable for upcoming matches)
        const homeTeam = marketData.homeTeam;
        const awayTeam = marketData.awayTeam;
        const league = marketData.league;
        const startTime = marketData.kickoffDate;
        
        return {
          matchId: match.matchId!,
          name: match.name || `${homeTeam} vs ${awayTeam}`,
          homeTeam,
          awayTeam,
          league,
          startTime,
          over25: over25 || 0,
          under25: under25 || 0,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => Math.max(b.over25, b.under25) - Math.max(a.over25, a.under25))
      .slice(skip, skip + limit);

    if (oversMatches.length === 0) {
      return "📊 **OVER/UNDER GOALS**\n\nNo Over/Under predictions available right now.\n\nSend '1' to see today's picks!";
    }

    const premiumStatus = await hasWhatsAppPremiumAccess(to);
    const isPremium = premiumStatus.hasAccess;
    const showLimit = isPremium ? oversMatches.length : Math.min(3, oversMatches.length);

    // Calculate average for display (as per user format)
    const avgOver25 = oversMatches.length > 0 
      ? oversMatches.reduce((sum, m) => sum + m.over25, 0) / oversMatches.length 
      : 0;
    const avgUnder25 = oversMatches.length > 0 
      ? oversMatches.reduce((sum, m) => sum + m.under25, 0) / oversMatches.length 
      : 0;

    const lines: string[] = [];
    lines.push("📈 **OVER GOALS**");
    lines.push("");
    lines.push("🎯 **ADDITIONAL MARKETS:**");
    lines.push("");
    lines.push(`Over 2.5 Goals: ${(avgOver25 * 100).toFixed(1)}%`);
    lines.push(`Under 2.5 Goals: ${(avgUnder25 * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("👉 Want goal lines or BTTS?");
    lines.push("");
    lines.push("Reply with:");
    lines.push("");
    lines.push("UNDERS [MATCH ID]");
    lines.push("BTTS [MATCH ID]");

    return lines.join("\n");
  } catch (error) {
    return "Sorry, couldn't fetch Over/Under picks. Please try again later.";
  }
}

/**
 * Get Over/Under details for a specific match
 */
export async function getOversForMatchMessage(to: string, matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    
    // Try additional_markets_flat first (has all lines)
    const flat = predictionData?.additional_markets_flat;
    const totalsV2 = predictionData?.additional_markets_v2?.totals;
    const additionalMarkets = predictionData?.additional_markets || 
                              predictionData?.prediction?.additional_markets;
    const totalGoals = additionalMarkets?.total_goals;

    const hasGoalData = flat || totalsV2 || totalGoals;

    if (!hasGoalData) {
      return `Over/Under data not available for Match ID ${matchId}.\n\nSend '1' to see matches with Over/Under predictions.`;
    }

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";
    const league = matchData?.league?.name || "Unknown League";

    // Extract all goal lines
    const goalLines: { line: string; over: number; under: number }[] = [];
    
    if (flat) {
      const lines = ['0_5', '1_5', '2_5', '3_5', '4_5'];
      for (const line of lines) {
        const over = flat[`totals_over_${line}`];
        const under = flat[`totals_under_${line}`];
        if (over !== undefined || under !== undefined) {
          goalLines.push({
            line: line.replace('_', '.'),
            over: over || 0,
            under: under || 0,
          });
        }
      }
    } else if (totalsV2) {
      const lines = ['0_5', '1_5', '2_5', '3_5', '4_5'];
      for (const line of lines) {
        const data = totalsV2[line];
        if (data) {
          goalLines.push({
            line: line.replace('_', '.'),
            over: data.over || 0,
            under: data.under || 0,
          });
        }
      }
    } else if (totalGoals) {
      const over25 = totalGoals['over_2_5'] || totalGoals['over_2.5'] || 0;
      const under25 = totalGoals['under_2_5'] || totalGoals['under_2.5'] || 0;
      goalLines.push({ line: '2.5', over: over25, under: under25 });
    }

    const premiumStatus = await hasWhatsAppPremiumAccess(to);
    const isPremium = premiumStatus.hasAccess;

    const lines: string[] = [];
    lines.push("📈 **GOALS ANALYSIS**");
    lines.push("");
    lines.push("🎯 **ADDITIONAL MARKETS:**");
    lines.push("");
    
    // Show Over 2.5 and Under 2.5 (as per user format)
    const over25Line = goalLines.find(gl => gl.line === '2.5');
    if (over25Line) {
      lines.push(`Over 2.5 Goals: ${(over25Line.over * 100).toFixed(1)}%`);
      lines.push(`Under 2.5 Goals: ${(over25Line.under * 100).toFixed(1)}%`);
    } else if (goalLines.length > 0) {
      // Fallback to first available line
      lines.push(`Over ${goalLines[0].line}: ${(goalLines[0].over * 100).toFixed(1)}%`);
      lines.push(`Under ${goalLines[0].line}: ${(goalLines[0].under * 100).toFixed(1)}%`);
    }
    lines.push("");
    lines.push("👉 Want goal lines or score predictions?");
    lines.push("");
    lines.push("Reply with:");
    lines.push("");
    lines.push(`UNDERS ${matchId}`);
    lines.push(`CS ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch Over/Under data for Match ID ${matchId}.`;
  }
}

/**
 * Get Under picks message (browse mode) - focuses on Under 2.5
 */
export async function getUndersPicksMessage(to: string, page: number = 0): Promise<string> {
  try {
    const limit = 5;
    const skip = page * limit;
    
    // Get upcoming matches from Market API and join with QuickPurchase
    const upcomingMatches = await getUpcomingMatchesWithPredictions();
    
    if (upcomingMatches.size === 0) {
      return "📊 **UNDER PICKS**\n\nNo Under predictions available right now.\n\nSend '1' to see today's picks!";
    }

    const undersMatches = Array.from(upcomingMatches.values())
      .map(({ marketData, quickPurchase }) => {
        const match = quickPurchase;
        const predictionData = match.predictionData as any;
        
        // Try additional_markets_flat first (most complete)
        const flat = predictionData?.additional_markets_flat;
        const totalsV2 = predictionData?.additional_markets_v2?.totals;
        const additionalMarkets = predictionData?.additional_markets || 
                                  predictionData?.prediction?.additional_markets;
        const totalGoals = additionalMarkets?.total_goals;
        
        let over25: number | undefined;
        let under25: number | undefined;
        
        if (flat) {
          over25 = flat.totals_over_2_5;
          under25 = flat.totals_under_2_5;
        } else if (totalsV2?.['2_5']) {
          over25 = totalsV2['2_5'].over;
          under25 = totalsV2['2_5'].under;
        } else if (totalGoals) {
          over25 = totalGoals.over_2_5 || totalGoals['over_2.5'];
          under25 = totalGoals.under_2_5 || totalGoals['under_2.5'];
        }
        
        if (under25 === undefined && over25 === undefined) {
          return null;
        }

        // Use market data for team names and dates (more reliable for upcoming matches)
        const homeTeam = marketData.homeTeam;
        const awayTeam = marketData.awayTeam;
        const league = marketData.league;
        const startTime = marketData.kickoffDate;
        
        return {
          matchId: match.matchId!,
          name: match.name || `${homeTeam} vs ${awayTeam}`,
          homeTeam,
          awayTeam,
          league,
          startTime,
          over25: over25 || 0,
          under25: under25 || 0,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.under25 - a.under25) // Sort by highest Under 2.5 probability
      .slice(skip, skip + limit);

    if (undersMatches.length === 0) {
      return "📉 **UNDER 2.5 PICKS**\n\nNo Under 2.5 predictions available right now.\n\nSend '1' to see today's picks!";
    }

    const premiumStatus = await hasWhatsAppPremiumAccess(to);
    const isPremium = premiumStatus.hasAccess;
    const showLimit = isPremium ? undersMatches.length : Math.min(3, undersMatches.length);

    const lines: string[] = [];
    lines.push("📉 **UNDER 2.5 GOALS**");
    lines.push("");
    lines.push("Top low-scoring matches.");
    lines.push("");

    undersMatches.slice(0, showLimit).forEach((match, idx) => {
      const over25Pct = (match.over25 * 100).toFixed(0);
      const under25Pct = (match.under25 * 100).toFixed(0);
      
      lines.push(`${idx + 1}. ${match.homeTeam} vs ${match.awayTeam}`);
      lines.push("");
      lines.push(`   Match ID: ${match.matchId}`);
      if (match.startTime) {
        const date = new Date(match.startTime);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[date.getMonth()];
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        lines.push(`   ⏰ ${month} ${day}, ${displayHours}:${displayMinutes} ${ampm}`);
      }
      lines.push(`   Under 2.5: ${under25Pct}% | Over 2.5: ${over25Pct}%`);
      lines.push(`   Reply: UNDERS ${match.matchId} for details`);
      lines.push("");
    });

    if (!isPremium && undersMatches.length > 3) {
      lines.push("🔒 Upgrade to VIP to see all Under 2.5 picks!");
      lines.push("Send 'BUY' to unlock premium markets.");
      lines.push("");
    }

    lines.push("👉 Want BTTS or over markets?");
    lines.push("");
    lines.push("Reply with:");
    lines.push("");
    lines.push("BTTS [MATCH ID]");
    lines.push("OVERS [MATCH ID]");

    return lines.join("\n");
  } catch (error) {
    return "Sorry, couldn't fetch Under 2.5 picks. Please try again later.";
  }
}

/**
 * Get Under details for a specific match
 */
export async function getUndersForMatchMessage(to: string, matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    
    // Try additional_markets_flat first (has all lines)
    const flat = predictionData?.additional_markets_flat;
    const totalsV2 = predictionData?.additional_markets_v2?.totals;
    const additionalMarkets = predictionData?.additional_markets || 
                              predictionData?.prediction?.additional_markets;
    const totalGoals = additionalMarkets?.total_goals;

    const hasGoalData = flat || totalsV2 || totalGoals;

    if (!hasGoalData) {
      return `Under goals data not available for Match ID ${matchId}.\n\nSend '1' to see matches with predictions.`;
    }

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";
    const league = matchData?.league?.name || "Unknown League";

    // Extract all goal lines
    const goalLines: { line: string; over: number; under: number }[] = [];
    
    if (flat) {
      const lines = ['0_5', '1_5', '2_5', '3_5', '4_5'];
      for (const line of lines) {
        const over = flat[`totals_over_${line}`];
        const under = flat[`totals_under_${line}`];
        if (over !== undefined || under !== undefined) {
          goalLines.push({
            line: line.replace('_', '.'),
            over: over || 0,
            under: under || 0,
          });
        }
      }
    } else if (totalsV2) {
      const lines = ['0_5', '1_5', '2_5', '3_5', '4_5'];
      for (const line of lines) {
        const data = totalsV2[line];
        if (data) {
          goalLines.push({
            line: line.replace('_', '.'),
            over: data.over || 0,
            under: data.under || 0,
          });
        }
      }
    } else if (totalGoals) {
      const over25 = totalGoals['over_2_5'] || totalGoals['over_2.5'] || 0;
      const under25 = totalGoals['under_2_5'] || totalGoals['under_2.5'] || 0;
      goalLines.push({ line: '2.5', over: over25, under: under25 });
    }

    const premiumStatus = await hasWhatsAppPremiumAccess(to);
    const isPremium = premiumStatus.hasAccess;

    const lines: string[] = [];
    lines.push("📉 **UNDER GOALS ANALYSIS**");
    lines.push("");
    lines.push("🎯 **UNDER MARKETS:**");
    lines.push("");

    // Show Under 2.5 and Over 2.5 (as per user format)
    const under25Line = goalLines.find(gl => gl.line === '2.5');
    if (under25Line) {
      lines.push(`Under 2.5: ${(under25Line.under * 100).toFixed(1)}% | Over 2.5: ${(under25Line.over * 100).toFixed(1)}%`);
    } else if (goalLines.length > 0) {
      // Fallback to first available line
      lines.push(`Under ${goalLines[0].line}: ${(goalLines[0].under * 100).toFixed(1)}% | Over ${goalLines[0].line}: ${(goalLines[0].over * 100).toFixed(1)}%`);
    }
    lines.push("");
    lines.push("👉 Want other markets?");
    lines.push("");
    lines.push("Reply with:");
    lines.push("");
    lines.push(`OVERS ${matchId}`);
    lines.push(`CS ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch Under goals data for Match ID ${matchId}.`;
  }
}

/**
 * Get correct score picks message (browse mode)
 */
export async function getCorrectScorePicksMessage(): Promise<string> {
  try {
    // Get upcoming matches from Market API and join with QuickPurchase
    const upcomingMatches = await getUpcomingMatchesWithPredictions();
    
    if (upcomingMatches.size === 0) {
      return "🎯 **CORRECT SCORES**\n\nNo Correct Score predictions available right now.\n\nSend '1' to see today's picks!";
    }

    const csMatches = Array.from(upcomingMatches.values())
      .slice(0, 20) // Limit to 20 matches
      .map(({ marketData, quickPurchase }) => {
        const match = quickPurchase;
        const predictionData = match.predictionData as any;
        const correctScores = predictionData?.additional_markets_v2?.correct_scores ||
                             predictionData?.additional_markets?.correct_score_top3;
        
        if (!correctScores || correctScores.length === 0) return null;

        // Use market data for team names and dates (more reliable for upcoming matches)
        const homeTeam = marketData.homeTeam;
        const awayTeam = marketData.awayTeam;
        const startTime = marketData.kickoffDate;
        const topScore = correctScores[0];
        
        return {
          matchId: match.matchId!,
          homeTeam,
          awayTeam,
          startTime,
          topScore: topScore.score,
          topProb: topScore.p,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.topProb - a.topProb)
      .slice(0, 5);

    if (csMatches.length === 0) {
      return "🎯 **CORRECT SCORES**\n\nNo correct score predictions available right now.\n\nSend '1' to see today's picks!";
    }

    const lines: string[] = [];
    lines.push("🎯 **CORRECT SCORES**");
    lines.push("");
    lines.push("High-odds score picks.");
    lines.push("");

    csMatches.forEach((match, idx) => {
      lines.push(`${idx + 1}. ${match.homeTeam} vs ${match.awayTeam}`);
      lines.push(`   Match ID: ${match.matchId}`);
      if (match.startTime) {
        const date = new Date(match.startTime);
        lines.push(`   ⏰ ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
      }
      lines.push(`   Top Score: ${match.topScore} (${(match.topProb * 100).toFixed(1)}%)`);
      lines.push(`   Reply: CS ${match.matchId} for details`);
      lines.push("");
    });

    lines.push("👉 Want deeper markets from this score profile?");
    lines.push("");
    lines.push("Reply with:");
    lines.push("MORE [MATCH ID]");

    return lines.join("\n");
  } catch (error) {
    return "Sorry, couldn't fetch correct score picks. Please try again later.";
  }
}

/**
 * Get correct score details for a specific match
 */
export async function getCorrectScoreForMatchMessage(matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    const correctScores = predictionData?.additional_markets_v2?.correct_scores ||
                         predictionData?.additional_markets?.correct_score_top3;

    if (!correctScores || correctScores.length === 0) {
      return `Correct score data not available for Match ID ${matchId}.\n\nSend 'CS' to see matches with score predictions.`;
    }

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    const lines: string[] = [];
    lines.push("🎯 **CORRECT SCORE ANALYSIS**");
    lines.push("");
    lines.push(`${homeTeam} vs ${awayTeam}`);
    lines.push(`Match ID: ${matchId}`);
    lines.push("");
    lines.push("📊 **TOP PREDICTED SCORES:**");
    lines.push("");

    correctScores.slice(0, 5).forEach((score: { score: string; p: number }, idx: number) => {
      lines.push(`${idx + 1}. ${score.score}: ${(score.p * 100).toFixed(1)}%`);
    });

    const otherScore = correctScores.find((s: { score: string }) => s.score === "Other");
    if (otherScore) {
      lines.push("");
      lines.push(`Other: ${(otherScore.p * 100).toFixed(1)}%`);
    }

    lines.push("");
    lines.push(`💡 Best Value: ${correctScores[0].score}`);
    lines.push("");
    lines.push("👉 Want other markets?");
    lines.push("");
    lines.push(`Reply: BTTS ${matchId}`);
    lines.push(`Reply: OVERS ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch correct score data for Match ID ${matchId}.`;
  }
}

/**
 * Get team analysis for a match (REASON command)
 */
export async function getReasonForMatchMessage(matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    const teamAnalysis = predictionData?.comprehensive_analysis?.ai_verdict?.team_analysis ||
                        predictionData?.analysis?.team_analysis;

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    const lines: string[] = [];
    lines.push("🧠 **WHY THIS PICK**");
    lines.push("");
    lines.push(`${homeTeam} vs ${awayTeam}`);
    lines.push("");

    lines.push(`🏠 **${homeTeam}:**`);
    if (teamAnalysis?.home_team) {
      const home = teamAnalysis.home_team;
      if (home.strengths?.length > 0) {
        lines.push(`✅ Strengths: ${home.strengths.slice(0, 2).join(", ")}`);
      }
      if (home.weaknesses?.length > 0) {
        lines.push(`⚠️ Weaknesses: ${home.weaknesses.slice(0, 2).join(", ")}`);
      }
      lines.push(`🏥 Injuries: ${home.injury_impact || "No significant injuries reported"}`);
    } else {
      lines.push("Analysis data not available");
    }
    lines.push("");

    lines.push(`✈️ **${awayTeam}:**`);
    if (teamAnalysis?.away_team) {
      const away = teamAnalysis.away_team;
      if (away.strengths?.length > 0) {
        lines.push(`✅ Strengths: ${away.strengths.slice(0, 2).join(", ")}`);
      }
      if (away.weaknesses?.length > 0) {
        lines.push(`⚠️ Weaknesses: ${away.weaknesses.slice(0, 2).join(", ")}`);
      }
      lines.push(`🏥 Injuries: ${away.injury_impact || "No significant injuries reported"}`);
    } else {
      lines.push("Analysis data not available");
    }

    lines.push("");
    lines.push("👉 Want to understand the downside or safer angles?");
    lines.push("");
    lines.push(`Reply: RISK ${matchId}`);
    lines.push(`Reply: ALT ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch analysis for Match ID ${matchId}.`;
  }
}

/**
 * Get risk assessment for a match (RISK command)
 */
export async function getRiskForMatchMessage(matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    const riskAssessment = predictionData?.comprehensive_analysis?.ai_verdict?.risk_assessment ||
                          predictionData?.analysis?.risk_assessment || "Medium";
    const bettingRecs = predictionData?.comprehensive_analysis?.ai_verdict?.betting_recommendations ||
                       predictionData?.analysis?.betting_recommendations;
    const riskFactors = predictionData?.comprehensive_analysis?.ai_verdict?.prediction_analysis?.risk_factors ||
                       predictionData?.analysis?.prediction_analysis?.risk_factors || [];

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    const lines: string[] = [];
    lines.push("⚠️ **RISK CHECK**");
    lines.push("");
    lines.push(`${homeTeam} vs ${awayTeam}`);
    lines.push(`Match ID: ${matchId}`);
    lines.push("");
    lines.push(`Risk Level: ${riskAssessment}`);
    lines.push(`Suggested Stake: ${bettingRecs?.suggested_stake || "Moderate"}`);
    lines.push("");

    if (riskFactors.length > 0) {
      lines.push("Main Risks:");
      riskFactors.slice(0, 3).forEach((risk: string) => {
        lines.push(`• ${risk}`);
      });
      lines.push("");
    }

    lines.push("👉 Want lower-risk options for this match?");
    lines.push("");
    lines.push(`Reply: ALT ${matchId}`);
    lines.push(`Reply: BTTS ${matchId}`);
    lines.push(`Reply: OVERS ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch risk data for Match ID ${matchId}.`;
  }
}

/**
 * Get confidence breakdown for a match (CONFIDENCE command)
 */
export async function getConfidenceForMatchMessage(matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    const mlPrediction = predictionData?.comprehensive_analysis?.ml_prediction ||
                        predictionData?.predictions;
    const modelInfo = predictionData?.model_info;

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    const homeWin = mlPrediction?.probabilities?.home_win || mlPrediction?.home_win || 0;
    const draw = mlPrediction?.probabilities?.draw || mlPrediction?.draw || 0;
    const awayWin = mlPrediction?.probabilities?.away_win || mlPrediction?.away_win || 0;
    const confidence = mlPrediction?.confidence || quickPurchase.confidenceScore || 0;
    const modelType = mlPrediction?.model_type || modelInfo?.type || "consensus";

    const lines: string[] = [];
    lines.push("📊 **CONFIDENCE BREAKDOWN**");
    lines.push("");
    lines.push(`${homeTeam} vs ${awayTeam}`);
    lines.push(`Match ID: ${matchId}`);
    lines.push("");
    lines.push(`Home Win: ${(homeWin * 100).toFixed(1)}%`);
    lines.push(`Draw: ${(draw * 100).toFixed(1)}%`);
    lines.push(`Away Win: ${(awayWin * 100).toFixed(1)}%`);
    lines.push("");
    lines.push(`Model: ${modelType}`);
    lines.push(`Quality Score: ${(confidence * 100).toFixed(1)}%`);
    lines.push("");

    const maxProb = Math.max(homeWin, draw, awayWin);
    let recommendation = "Draw";
    if (maxProb === homeWin) recommendation = "Home Win";
    else if (maxProb === awayWin) recommendation = "Away Win";

    lines.push(`💡 Lean: ${recommendation}`);
    lines.push("");
    lines.push("👉 Want higher-confidence odds?");
    lines.push("");
    lines.push(`Reply: VALUE ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch confidence data for Match ID ${matchId}.`;
  }
}

/**
 * Get value assessment for a match (VALUE command)
 */
export async function getValueForMatchMessage(matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    const mlPrediction = predictionData?.comprehensive_analysis?.ml_prediction ||
                        predictionData?.predictions;
    const recommendedBet = mlPrediction?.recommended_bet || predictionData?.predictions?.recommended_bet || "N/A";

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    const homeWin = mlPrediction?.probabilities?.home_win || mlPrediction?.home_win || 0;
    const awayWin = mlPrediction?.probabilities?.away_win || mlPrediction?.away_win || 0;
    const maxProb = Math.max(homeWin, awayWin);
    const market = homeWin > awayWin ? "Home Win" : "Away Win";
    const valueRating = quickPurchase.valueRating || (maxProb > 0.5 ? "Medium" : "Low");

    const lines: string[] = [];
    lines.push("💰 **VALUE CHECK**");
    lines.push("");
    lines.push(`${homeTeam} vs ${awayTeam}`);
    lines.push(`Match ID: ${matchId}`);
    lines.push("");
    lines.push(`Market: ${market}`);
    lines.push(`AI Probability: ${(maxProb * 100).toFixed(1)}%`);
    if (quickPurchase.odds) {
      lines.push(`Consensus Odds: ${Number(quickPurchase.odds).toFixed(2)}`);
    }
    lines.push(`Value Rating: ${valueRating}`);
    lines.push("");
    lines.push(`💡 ${recommendedBet}`);
    lines.push("");
    lines.push("👉 Want confidence breakdown?");
    lines.push("");
    lines.push(`Reply: CONFIDENCE ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch value data for Match ID ${matchId}.`;
  }
}

/**
 * Get alternative bets for a match (ALT command)
 */
export async function getAltForMatchMessage(matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    const flat = predictionData?.additional_markets_flat;
    const v2 = predictionData?.additional_markets_v2;

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    const bttsYes = flat?.btts_yes || v2?.btts?.yes || 0;
    const bttsNo = flat?.btts_no || v2?.btts?.no || 0;
    const over25 = flat?.totals_over_2_5 || v2?.totals?.['2_5']?.over || 0;
    const under25 = flat?.totals_under_2_5 || v2?.totals?.['2_5']?.under || 0;
    const dc1X = flat?.double_chance_1X || v2?.double_chance?.['1X'] || 0;
    const dcX2 = flat?.double_chance_X2 || v2?.double_chance?.['X2'] || 0;
    const dnbHome = flat?.dnb_home || v2?.dnb?.home || 0;
    const dnbAway = flat?.dnb_away || v2?.dnb?.away || 0;

    const bttsRec = bttsYes > bttsNo ? `Yes (${(bttsYes * 100).toFixed(0)}%)` : `No (${(bttsNo * 100).toFixed(0)}%)`;
    const ouRec = over25 > under25 ? `Over (${(over25 * 100).toFixed(0)}%)` : `Under (${(under25 * 100).toFixed(0)}%)`;
    const dcRec = dc1X > dcX2 ? `1X (${(dc1X * 100).toFixed(0)}%)` : `X2 (${(dcX2 * 100).toFixed(0)}%)`;
    const dnbRec = dnbHome > dnbAway ? `Home (${(dnbHome * 100).toFixed(0)}%)` : `Away (${(dnbAway * 100).toFixed(0)}%)`;

    const lines: string[] = [];
    lines.push("🔁 **ALTERNATIVE BETS**");
    lines.push("");
    lines.push(`${homeTeam} vs ${awayTeam}`);
    lines.push(`Match ID: ${matchId}`);
    lines.push("");
    lines.push(`• BTTS: ${bttsRec}`);
    lines.push(`• Over/Under 2.5: ${ouRec}`);
    lines.push(`• Double Chance: ${dcRec}`);
    lines.push(`• DNB: ${dnbRec}`);
    lines.push("");
    lines.push("👉 Want probabilities for these markets?");
    lines.push("");
    lines.push(`Reply: BTTS ${matchId}`);
    lines.push(`Reply: OVERS ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch alternative bets for Match ID ${matchId}.`;
  }
}

/**
 * Get match stats snapshot (STATS command)
 */
export async function getStatsForMatchMessage(matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    const dataFreshness = predictionData?.data_freshness;
    const teamAnalysis = predictionData?.comprehensive_analysis?.ai_verdict?.team_analysis ||
                        predictionData?.analysis?.team_analysis;

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    const h2hMatches = dataFreshness?.h2h_matches || 0;
    const formMatches = dataFreshness?.form_matches || 5;
    const homeInjuries = dataFreshness?.home_injuries || 0;
    const awayInjuries = dataFreshness?.away_injuries || 0;

    const homeForm = teamAnalysis?.home_team?.form_assessment || "Form data not available";
    const awayForm = teamAnalysis?.away_team?.form_assessment || "Form data not available";

    const lines: string[] = [];
    lines.push("📈 **MATCH STATS SNAPSHOT**");
    lines.push("");
    lines.push(`${homeTeam} vs ${awayTeam}`);
    lines.push(`Match ID: ${matchId}`);
    lines.push("");
    lines.push(`• H2H Matches: ${h2hMatches}`);
    lines.push(`• Form Window: ${formMatches} matches`);
    lines.push(`• Home Injuries: ${homeInjuries}`);
    lines.push(`• Away Injuries: ${awayInjuries}`);
    lines.push("");
    lines.push(`Home Form: ${homeForm.substring(0, 80)}${homeForm.length > 80 ? '...' : ''}`);
    lines.push(`Away Form: ${awayForm.substring(0, 80)}${awayForm.length > 80 ? '...' : ''}`);
    lines.push("");
    lines.push("👉 Want value analysis?");
    lines.push("");
    lines.push(`Reply: CONFIDENCE ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch stats for Match ID ${matchId}.`;
  }
}

/**
 * Get all markets for a match (MORE command)
 */
export async function getMoreForMatchMessage(matchId: string): Promise<string> {
  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      return `Match ID ${matchId} not found. Send '1' to see available matches.`;
    }

    const predictionData = quickPurchase.predictionData as any;
    const flat = predictionData?.additional_markets_flat;
    const v2 = predictionData?.additional_markets_v2;
    const predictions = predictionData?.predictions;

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    const homeWin = predictions?.home_win || 0;
    const draw = predictions?.draw || 0;
    const awayWin = predictions?.away_win || 0;
    const bttsYes = flat?.btts_yes || v2?.btts?.yes || 0;
    const bttsNo = flat?.btts_no || v2?.btts?.no || 0;
    const over25 = flat?.totals_over_2_5 || v2?.totals?.['2_5']?.over || 0;
    const under25 = flat?.totals_under_2_5 || v2?.totals?.['2_5']?.under || 0;
    const dc1X = flat?.double_chance_1X || v2?.double_chance?.['1X'] || 0;
    const dcX2 = flat?.double_chance_X2 || v2?.double_chance?.['X2'] || 0;
    const dc12 = flat?.double_chance_12 || v2?.double_chance?.['12'] || 0;
    const dnbHome = flat?.dnb_home || v2?.dnb?.home || 0;
    const dnbAway = flat?.dnb_away || v2?.dnb?.away || 0;
    const wtnHome = flat?.win_to_nil_home || v2?.win_to_nil?.home || 0;
    const wtnAway = flat?.win_to_nil_away || v2?.win_to_nil?.away || 0;

    const lines: string[] = [];
    lines.push("📊 **ALL MARKETS**");
    lines.push("");
    lines.push(`${homeTeam} vs ${awayTeam}`);
    lines.push(`Match ID: ${matchId}`);
    lines.push("");
    lines.push("**1X2:**");
    lines.push(`Home: ${(homeWin * 100).toFixed(1)}% | Draw: ${(draw * 100).toFixed(1)}% | Away: ${(awayWin * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("**BTTS:**");
    lines.push(`Yes: ${(bttsYes * 100).toFixed(1)}% | No: ${(bttsNo * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("**Total Goals:**");
    lines.push(`Over 2.5: ${(over25 * 100).toFixed(1)}% | Under 2.5: ${(under25 * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("**Double Chance:**");
    lines.push(`1X: ${(dc1X * 100).toFixed(1)}% | X2: ${(dcX2 * 100).toFixed(1)}% | 12: ${(dc12 * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("**DNB:**");
    lines.push(`Home: ${(dnbHome * 100).toFixed(1)}% | Away: ${(dnbAway * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("**Win to Nil:**");
    lines.push(`Home: ${(wtnHome * 100).toFixed(1)}% | Away: ${(wtnAway * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("👉 Get specific analysis:");
    lines.push("");
    lines.push(`Reply: BTTS ${matchId}`);
    lines.push(`Reply: OVERS ${matchId}`);
    lines.push(`Reply: CS ${matchId}`);

    return lines.join("\n");
  } catch (error) {
    return `Sorry, couldn't fetch markets for Match ID ${matchId}.`;
  }
}

