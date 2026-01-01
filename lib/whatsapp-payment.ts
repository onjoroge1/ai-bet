import { stripe, formatAmountForStripe, getStripeCurrency } from "@/lib/stripe-server";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { getPickByMatchId } from "./whatsapp-picks";
import { getDbCountryPricing } from "@/lib/server-pricing-service";
import { getCountryCodeFromPhone } from "./whatsapp-country-detection";
import { createPaymentGateway, getPaymentGatewayType } from "./payments/gateway-factory";

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
    // NOTE: Temporarily set to $0 (free) - pricing code kept for future use
    const userCountryCode = waUser.countryCode || getCountryCodeFromPhone(waId, "US");
    let finalPrice = 0; // Set to 0 for free picks
    let finalCurrency = pick.currency || "USD";

    // Keep pricing code for future use (commented out for now)
    // try {
    //   // Get country-specific pricing from database
    //   const countryPricing = await getDbCountryPricing(userCountryCode, "prediction");
    //   finalPrice = countryPricing.price;
    //   finalCurrency = countryPricing.currencyCode;
    //   
    //   logger.info("Using country-specific pricing", {
    //     waId,
    //     countryCode: userCountryCode,
    //     price: finalPrice,
    //     currency: finalCurrency,
    //     originalPrice: pick.price,
    //     originalCurrency: pick.currency,
    //   });
    // } catch (pricingError) {
    //   // If country pricing not found, use QuickPurchase pricing as fallback
    //   logger.warn("Country pricing not found, using QuickPurchase pricing", {
    //     waId,
    //     countryCode: userCountryCode,
    //     error: pricingError instanceof Error ? pricingError.message : undefined,
    //     fallbackPrice: pick.price,
    //     fallbackCurrency: pick.currency,
    //   });
    //   // Keep original price and currency
    // }
    
    logger.info("Using free pricing (temporary)", {
      waId,
      countryCode: userCountryCode,
      price: finalPrice,
      currency: finalCurrency,
      note: "Pricing code preserved for future use",
    });

    // Type-safe: we know these exist because of the check above
    const quickPurchaseId = pick.quickPurchaseId;
    const market = pick.market || "1X2";
    const tip = pick.tip || "Win";

    // Determine payment gateway based on country
    const paymentGatewayType = getPaymentGatewayType(userCountryCode);
    const gateway = createPaymentGateway(userCountryCode);

    // Create payment session using appropriate gateway
    const paymentSession = await gateway.createPaymentSession({
      amount: finalPrice,
      currency: finalCurrency,
      description: `SnapBet Pick: ${pick.homeTeam} vs ${pick.awayTeam} - ${market} - ${tip}`,
      metadata: {
        waId: waUser.waId,
        matchId: pick.matchId,
        quickPurchaseId: quickPurchaseId,
        source: "whatsapp",
      },
      successUrl: `${BASE_URL}/whatsapp/payment/success?session_id={SESSION_ID}`,
      cancelUrl: `${BASE_URL}/whatsapp/payment/cancel`,
      expiresAt: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    // Create WhatsAppPurchase record
    await prisma.whatsAppPurchase.create({
      data: {
        waUserId: waUser.id,
        quickPurchaseId: quickPurchaseId,
        amount: finalPrice,
        currency: finalCurrency,
        paymentGateway: paymentGatewayType,
        paymentSessionId: paymentSession.sessionId,
        pesapalOrderTrackingId: paymentGatewayType === 'pesapal' ? paymentSession.sessionId : null,
        pesapalMerchantReference: paymentSession.merchantReference || null,
        status: "pending",
      },
    });

    logger.info("Created WhatsApp payment session", {
      waId: waUser.waId,
      matchId,
      gateway: paymentGatewayType,
      sessionId: paymentSession.sessionId,
    });

    // Create short URL for WhatsApp (cleaner than full payment URL)
    const baseUrl = BASE_URL.replace(/\/$/, ""); // Remove trailing slash
    const shortUrl = `${baseUrl}/whatsapp/pay/${paymentSession.sessionId}`;

    return {
      paymentUrl: shortUrl,
      sessionId: paymentSession.sessionId,
    };
  } catch (error) {
    logger.error("Error creating WhatsApp payment session", {
      waId,
      matchId,
      error: error instanceof Error ? error.message : undefined,
    });
    throw error;
  }
}

