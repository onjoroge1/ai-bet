import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendWhatsAppText, formatPhoneNumber } from "@/lib/whatsapp-service";
import {
  getTodaysPicks,
  formatPicksList,
  getPickByMatchId,
} from "@/lib/whatsapp-picks";
import { formatPickDeliveryMessage } from "@/lib/whatsapp-payment";
import { getMainMenuMessage, getHelpMessage, getWelcomeMessage } from "@/lib/whatsapp-messages";
import { hasWhatsAppPremiumAccess } from "@/lib/whatsapp-premium";
import { validateMatchId } from "@/lib/whatsapp-validation";
import {
  getBTTSPicksMessage,
  getBTTSForMatchMessage,
  getOversPicksMessage,
  getOversForMatchMessage,
  getUndersPicksMessage,
  getUndersForMatchMessage,
  getCorrectScorePicksMessage,
  getCorrectScoreForMatchMessage,
  getReasonForMatchMessage,
  getRiskForMatchMessage,
  getConfidenceForMatchMessage,
  getValueForMatchMessage,
  getAltForMatchMessage,
  getStatsForMatchMessage,
  getMoreForMatchMessage,
} from "./helper-functions";
import prisma from "@/lib/db";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/test-command
 * Test endpoint to simulate WhatsApp menu commands
 * 
 * Body: {
 *   to: string (phone number)
 *   command: string ("1", "2", "3", "menu", or matchId)
 *   matchId?: string (required if command is "2")
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, command, matchId } = body;

    if (!to || !command) {
      return NextResponse.json(
        { error: "Missing required fields: 'to' and 'command'" },
        { status: 400 }
      );
    }

    // Format phone number to E.164
    const formattedPhone = formatPhoneNumber(to);
    if (!formattedPhone) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    const lowerCommand = command.toLowerCase().trim();
    let messageToSend: string;
    let commandType: string;

    try {
      // Handle menu commands (same logic as webhook)
      if (["menu", "hi", "hello", "hey", "0", "start"].includes(lowerCommand)) {
        commandType = "menu";
        messageToSend = getMainMenuMessage();
      }
      // FREE COMMANDS
      
      // Command "1" - Today's picks (same logic as sendTodaysPicks in webhook)
      else if (lowerCommand === "1" || lowerCommand === "picks" || lowerCommand === "today") {
        commandType = "picks";
        
        const picks = await getTodaysPicks();
        
        if (!picks || picks.length === 0) {
          messageToSend = "No picks available for today yet. Check back later 🔄";
        } else {
          messageToSend = formatPicksList(picks);
          
          // Check message length before sending (WhatsApp limit is 4096 characters)
          // Same logic as sendTodaysPicks in webhook
          const WHATSAPP_MAX_LENGTH = 4096;
          if (messageToSend.length > WHATSAPP_MAX_LENGTH) {
            // Dynamically reduce picks until message fits
            let reducedPicks = picks;
            let reducedMessage = messageToSend;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (reducedMessage.length > WHATSAPP_MAX_LENGTH && attempts < maxAttempts && reducedPicks.length > 1) {
              attempts++;
              // Reduce by 1 pick each time
              reducedPicks = reducedPicks.slice(0, reducedPicks.length - 1);
              reducedMessage = formatPicksList(reducedPicks, reducedPicks.length);
            }
            
            if (reducedMessage.length <= WHATSAPP_MAX_LENGTH && reducedPicks.length > 0) {
              messageToSend = reducedMessage;
            } else {
              // Even with 1 pick, message is too long (shouldn't happen, but safety check)
              messageToSend = "Sorry, there are too many picks to display. Please try again later or contact support.";
            }
          }
        }
      }
      // Command "2" - Popular matches (only if it's just "2", not "2 [matchId]")
      else if (lowerCommand === "2" && !lowerCommand.includes(" ")) {
        commandType = "popular";
        messageToSend = [
          "📊 **POPULAR MATCHES**",
          "",
          "Popular matches feature coming soon!",
          "",
          "Send '1' to see today's picks instead.",
        ].join("\n");
      }
      // Command "3" - Help
      else if (lowerCommand === "3" || lowerCommand === "help") {
        commandType = "help";
        messageToSend = getHelpMessage();
      }
      // Command "FREE" - Free tier options
      else if (lowerCommand === "free") {
        commandType = "free";
        messageToSend = [
          "🆓 **FREE TIER OPTIONS**",
          "",
          "**Available Commands:**",
          "",
          "**1** - Today's free picks",
          "**2** - Popular matches",
          "**TODAY** - Free picks summary",
          "**MENU** - All options",
          "**HELP** - How SnapBet works",
          "",
          "**Or send a Match ID** to get sample AI analysis",
          "Example: 1379099",
          "",
          "💡 Upgrade to VIP for premium picks, parlays, and more!",
          "Send 'VIP' to see pricing.",
        ].join("\n");
      }
      // Command "HOW" - How SnapBet works
      else if (lowerCommand === "how") {
        commandType = "how";
        messageToSend = [
          "🤖 **HOW SNAPBET AI WORKS**",
          "",
          "**Our AI System:**",
          "• Analyzes 100+ data points per match",
          "• Team form, injuries, head-to-head records",
          "• Market odds vs our probability models",
          "• Machine learning ensemble predictions",
          "",
          "Send 'VIP' to see premium features!",
        ].join("\n");
      }
      // Command "LEAGUES" - Supported leagues
      else if (lowerCommand === "leagues") {
        commandType = "leagues";
        messageToSend = [
          "📋 **SUPPORTED LEAGUES**",
          "",
          "We cover top leagues worldwide including:",
          "• Premier League",
          "• La Liga",
          "• Bundesliga",
          "• Serie A",
          "• Ligue 1",
          "• Champions League",
          "• And many more!",
          "",
          "Send '1' to see today's matches.",
        ].join("\n");
      }
      // Command "STATS" - Basic stats
      else if (lowerCommand === "stats" || lowerCommand === "statistics") {
        commandType = "stats";
        messageToSend = [
          "📊 **BASIC STATS & TRENDS**",
          "",
          "**What We Track:**",
          "• Team form (last 5 matches)",
          "• Home/Away performance",
          "• Goals scored/conceded",
          "• Head-to-head records",
          "",
          "Send a Match ID to see stats for that match!",
        ].join("\n");
      }
      // PREMIUM COMMANDS
      
      // Command "VIP" - VIP pricing
      else if (lowerCommand === "vip") {
        commandType = "vip";
        messageToSend = [
          "💎 **VIP PRICING & PLANS**",
          "",
          "**VIP Benefits:**",
          "• Premium AI picks (V2/V3 models)",
          "• Parlay builder (3-6 matches)",
          "• Correct score predictions",
          "• Both Teams To Score (BTTS)",
          "• Over/Under goals analysis",
          "• Weekend mega packs",
          "",
          "**Pricing:**",
          "• Monthly: $29.99/month",
          "• Annual: $299/year (Save $60!)",
          "",
          "Send 'BUY' to see payment options.",
        ].join("\n");
      }
      // Command "BUY" - Payment options
      else if (lowerCommand === "buy") {
        commandType = "buy";
        // Use the same function as the webhook
        try {
          const { createWhatsAppVIPSubscriptionSession } = await import("@/lib/whatsapp-payment");
          const { getDbCountryPricing } = await import("@/lib/server-pricing-service");
          const { formatPhoneNumber } = await import("@/lib/whatsapp-service");
          
          const formattedPhone = formatPhoneNumber(to);
          if (!formattedPhone) {
            messageToSend = "Invalid phone number format";
            return;
          }

          // Get user country (default to US)
          // TODO: Could be enhanced to detect from phone number or fetch from WhatsAppUser
          let countryCode: string = "US";
          
          // Get pricing
          const weekendPrice = await getDbCountryPricing(countryCode, "weekend_pass");
          const weeklyPrice = await getDbCountryPricing(countryCode, "weekly_pass");
          const monthlyPrice = await getDbCountryPricing(countryCode, "monthly_sub");

          // Create payment sessions
          const weekendSession = await createWhatsAppVIPSubscriptionSession({
            waId: formattedPhone,
            packageType: "weekend_pass",
          });

          const weeklySession = await createWhatsAppVIPSubscriptionSession({
            waId: formattedPhone,
            packageType: "weekly_pass",
          });

          const monthlySession = await createWhatsAppVIPSubscriptionSession({
            waId: formattedPhone,
            packageType: "monthly_sub",
          });

          const paymentMethods = [
            "**Payment Methods:**",
            "• Credit/Debit Card (Stripe)",
          ];
          
          if (countryCode === "KE") {
            paymentMethods.push("• M-PESA (Mobile Money)");
          }
          if (countryCode === "NG") {
            paymentMethods.push("• Paystack (Card & Bank)");
          }

          messageToSend = [
            "**VIP SUBSCRIPTION PLANS**",
            "",
            "",
            `**Your Country:** ${countryCode}`,
            "",
            "",
            "**Available Plans:**",
            "",
            "",
            "1️⃣ **WEEKEND PACK** (Fri-Sun)",
            "",
            `   ${weekendPrice.currencySymbol}${weekendPrice.price.toFixed(2)}`,
            "",
            "   • 5 premium picks",
            "",
            "   • Valid for 3 days",
            "",
            weekendSession.paymentUrl,
            "",
            "",
            "",
            "2️⃣ **WEEKLY PACK** (7 days)",
            "",
            `   ${weeklyPrice.currencySymbol}${weeklyPrice.price.toFixed(2)}`,
            "",
            "   • 8 premium picks",
            "",
            "   • Valid for 7 days",
            "",
            weeklySession.paymentUrl,
            "",
            "",
            "",
            "3️⃣ **MONTHLY VIP** (30 days)",
            "",
            `   ${monthlyPrice.currencySymbol}${monthlyPrice.price.toFixed(2)}`,
            "",
            "   • Unlimited premium picks",
            "",
            "   • Valid for 30 days",
            "",
            monthlySession.paymentUrl,
            "",
            "",
            "",
            ...paymentMethods,
            "",
            "💡 Click any link above to purchase. Links expire in 30 minutes.",
            "",
            "",
            "**Or buy individual picks:**",
            "",
            "Send a Match ID to purchase that pick",
            "",
            "Example: 1379099",
          ].filter(Boolean).join("\n");
        } catch (error) {
          messageToSend = "Sorry, couldn't create payment links. Please try again or send 'WEEKEND', 'WEEKLY', or 'MONTHLY' for specific plans.";
        }
      }
      // Command "VIP PICKS" - Premium picks
      else if (lowerCommand === "vip picks" || lowerCommand === "vippicks") {
        commandType = "vip-picks";
        messageToSend = [
          "🔒 **VIP ACCESS REQUIRED**",
          "",
          "This feature requires VIP membership.",
          "",
          "Send 'VIP' to see pricing and upgrade.",
        ].join("\n");
      }
      // Command "PARLAY" - Parlay builder
      else if (lowerCommand === "parlay" || lowerCommand === "parlays") {
        commandType = "parlay";
        messageToSend = [
          "🔒 **VIP ACCESS REQUIRED**",
          "",
          "Parlay builder requires VIP membership.",
          "",
          "Send 'VIP' to see pricing and upgrade.",
        ].join("\n");
      }
      // Command "CS" - Correct scores (browse or match mode)
      else if (lowerCommand.startsWith("cs") || lowerCommand.startsWith("correct score")) {
        commandType = "cs";
        const parts = command.split(/\s+/);
        if (parts.length > 1) {
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getCorrectScoreForMatchMessage(matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          messageToSend = await getCorrectScorePicksMessage();
        }
      }
      // Command "REASON" - Team analysis
      else if (lowerCommand.startsWith("reason")) {
        commandType = "reason";
        const parts = command.split(/\s+/);
        if (parts.length > 1) {
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getReasonForMatchMessage(matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          messageToSend = "Please provide a Match ID.\n\nExample: REASON 1378986\n\nSend '1' to see available matches.";
        }
      }
      // Command "RISK" - Risk assessment
      else if (lowerCommand.startsWith("risk")) {
        commandType = "risk";
        const parts = command.split(/\s+/);
        if (parts.length > 1) {
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getRiskForMatchMessage(matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          messageToSend = "Please provide a Match ID.\n\nExample: RISK 1378986\n\nSend '1' to see available matches.";
        }
      }
      // Command "CONFIDENCE" - Probability breakdown
      else if (lowerCommand.startsWith("confidence")) {
        commandType = "confidence";
        const parts = command.split(/\s+/);
        if (parts.length > 1) {
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getConfidenceForMatchMessage(matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          messageToSend = "Please provide a Match ID.\n\nExample: CONFIDENCE 1378986\n\nSend '1' to see available matches.";
        }
      }
      // Command "VALUE" - Value assessment
      else if (lowerCommand.startsWith("value")) {
        commandType = "value";
        const parts = command.split(/\s+/);
        if (parts.length > 1) {
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getValueForMatchMessage(matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          messageToSend = "Please provide a Match ID.\n\nExample: VALUE 1378986\n\nSend '1' to see available matches.";
        }
      }
      // Command "ALT" - Alternative bets
      else if (lowerCommand.startsWith("alt")) {
        commandType = "alt";
        const parts = command.split(/\s+/);
        if (parts.length > 1) {
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getAltForMatchMessage(matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          messageToSend = "Please provide a Match ID.\n\nExample: ALT 1378986\n\nSend '1' to see available matches.";
        }
      }
      // Command "STATS [MATCHID]" - Match stats
      else if (lowerCommand.startsWith("stats ")) {
        commandType = "stats-match";
        const parts = command.split(/\s+/);
        if (parts.length > 1) {
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getStatsForMatchMessage(matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          messageToSend = "Please provide a Match ID.\n\nExample: STATS 1378986\n\nSend '1' to see available matches.";
        }
      }
      // Command "MORE" - All markets
      else if (lowerCommand.startsWith("more")) {
        commandType = "more";
        const parts = command.split(/\s+/);
        if (parts.length > 1) {
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getMoreForMatchMessage(matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          messageToSend = "Please provide a Match ID.\n\nExample: MORE 1378986\n\nSend '1' to see available matches.";
        }
      }
      // Command "BTTS" - Both teams to score (browse or match mode)
      else if (lowerCommand.startsWith("btts")) {
        commandType = "btts";
        const parts = command.split(/\s+/);
        if (parts.length > 1 && parts[1] !== "more") {
          // Match mode: BTTS [Match ID]
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getBTTSForMatchMessage(formattedPhone, matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          // Browse mode: BTTS or BTTS MORE
          const isMore = lowerCommand.includes("more");
          messageToSend = await getBTTSPicksMessage(formattedPhone, isMore ? 1 : 0);
        }
      }
      // Command "OVERS" - Over/Under goals (browse or match mode)
      else if (lowerCommand.startsWith("overs") || lowerCommand.startsWith("over under") || lowerCommand.startsWith("overunder")) {
        commandType = "overs";
        const parts = command.split(/\s+/);
        if (parts.length > 1 && parts[1] !== "more") {
          // Match mode: OVERS [Match ID]
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getOversForMatchMessage(formattedPhone, matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          // Browse mode: OVERS or OVERS MORE
          const isMore = lowerCommand.includes("more");
          messageToSend = await getOversPicksMessage(formattedPhone, isMore ? 1 : 0);
        }
      }
      // Command "UNDERS" - Under goals (browse or match mode)
      else if (lowerCommand.startsWith("unders") || lowerCommand.startsWith("under")) {
        commandType = "unders";
        const parts = command.split(/\s+/);
        if (parts.length > 1 && parts[1] !== "more") {
          // Match mode: UNDERS [Match ID]
          const matchId = parts[1];
          const matchIdValidation = validateMatchId(matchId);
          if (matchIdValidation.valid && matchIdValidation.normalized) {
            messageToSend = await getUndersForMatchMessage(formattedPhone, matchIdValidation.normalized);
          } else {
            messageToSend = `Invalid Match ID: ${matchId}. Send '1' to see available matches.`;
          }
        } else {
          // Browse mode: UNDERS or UNDERS MORE
          const isMore = lowerCommand.includes("more");
          messageToSend = await getUndersPicksMessage(formattedPhone, isMore ? 1 : 0);
        }
      }
      // Command "WEEKEND" - Weekend pack
      else if (lowerCommand === "weekend") {
        commandType = "weekend";
        messageToSend = [
          "🔒 **VIP ACCESS REQUIRED**",
          "",
          "Weekend packs require VIP membership.",
          "",
          "Send 'VIP' to see pricing and upgrade.",
        ].join("\n");
      }
      // Command "V3" - Highest accuracy picks
      else if (lowerCommand === "v3") {
        commandType = "v3";
        messageToSend = [
          "🔒 **VIP ACCESS REQUIRED**",
          "",
          "V3 picks require VIP membership.",
          "",
          "Send 'VIP' to see pricing and upgrade.",
        ].join("\n");
      }
      // Command "AUTO" - Auto subscription
      else if (lowerCommand === "auto") {
        commandType = "auto";
        messageToSend = [
          "🔄 **AUTO DAILY PICKS SUBSCRIPTION**",
          "",
          "**Pricing:**",
          "• $9.99/week",
          "• $29.99/month (Best value!)",
          "",
          "Visit https://www.snapbet.bet/vip to subscribe.",
        ].join("\n");
      }
      // Command "STATUS" - VIP status
      else if (lowerCommand === "status") {
        commandType = "status";
        messageToSend = [
          "📊 **YOUR VIP STATUS**",
          "",
          "❌ No VIP Access",
          "",
          "Send 'VIP' to see pricing and upgrade.",
        ].join("\n");
      }
      // Command "2" with matchId - Buy pick (needs matchId)
      else if (lowerCommand.startsWith("2")) {
        commandType = "buy";
        const matchIdToUse = matchId || lowerCommand.split(/\s+/)[1];
        
        if (!matchIdToUse) {
          messageToSend = [
            "To buy a pick 💰",
            "",
            "Send the matchId directly:",
            "Example: 123456",
            "",
            "Or send '1' to see available picks.",
          ].join("\n");
        } else {
          // TEMPORARY: Skip payment and directly send full AI analysis from QuickPurchase
          const quickPurchase = await prisma.quickPurchase.findUnique({
            where: { matchId: matchIdToUse },
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
            messageToSend = `Match ID ${matchIdToUse} not found in our database. Please send '1' to see available matches.`;
          } else {
            // Extract match and prediction data (same as handleBuyByMatchId in webhook)
            const matchData = quickPurchase.matchData as
              | {
                  homeTeam?: { name?: string };
                  awayTeam?: { name?: string };
                  league?: { name?: string };
                  startTime?: string;
                }
              | null;

            const predictionData = quickPurchase.predictionData as any;

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

            // Note: Consensus odds fetching removed since we removed odds from the analysis message
            let consensusOdds: { home: number; draw: number; away: number } | undefined;
            let isConsensusOdds = false;
            let primaryBook: string | undefined;
            let booksCount: number | undefined;

            // Format the full AI analysis message (same as handleBuyByMatchId)
            messageToSend = formatPickDeliveryMessage({
              matchId: quickPurchase.matchId!,
              homeTeam,
              awayTeam,
              market,
              tip,
              confidence: quickPurchase.confidenceScore || 75,
              odds: quickPurchase.odds ? Number(quickPurchase.odds) : undefined,
              valueRating: quickPurchase.valueRating || undefined,
              consensusOdds: consensusOdds,
              isConsensusOdds: isConsensusOdds,
              primaryBook: primaryBook,
              booksCount: booksCount,
              predictionData: predictionData,
            });
          }
        }
      }
      // Numeric matchId - treat as purchase request (TEMPORARY: skip payment, send analysis)
      else if (/^\d+$/.test(lowerCommand) && lowerCommand.length >= 4) {
        commandType = "buy";
        
        // TEMPORARY: Skip payment and directly send full AI analysis from QuickPurchase
        const quickPurchase = await prisma.quickPurchase.findUnique({
          where: { matchId: lowerCommand },
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
          messageToSend = `Match ID ${lowerCommand} not found in our database. Please send '1' to see available matches.`;
        } else {
          // Extract match and prediction data (same as handleBuyByMatchId in webhook)
          const matchData = quickPurchase.matchData as
            | {
                homeTeam?: { name?: string };
                awayTeam?: { name?: string };
                league?: { name?: string };
                startTime?: string;
              }
            | null;

          const predictionData = quickPurchase.predictionData as any;

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

          // Note: Consensus odds fetching removed since we removed odds from the analysis message
          let consensusOdds: { home: number; draw: number; away: number } | undefined;
          let isConsensusOdds = false;
          let primaryBook: string | undefined;
          let booksCount: number | undefined;

          // Format the full AI analysis message (same as handleBuyByMatchId)
          messageToSend = formatPickDeliveryMessage({
            matchId: quickPurchase.matchId!,
            homeTeam,
            awayTeam,
            market,
            tip,
            confidence: quickPurchase.confidenceScore || 75,
            odds: quickPurchase.odds ? Number(quickPurchase.odds) : undefined,
            valueRating: quickPurchase.valueRating || undefined,
            consensusOdds: consensusOdds,
            isConsensusOdds: isConsensusOdds,
            primaryBook: primaryBook,
            booksCount: booksCount,
            predictionData: predictionData,
          });
        }
      }
      // Unknown command - show menu
      else {
        commandType = "menu";
        messageToSend = getMainMenuMessage();
      }

      logger.info("Test command processed", {
        to: formattedPhone,
        command: lowerCommand,
        commandType,
        messageLength: messageToSend.length,
      });

      // Send the message via WhatsApp
      const result = await sendWhatsAppText(formattedPhone, messageToSend);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: "WhatsApp message sent successfully",
          to: formattedPhone,
          command: lowerCommand,
          commandType,
          messageLength: messageToSend.length,
          fullMessage: messageToSend,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Failed to send WhatsApp message. Check server logs for details.",
            command: lowerCommand,
            commandType,
            fullMessage: messageToSend, // Return message even if send failed
          },
          { status: 500 }
        );
      }
    } catch (error) {
      logger.error("Error processing test command", {
        to: formattedPhone,
        command: lowerCommand,
        error: error instanceof Error ? error : undefined,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: "Error processing command",
          details: error instanceof Error ? error.message : "Unknown error",
          command: lowerCommand,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("Error in WhatsApp test-command endpoint", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

