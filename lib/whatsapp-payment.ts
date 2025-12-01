import { stripe, formatAmountForStripe, getStripeCurrency } from "@/lib/stripe-server";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { getPickByMatchId } from "./whatsapp-picks";
import { getDbCountryPricing } from "@/lib/server-pricing-service";
import { getCountryCodeFromPhone } from "./whatsapp-country-detection";

const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * Get or create WhatsAppUser by waId
 * Detects and stores country code from phone number
 */
export async function getOrCreateWhatsAppUser(waId: string) {
  try {
    // Normalize waId (remove + if present, ensure it's just digits)
    const normalizedWaId = waId.replace(/[^0-9]/g, "");

    let waUser = await prisma.whatsAppUser.findUnique({
      where: { waId: normalizedWaId },
    });

    // Detect country from phone number
    const detectedCountry = getCountryCodeFromPhone(normalizedWaId, "US");

    if (!waUser) {
      waUser = await prisma.whatsAppUser.create({
        data: {
          waId: normalizedWaId,
          countryCode: detectedCountry,
          totalSpend: 0,
          totalPicks: 0,
          isActive: true,
        },
      });
      logger.info("Created new WhatsAppUser", { 
        waId: normalizedWaId,
        countryCode: detectedCountry,
      });
    } else {
      // Update lastSeenAt and countryCode if not set
      const updateData: { lastSeenAt: Date; countryCode?: string } = { 
        lastSeenAt: new Date() 
      };
      
      // Only update countryCode if it's not already set
      if (!waUser.countryCode) {
        updateData.countryCode = detectedCountry;
      }
      
      waUser = await prisma.whatsAppUser.update({
        where: { id: waUser.id },
        data: updateData,
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

    // Check if pick is purchasable (has QuickPurchase record)
    if (!pick.isPurchasable || !pick.quickPurchaseId || !pick.price || !pick.currency) {
      throw new Error(`This match is not available for purchase yet. Check back soon!`);
    }

    // Check if already purchased
    const alreadyPurchased = await hasAlreadyPurchased(
      waUser.id,
      pick.quickPurchaseId
    );
    if (alreadyPurchased) {
      throw new Error("You have already purchased this pick");
    }

    // Get country-specific pricing based on user's country
    const userCountryCode = waUser.countryCode || getCountryCodeFromPhone(waId, "US");
    let finalPrice = pick.price;
    let finalCurrency = pick.currency;

    try {
      // Get country-specific pricing from database
      const countryPricing = await getDbCountryPricing(userCountryCode, "prediction");
      finalPrice = countryPricing.price;
      finalCurrency = countryPricing.currencyCode;
      
      logger.info("Using country-specific pricing", {
        waId,
        countryCode: userCountryCode,
        price: finalPrice,
        currency: finalCurrency,
        originalPrice: pick.price,
        originalCurrency: pick.currency,
      });
    } catch (pricingError) {
      // If country pricing not found, use QuickPurchase pricing as fallback
      logger.warn("Country pricing not found, using QuickPurchase pricing", {
        waId,
        countryCode: userCountryCode,
        error: pricingError instanceof Error ? pricingError.message : undefined,
        fallbackPrice: pick.price,
        fallbackCurrency: pick.currency,
      });
      // Keep original price and currency
    }

    // Type-safe: we know these exist because of the check above
    const quickPurchaseId = pick.quickPurchaseId;
    const market = pick.market || "1X2";
    const tip = pick.tip || "Win";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: getStripeCurrency(finalCurrency),
            product_data: {
              name: `SnapBet Pick: ${pick.homeTeam} vs ${pick.awayTeam}`,
              description: `${market} - ${tip}`,
            },
            unit_amount: formatAmountForStripe(finalPrice, finalCurrency),
          },
          quantity: 1,
        },
      ],
      metadata: {
        waId: waUser.waId,
        matchId: pick.matchId,
        quickPurchaseId: quickPurchaseId,
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
        quickPurchaseId: quickPurchaseId,
        amount: finalPrice,
        currency: finalCurrency,
        paymentSessionId: session.id,
        status: "pending",
      },
    });

    logger.info("Created WhatsApp payment session", {
      waId: waUser.waId,
      matchId,
      sessionId: session.id,
    });

    // Create short URL for WhatsApp (cleaner than full Stripe URL)
    const baseUrl = BASE_URL.replace(/\/$/, ""); // Remove trailing slash
    const shortUrl = `${baseUrl}/whatsapp/pay/${session.id}`;

    return {
      paymentUrl: shortUrl, // Use short URL instead of full Stripe URL
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
 * Includes full predictionData structure similar to /match/[id] page
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
  const oddsText = pick.odds ? `💰 Odds: ${pick.odds.toFixed(2)}` : "";
  const valueText = pick.valueRating
    ? `⭐ Value Rating: ${pick.valueRating}`
    : "";

  const lines: string[] = [];
  lines.push("Payment received ✅", "");
  lines.push(`Here is your premium pick for match ${pick.matchId}:`, "");
  lines.push(`🏆 ${pick.homeTeam} vs ${pick.awayTeam}`);
  lines.push("");

  // Basic prediction info
  lines.push("📊 PREDICTION:");
  lines.push(`Market: ${pick.market}`);
  lines.push(`Tip: ${pick.tip}`);
  lines.push(`Confidence: ${confidencePct}%`);
  if (oddsText) lines.push(oddsText);
  if (valueText) lines.push(valueText);
  lines.push("");

  // Extract comprehensive_analysis from predictionData
  const comprehensiveAnalysis = pick.predictionData?.comprehensive_analysis || 
                               pick.predictionData?.prediction?.comprehensive_analysis;

  if (comprehensiveAnalysis) {
    // AI Verdict
    if (comprehensiveAnalysis.ai_verdict) {
      lines.push("🤖 AI VERDICT:");
      if (comprehensiveAnalysis.ai_verdict.recommended_outcome) {
        lines.push(`Recommended: ${comprehensiveAnalysis.ai_verdict.recommended_outcome}`);
      }
      if (comprehensiveAnalysis.ai_verdict.confidence_level) {
        lines.push(`Confidence: ${comprehensiveAnalysis.ai_verdict.confidence_level}`);
      }
      if (comprehensiveAnalysis.ai_verdict.probability_assessment) {
        const prob = comprehensiveAnalysis.ai_verdict.probability_assessment;
        lines.push(`Probabilities:`);
        if (prob.home) lines.push(`  Home: ${(prob.home * 100).toFixed(1)}%`);
        if (prob.draw) lines.push(`  Draw: ${(prob.draw * 100).toFixed(1)}%`);
        if (prob.away) lines.push(`  Away: ${(prob.away * 100).toFixed(1)}%`);
      }
      lines.push("");
    }

    // ML Prediction
    if (comprehensiveAnalysis.ml_prediction) {
      lines.push("📈 ML PREDICTION:");
      if (comprehensiveAnalysis.ml_prediction.confidence) {
        lines.push(`Confidence: ${(comprehensiveAnalysis.ml_prediction.confidence * 100).toFixed(1)}%`);
      }
      if (comprehensiveAnalysis.ml_prediction.home_win) {
        lines.push(`Home Win: ${(comprehensiveAnalysis.ml_prediction.home_win * 100).toFixed(1)}%`);
      }
      if (comprehensiveAnalysis.ml_prediction.draw) {
        lines.push(`Draw: ${(comprehensiveAnalysis.ml_prediction.draw * 100).toFixed(1)}%`);
      }
      if (comprehensiveAnalysis.ml_prediction.away_win) {
        lines.push(`Away Win: ${(comprehensiveAnalysis.ml_prediction.away_win * 100).toFixed(1)}%`);
      }
      lines.push("");
    }

    // Detailed Reasoning
    if (comprehensiveAnalysis.detailed_reasoning) {
      lines.push("🧠 DETAILED REASONING:");
      const reasoning = comprehensiveAnalysis.detailed_reasoning;
      if (reasoning.form_analysis) {
        lines.push(`Form: ${reasoning.form_analysis}`);
      }
      if (reasoning.tactical_factors) {
        lines.push(`Tactics: ${reasoning.tactical_factors}`);
      }
      if (reasoning.injury_impact) {
        lines.push(`Injuries: ${reasoning.injury_impact}`);
      }
      if (reasoning.historical_context) {
        lines.push(`History: ${reasoning.historical_context}`);
      }
      lines.push("");
    }

    // Betting Intelligence
    if (comprehensiveAnalysis.betting_intelligence) {
      lines.push("💡 BETTING INTELLIGENCE:");
      const betting = comprehensiveAnalysis.betting_intelligence;
      if (betting.primary_bet) {
        lines.push(`Primary Bet: ${betting.primary_bet}`);
      }
      if (betting.value_bets && betting.value_bets.length > 0) {
        lines.push(`Value Bets: ${betting.value_bets.join(", ")}`);
      }
      if (betting.avoid_bets && betting.avoid_bets.length > 0) {
        lines.push(`Avoid: ${betting.avoid_bets.join(", ")}`);
      }
      lines.push("");
    }

    // Risk Analysis
    if (comprehensiveAnalysis.risk_analysis) {
      lines.push("⚠️ RISK ANALYSIS:");
      const risk = comprehensiveAnalysis.risk_analysis;
      if (risk.overall_risk) {
        lines.push(`Overall Risk: ${risk.overall_risk}`);
      }
      if (risk.key_risks && risk.key_risks.length > 0) {
        lines.push(`Key Risks: ${risk.key_risks.join(", ")}`);
      }
      if (risk.upset_potential) {
        lines.push(`Upset Potential: ${risk.upset_potential}`);
      }
      lines.push("");
    }

    // Confidence Breakdown
    if (comprehensiveAnalysis.confidence_breakdown) {
      lines.push("📊 CONFIDENCE BREAKDOWN:");
      lines.push(comprehensiveAnalysis.confidence_breakdown);
      lines.push("");
    }
  }

  // Additional Markets
  const additionalMarkets = pick.predictionData?.additional_markets || 
                            pick.predictionData?.prediction?.additional_markets;

  if (additionalMarkets) {
    lines.push("🎯 ADDITIONAL MARKETS:");
    
    if (additionalMarkets.total_goals) {
      if (additionalMarkets.total_goals.over_2_5) {
        lines.push(`Over 2.5 Goals: ${(additionalMarkets.total_goals.over_2_5 * 100).toFixed(1)}%`);
      }
      if (additionalMarkets.total_goals.under_2_5) {
        lines.push(`Under 2.5 Goals: ${(additionalMarkets.total_goals.under_2_5 * 100).toFixed(1)}%`);
      }
    }
    
    if (additionalMarkets.both_teams_score) {
      if (additionalMarkets.both_teams_score.yes) {
        lines.push(`Both Teams Score (Yes): ${(additionalMarkets.both_teams_score.yes * 100).toFixed(1)}%`);
      }
      if (additionalMarkets.both_teams_score.no) {
        lines.push(`Both Teams Score (No): ${(additionalMarkets.both_teams_score.no * 100).toFixed(1)}%`);
      }
    }
    
    if (additionalMarkets.asian_handicap) {
      if (additionalMarkets.asian_handicap.home_handicap) {
        lines.push(`Home Handicap: ${additionalMarkets.asian_handicap.home_handicap}`);
      }
      if (additionalMarkets.asian_handicap.away_handicap) {
        lines.push(`Away Handicap: ${additionalMarkets.asian_handicap.away_handicap}`);
      }
    }
    lines.push("");
  }

  // Analysis Summary (fallback if comprehensive_analysis not available)
  if (!comprehensiveAnalysis && pick.predictionData?.analysis) {
    lines.push("📝 ANALYSIS:");
    lines.push(pick.predictionData.analysis);
    lines.push("");
  }

  lines.push("💵 Stake suggestion: 1-3% of bankroll");
  lines.push("(Not financial advice)", "");
  lines.push("Good luck 🍀");

  return lines.join("\n");
}