/**
 * Create Stripe Checkout Session for WhatsApp VIP subscription
 */
export async function createWhatsAppVIPSubscriptionSession(params: {
  waId: string;
  packageType: "weekend_pass" | "weekly_pass" | "monthly_sub";
}): Promise<{ paymentUrl: string; sessionId: string }> {
  const { waId, packageType } = params;

  try {
    // Get or create WhatsAppUser
    const waUser = await getOrCreateWhatsAppUser(waId);
    const userCountryCode = waUser.countryCode || getCountryCodeFromPhone(waId, "US");

    // Get country-specific pricing
    const countryPricing = await getDbCountryPricing(userCountryCode, packageType);
    
    // Get package offer details
    const packageOffer = await prisma.packageOffer.findFirst({
      where: {
        packageType,
        isActive: true,
      },
      include: {
        countryPrices: {
          where: {
            country: {
              code: userCountryCode,
            },
            isActive: true,
          },
        },
      },
    });

    if (!packageOffer) {
      throw new Error(`Package offer not found for type: ${packageType}`);
    }

    // Use country-specific price if available, otherwise use pricing service
    const countryPrice = packageOffer.countryPrices[0];
    const finalPrice = countryPrice 
      ? Number(countryPrice.price) 
      : countryPricing.price;
    const finalCurrency = countryPrice 
      ? countryPrice.currencyCode 
      : countryPricing.currencyCode;

    // Package type display names
    const packageNames: Record<string, string> = {
      weekend_pass: "Weekend Package (Fri-Sun)",
      weekly_pass: "Weekly Package (7 days)",
      monthly_sub: "Monthly VIP Subscription",
    };

    const packageName = packageNames[packageType] || "VIP Package";

    // Determine payment gateway based on country
    const paymentGatewayType = getPaymentGatewayType(userCountryCode);
    const gateway = createPaymentGateway(userCountryCode);

    // Create payment session using appropriate gateway
    const paymentSession = await gateway.createPaymentSession({
      amount: finalPrice,
      currency: finalCurrency,
      description: `SnapBet ${packageName}`,
      metadata: {
        waId: waUser.waId,
        packageType,
        packageOfferId: packageOffer.id,
        countryId: countryPrice?.countryId || userCountryCode,
        source: "whatsapp",
        purchaseType: "vip_subscription",
      },
      successUrl: `${BASE_URL}/whatsapp/payment/success?session_id={SESSION_ID}`,
      cancelUrl: `${BASE_URL}/whatsapp/payment/cancel`,
      expiresAt: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    logger.info("Created WhatsApp VIP subscription session", {
      waId: waUser.waId,
      packageType,
      gateway: paymentGatewayType,
      sessionId: paymentSession.sessionId,
      price: finalPrice,
      currency: finalCurrency,
    });

    // Create short URL for WhatsApp
    const baseUrl = BASE_URL.replace(/\/$/, "");
    const shortUrl = `${baseUrl}/whatsapp/pay/${paymentSession.sessionId}`;

    return {
      paymentUrl: shortUrl,
      sessionId: paymentSession.sessionId,
    };
  } catch (error) {
    logger.error("Error creating WhatsApp VIP subscription session", {
      waId,
      packageType,
      error: error instanceof Error ? error.message : undefined,
    });
    throw error;
  }
}

/**
 * Format pick details for delivery message
 * Includes full predictionData structure similar to /match/[id] page
 * Optimized to stay under 4000 characters for WhatsApp
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
  consensusOdds?: { home: number; draw: number; away: number };
  isConsensusOdds?: boolean;
  primaryBook?: string;
  booksCount?: number;
  predictionData?: any;
}): string {
  const confidencePct = Math.round(pick.confidence);
  const valueText = pick.valueRating
    ? `⭐ Value: ${pick.valueRating}`
    : "";

  const lines: string[] = [];
  lines.push("Here's your AI analysis 🤖", "");
  lines.push(`Match ID: ${pick.matchId}`);
  lines.push(`🏆 ${pick.homeTeam} vs ${pick.awayTeam}`);
  lines.push("");

  // Basic prediction info
  lines.push("📊 PREDICTION:");
  lines.push(`Market: ${pick.market}`);
  lines.push(`Tip: ${pick.tip}`);
  lines.push(`Confidence: ${confidencePct}%`);
  if (valueText) lines.push(valueText);
  lines.push("");

  // Extract analysis data (prioritize analysis.explanation and team_analysis)
  const analysis = pick.predictionData?.analysis;
  const comprehensiveAnalysis = pick.predictionData?.comprehensive_analysis || 
                               pick.predictionData?.prediction?.comprehensive_analysis;

  // Analysis Explanation
  if (analysis?.explanation) {
    lines.push("📝 ANALYSIS:");
    // Truncate explanation if too long (max 500 chars to save space)
    let explanation = analysis.explanation;
    if (explanation.length > 500) {
      explanation = explanation.substring(0, 497) + "...";
    }
    lines.push(explanation);
    lines.push("");
  }

  // Team Analysis
  const teamAnalysis = analysis?.team_analysis || comprehensiveAnalysis?.ai_verdict?.team_analysis;
  
  if (teamAnalysis) {
    // Home Team Analysis
    if (teamAnalysis.home_team) {
      const homeTeam = teamAnalysis.home_team;
      lines.push(`🏠 ${pick.homeTeam}:`);
      
      if (homeTeam.strengths && Array.isArray(homeTeam.strengths) && homeTeam.strengths.length > 0) {
        lines.push(`✅ Strengths: ${homeTeam.strengths.join(", ")}`);
      }
      if (homeTeam.weaknesses && Array.isArray(homeTeam.weaknesses) && homeTeam.weaknesses.length > 0) {
        lines.push(`⚠️ Weaknesses: ${homeTeam.weaknesses.join(", ")}`);
      }
      if (homeTeam.injury_impact) {
        lines.push(`🏥 Injuries: ${homeTeam.injury_impact}`);
      }
      lines.push("");
    }

    // Away Team Analysis
    if (teamAnalysis.away_team) {
      const awayTeam = teamAnalysis.away_team;
      lines.push(`✈️ ${pick.awayTeam}:`);
      
      if (awayTeam.strengths && Array.isArray(awayTeam.strengths) && awayTeam.strengths.length > 0) {
        lines.push(`✅ Strengths: ${awayTeam.strengths.join(", ")}`);
      }
      if (awayTeam.weaknesses && Array.isArray(awayTeam.weaknesses) && awayTeam.weaknesses.length > 0) {
        lines.push(`⚠️ Weaknesses: ${awayTeam.weaknesses.join(", ")}`);
      }
      if (awayTeam.injury_impact) {
        lines.push(`🏥 Injuries: ${awayTeam.injury_impact}`);
      }
      lines.push("");
    }
  }

  // Confidence Factors
  const confidenceFactors = analysis?.confidence_factors || 
                           comprehensiveAnalysis?.ai_verdict?.confidence_factors ||
                           comprehensiveAnalysis?.confidence_factors;
  
  if (confidenceFactors && Array.isArray(confidenceFactors) && confidenceFactors.length > 0) {
    lines.push("🔑 CONFIDENCE FACTORS:");
    // Limit to first 5 factors to save space
    const factorsToShow = confidenceFactors.slice(0, 5);
    factorsToShow.forEach((factor: string, idx: number) => {
      lines.push(`${idx + 1}. ${factor}`);
    });
    if (confidenceFactors.length > 5) {
      lines.push(`... and ${confidenceFactors.length - 5} more factors`);
    }
    lines.push("");
  }

  // Asian Handicap Analysis
  const additionalMarkets = pick.predictionData?.additional_markets;
  const additionalMarketsV2 = pick.predictionData?.additional_markets_v2;
  
  if (additionalMarketsV2?.asian_handicap || additionalMarkets?.asian_handicap) {
    lines.push("⚖️ ASIAN HANDICAP:");
    
    const ahV2 = additionalMarketsV2?.asian_handicap;
    const ahV1 = additionalMarkets?.asian_handicap;
    
    // Show most common handicap lines: -0.5, +0.5, -1.0, +1.0
    if (ahV2?.home?._minus_0_5) {
      const winProb = (ahV2.home._minus_0_5.win * 100).toFixed(1);
      const loseProb = (ahV2.home._minus_0_5.lose * 100).toFixed(1);
      lines.push(`Home -0.5: Win ${winProb}% | Lose ${loseProb}%`);
    } else if (ahV1?.["home_-0.5"]) {
      const prob = (ahV1["home_-0.5"] * 100).toFixed(1);
      lines.push(`Home -0.5: ${prob}%`);
    }
    
    if (ahV2?.away?._plus_0_5) {
      const winProb = (ahV2.away._plus_0_5.win * 100).toFixed(1);
      const loseProb = (ahV2.away._plus_0_5.lose * 100).toFixed(1);
      lines.push(`Away +0.5: Win ${winProb}% | Lose ${loseProb}%`);
    } else if (ahV1?.["away_+0.5"]) {
      const prob = (ahV1["away_+0.5"] * 100).toFixed(1);
      lines.push(`Away +0.5: ${prob}%`);
    }
    
    if (ahV2?.home?._minus_1) {
      const winProb = (ahV2.home._minus_1.win * 100).toFixed(1);
      const loseProb = (ahV2.home._minus_1.lose * 100).toFixed(1);
      const pushProb = ahV2.home._minus_1.push ? (ahV2.home._minus_1.push * 100).toFixed(1) : null;
      if (pushProb) {
        lines.push(`Home -1.0: Win ${winProb}% | Lose ${loseProb}% | Push ${pushProb}%`);
      } else {
        lines.push(`Home -1.0: Win ${winProb}% | Lose ${loseProb}%`);
      }
    } else if (ahV1?.["home_-1.0"]) {
      const prob = (ahV1["home_-1.0"] * 100).toFixed(1);
      lines.push(`Home -1.0: ${prob}%`);
    }
    
    if (ahV2?.away?._plus_1) {
      const winProb = (ahV2.away._plus_1.win * 100).toFixed(1);
      const loseProb = (ahV2.away._plus_1.lose * 100).toFixed(1);
      const pushProb = ahV2.away._plus_1.push ? (ahV2.away._plus_1.push * 100).toFixed(1) : null;
      if (pushProb) {
        lines.push(`Away +1.0: Win ${winProb}% | Lose ${loseProb}% | Push ${pushProb}%`);
      } else {
        lines.push(`Away +1.0: Win ${winProb}% | Lose ${loseProb}%`);
      }
    }
    
    lines.push("");
  }

  // AI Verdict (if available and not already covered)
  if (comprehensiveAnalysis?.ai_verdict && !analysis?.explanation) {
    lines.push("🤖 AI VERDICT:");
    if (comprehensiveAnalysis.ai_verdict.recommended_outcome) {
      lines.push(`Recommended: ${comprehensiveAnalysis.ai_verdict.recommended_outcome}`);
    }
    if (comprehensiveAnalysis.ai_verdict.confidence_level) {
      lines.push(`Confidence Level: ${comprehensiveAnalysis.ai_verdict.confidence_level}`);
    }
    lines.push("");
  }

  if (comprehensiveAnalysis) {

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

  // Additional Markets (Total Goals, Both Teams Score)
  if (additionalMarketsV2 || additionalMarkets) {
    const hasTotalGoals = additionalMarketsV2?.total_goals || additionalMarkets?.total_goals;
    const hasBothTeamsScore = additionalMarketsV2?.both_teams_score || additionalMarkets?.both_teams_score;
    
    if (hasTotalGoals || hasBothTeamsScore) {
      lines.push("🎯 ADDITIONAL MARKETS:");
      
      // Total Goals (Over/Under 2.5)
      if (hasTotalGoals) {
        const totalGoals = additionalMarketsV2?.total_goals || additionalMarkets?.total_goals;
        if (totalGoals) {
          // Check for over_2_5 and under_2_5
          const over25 = totalGoals['over_2_5'] || totalGoals['over_2.5'] || totalGoals['over_2_5_goals'];
          const under25 = totalGoals['under_2_5'] || totalGoals['under_2.5'] || totalGoals['under_2_5_goals'];
          
          if (over25 !== undefined) {
            lines.push(`Over 2.5 Goals: ${(over25 * 100).toFixed(1)}%`);
          }
          if (under25 !== undefined) {
            lines.push(`Under 2.5 Goals: ${(under25 * 100).toFixed(1)}%`);
          }
        }
      }
      
      // Both Teams Score
      if (hasBothTeamsScore) {
        const btts = additionalMarketsV2?.both_teams_score || additionalMarkets?.both_teams_score;
        if (btts) {
          if (btts.yes !== undefined) {
            lines.push(`Both Teams Score (Yes): ${(btts.yes * 100).toFixed(1)}%`);
          }
          if (btts.no !== undefined) {
            lines.push(`Both Teams Score (No): ${(btts.no * 100).toFixed(1)}%`);
          }
        }
      }
      
      lines.push("");
    }
  }

  lines.push("💵 Stake suggestion: 1-3% of bankroll");
  lines.push("(Not financial advice)", "");
  lines.push("Good luck 🍀");

  // Join and check message length (WhatsApp limit is 4096, we aim for 4000)
  let message = lines.join("\n");
  
  if (message.length > 4000) {
    // Truncate message intelligently - keep important sections, remove less critical ones
    const truncatedLines: string[] = [];
    let currentLength = 0;
    const maxLength = 3900; // Leave room for truncation notice
    
    // Always include header and basic prediction
    const essentialSections = lines.slice(0, 10); // Header + prediction + odds
    truncatedLines.push(...essentialSections);
    currentLength = essentialSections.join("\n").length;
    
    // Add analysis sections in priority order until we hit limit
    const prioritySections = [
      ...lines.slice(10).filter(line => line.includes("ANALYSIS:") || line.includes("🏠") || line.includes("✈️") || line.includes("CONFIDENCE FACTORS:"))
    ];
    
    for (const section of prioritySections) {
      const sectionIndex = lines.indexOf(section);
      if (sectionIndex === -1) continue;
      
      // Find where this section ends (next section header or end)
      let sectionEnd = lines.length;
      for (let i = sectionIndex + 1; i < lines.length; i++) {
        if (lines[i].match(/^[🏠✈️📝🔑🤖📈🧠💡⚠️🎯]/) && i > sectionIndex + 2) {
          sectionEnd = i;
          break;
        }
      }
      
      const sectionLines = lines.slice(sectionIndex, sectionEnd);
      const sectionText = sectionLines.join("\n");
      
      if (currentLength + sectionText.length + 50 > maxLength) {
        // Truncate this section if needed
        const remainingSpace = maxLength - currentLength - 50;
        if (remainingSpace > 100) {
          truncatedLines.push(...sectionLines.slice(0, Math.floor(remainingSpace / 30)));
        }
        break;
      }
      
      truncatedLines.push(...sectionLines);
      currentLength += sectionText.length;
    }
    
    message = truncatedLines.join("\n");
    if (message.length > 4000) {
      message = message.substring(0, 3900);
      const lastNewline = message.lastIndexOf("\n");
      if (lastNewline > 0) {
        message = message.substring(0, lastNewline);
      }
    }
    message += "\n\n... (message truncated due to length limit)";
  }

  return message;
}

