import prisma from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * WhatsApp Pick - Formatted pick data for WhatsApp display
 */
export interface WhatsAppPick {
  matchId: string;
  quickPurchaseId: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  tip: string;
  confidence: number; // 0-100
  price: number;
  currency: string;
  odds?: number;
  valueRating?: string;
}

/**
 * Get today's active picks from QuickPurchase table
 * Filters for prediction-type items that are active and have matchId
 */
export async function getTodaysPicks(): Promise<WhatsAppPick[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        type: "prediction",
        isActive: true,
        isPredictionActive: true,
        matchId: { not: null },
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
        confidenceScore: "desc", // Show highest confidence first
      },
      take: 20, // Limit to top 20 picks
    });

    const picks: WhatsAppPick[] = [];

    for (const qp of quickPurchases) {
      if (!qp.matchId) continue;

      // Extract match data from JSON
      const matchData = qp.matchData as
        | {
            homeTeam?: { name?: string };
            awayTeam?: { name?: string };
            league?: { name?: string };
            startTime?: string;
          }
        | null;

      // Extract prediction data from JSON
      const predictionData = qp.predictionData as
        | {
            prediction?: string;
            market?: string;
            tip?: string;
            analysis?: string;
          }
        | null;

      const homeTeam =
        matchData?.homeTeam?.name || qp.name.split(" vs ")[0] || "Team A";
      const awayTeam =
        matchData?.awayTeam?.name || qp.name.split(" vs ")[1] || "Team B";
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
        market,
        tip,
        confidence: qp.confidenceScore || 75,
        price: Number(qp.price),
        currency: qp.country.currencyCode || "USD",
        odds: qp.odds ? Number(qp.odds) : undefined,
        valueRating: qp.valueRating || undefined,
      });
    }

    logger.info("Fetched today's picks for WhatsApp", {
      count: picks.length,
    });

    return picks;
  } catch (error) {
    logger.error("Error fetching today's picks", error);
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
 */
export function formatPickForWhatsApp(pick: WhatsAppPick, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}) ` : "";
  const confidencePct = Math.round(pick.confidence);
  const currencySymbol = pick.currency === "USD" ? "$" : pick.currency;
  const oddsText = pick.odds ? `\n   Odds: ${pick.odds.toFixed(2)}` : "";
  const valueText = pick.valueRating
    ? `\n   Value: ${pick.valueRating}`
    : "";

  return `${prefix}Match ID: ${pick.matchId}
   ${pick.homeTeam} vs ${pick.awayTeam}
   Market: ${pick.market}
   Tip: ${pick.tip}
   Confidence: ${confidencePct}%
   Price: ${currencySymbol}${pick.price.toFixed(2)}${oddsText}${valueText}`;
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

  lines.push("To buy a pick, reply with:");
  lines.push("2 <matchId>");
  lines.push("");
  lines.push("Example:");
  lines.push(`2 ${picks[0].matchId}`);

  return lines.join("\n");
}
