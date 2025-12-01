import { stripe, formatAmountForStripe, getStripeCurrency } from "@/lib/stripe-server";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { getPickByMatchId } from "./whatsapp-picks";

const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * Get or create WhatsAppUser by waId
 */
export async function getOrCreateWhatsAppUser(waId: string) {
  try {
    // Normalize waId (remove + if present, ensure it's just digits)
    const normalizedWaId = waId.replace(/[^0-9]/g, "");

    let waUser = await prisma.whatsAppUser.findUnique({
      where: { waId: normalizedWaId },
    });

    if (!waUser) {
      waUser = await prisma.whatsAppUser.create({
        data: {
          waId: normalizedWaId,
          totalSpend: 0,
          totalPicks: 0,
          isActive: true,
        },
      });
      logger.info("Created new WhatsAppUser", { waId: normalizedWaId });
    } else {
      // Update lastSeenAt
      waUser = await prisma.whatsAppUser.update({
        where: { id: waUser.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return waUser;
  } catch (error) {
    logger.error("Error getting/creating WhatsAppUser", { waId, error });
    throw error;
  }
}

/**
 * Check if user already purchased this pick
 */
export async function hasAlreadyPurchased(
  waUserId: string,
  quickPurchaseId: string
): Promise<boolean> {
  const existing = await prisma.whatsAppPurchase.findFirst({
    where: {
      waUserId,
      quickPurchaseId,
      status: "completed",
    },
  });

  return !!existing;
}

/**
 * Create Stripe Checkout Session for WhatsApp purchase
 */
export async function createWhatsAppPaymentSession(params: {
  waId: string;
  matchId: string;
}): Promise<{ paymentUrl: string; sessionId: string }> {
  const { waId, matchId } = params;

  try {
    // Get or create WhatsAppUser
    const waUser = await getOrCreateWhatsAppUser(waId);

    // Get pick by matchId
    const pick = await getPickByMatchId(matchId);
    if (!pick) {
      throw new Error(`Pick not found for matchId: ${matchId}`);
    }

    // Check if already purchased
    const alreadyPurchased = await hasAlreadyPurchased(
      waUser.id,
      pick.quickPurchaseId
    );
    if (alreadyPurchased) {
      throw new Error("You have already purchased this pick");
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: getStripeCurrency(pick.currency),
            product_data: {
              name: `SnapBet Pick: ${pick.homeTeam} vs ${pick.awayTeam}`,
              description: `${pick.market} - ${pick.tip}`,
            },
            unit_amount: formatAmountForStripe(pick.price, pick.currency),
          },
          quantity: 1,
        },
      ],
      metadata: {
        waId: waUser.waId,
        matchId: pick.matchId,
        quickPurchaseId: pick.quickPurchaseId,
        source: "whatsapp",
      },
      success_url: `${BASE_URL}/whatsapp/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/whatsapp/payment/cancel`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    // Create WhatsAppPurchase record
    await prisma.whatsAppPurchase.create({
      data: {
        waUserId: waUser.id,
        quickPurchaseId: pick.quickPurchaseId,
        amount: pick.price,
        currency: pick.currency,
        paymentSessionId: session.id,
        status: "pending",
      },
    });

    logger.info("Created WhatsApp payment session", {
      waId: waUser.waId,
      matchId,
      sessionId: session.id,
    });

    return {
      paymentUrl: session.url || "",
      sessionId: session.id,
    };
  } catch (error) {
    logger.error("Error creating WhatsApp payment session", {
      waId,
      matchId,
      error,
    });
    throw error;
  }
}

/**
 * Format pick details for delivery message
 */
export function formatPickDeliveryMessage(pick: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  tip: string;
  confidence: number;
  odds?: number;
  valueRating?: string;
  predictionData?: any;
}): string {
  const confidencePct = Math.round(pick.confidence);
  const oddsText = pick.odds ? `\n💰 Odds: ${pick.odds.toFixed(2)}` : "";
  const valueText = pick.valueRating
    ? `\n⭐ Value Rating: ${pick.valueRating}`
    : "";

  // Extract analysis from predictionData if available
  const analysis =
    pick.predictionData?.analysis ||
    pick.predictionData?.summary ||
    "";

  const lines: string[] = [];
  lines.push("Payment received ✅", "");
  lines.push(`Here is your pick for match ${pick.matchId}:`, "");
  lines.push(`🏆 ${pick.homeTeam} vs ${pick.awayTeam}`);
  lines.push(`📊 Market: ${pick.market}`);
  lines.push(`💡 Tip: ${pick.tip}`);
  lines.push(`📈 Confidence: ${confidencePct}%${oddsText}${valueText}`);

  if (analysis) {
    lines.push("", "📝 Analysis:");
    lines.push(analysis);
  }

  lines.push("", "💵 Stake suggestion: 1-3% of bankroll");
  lines.push("(Not financial advice)", "");
  lines.push("Good luck 🍀");

  return lines.join("\n");
}

