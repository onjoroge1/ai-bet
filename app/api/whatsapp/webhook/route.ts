import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendWhatsAppText, sendWhatsAppImage, formatPhoneNumber } from "@/lib/whatsapp-service";
import {
  getTodaysPicks,
  formatPicksList,
  getPickByMatchId,
} from "@/lib/whatsapp-picks";
import { formatPickDeliveryMessage, getOrCreateWhatsAppUser, createWhatsAppVIPSubscriptionSession } from "@/lib/whatsapp-payment";
import { checkWhatsAppRateLimit } from "@/lib/whatsapp-rate-limit";
import { validateMatchId, sanitizeText } from "@/lib/whatsapp-validation";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp-webhook-verification";
import { hasWhatsAppPremiumAccess, getWhatsAppVIPStatus } from "@/lib/whatsapp-premium";
import { getMainMenuMessage, getHelpMessage, getWelcomeMessage } from "@/lib/whatsapp-messages";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'snapbet_verify';

/**
 * GET /api/whatsapp/webhook
 * Webhook verification endpoint for Meta WhatsApp Business API
 * Meta will call this during webhook setup to verify the endpoint
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    logger.debug("WhatsApp webhook verification", {
      mode,
      hasToken: !!token,
      hasChallenge: !!challenge,
    });

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      logger.info("WhatsApp webhook verified successfully");
      return new NextResponse(challenge, { status: 200 });
    }

    logger.warn("WhatsApp webhook verification failed", {
      mode,
      tokenMatch: token === VERIFY_TOKEN,
      hasChallenge: !!challenge,
    });

    return new NextResponse("Verification failed", { status: 403 });
  } catch (error) {
    logger.error("Error during WhatsApp webhook verification", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

/**
 * POST /api/whatsapp/webhook
 * Receives incoming messages and status updates from WhatsApp
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    // Verify webhook signature (only in production or if APP_SECRET is set)
    if (process.env.WHATSAPP_APP_SECRET) {
      if (!verifyWhatsAppWebhookSignature(rawBody, signature)) {
        logger.warn("WhatsApp webhook signature verification failed", {
          hasSignature: !!signature,
        });
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    } else {
      logger.debug("WhatsApp APP_SECRET not set, skipping signature verification");
    }

    const body = JSON.parse(rawBody);
    
    logger.debug("WhatsApp webhook received", {
      object: body?.object,
      entryCount: body?.entry?.length || 0,
    });

    // Verify this is a WhatsApp Business Account webhook
    if (body?.object !== "whatsapp_business_account") {
      logger.debug("Ignoring non-WhatsApp webhook", { object: body?.object });
      return NextResponse.json({ status: "ignored" });
    }

    // Process each entry in the webhook payload
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        // Handle incoming messages
        if (change.field === "messages" && value?.messages) {
          for (const msg of value.messages) {
            const from = msg.from; // User's WhatsApp number
            const text = msg.text?.body; // Message body (if text)
            const messageId = msg.id;
            const timestamp = msg.timestamp;

            logger.info("Received WhatsApp message", {
              from,
              messageId,
              hasText: !!text,
              timestamp,
            });

            if (text) {
              // Sanitize and validate input
              const sanitizedText = sanitizeText(text);
              if (!sanitizedText) {
                logger.warn("Empty or invalid text message", { from });
                return;
              }

              // Check rate limit
              const rateLimit = await checkWhatsAppRateLimit(from);
              if (!rateLimit.allowed) {
                logger.warn("Rate limit exceeded", {
                  from,
                  limit: rateLimit.limit,
                  resetTime: rateLimit.resetTime,
                });
                
                const resetMinutes = Math.ceil((rateLimit.resetTime - Math.floor(Date.now() / 1000)) / 60);
                await sendWhatsAppText(
                  from,
                  `⏱️ Too many requests. Please wait ${resetMinutes} minute(s) before sending more messages.`
                );
                return;
              }

              // Handle incoming text message with menu system
              await handleIncomingText(from, sanitizedText);
            }
          }
        }

        // Handle message status updates (delivered, read, etc.)
        if (change.field === "messages" && value?.statuses) {
          for (const status of value.statuses) {
            logger.debug("WhatsApp message status update", {
              messageId: status.id,
              status: status.status,
              recipientId: status.recipient_id,
            });
          }
        }

        // Handle message template status updates
        if (change.field === "message_template_status_update") {
          logger.debug("WhatsApp template status update", {
            event: value?.event,
            messageTemplateId: value?.message_template_id,
            messageTemplateName: value?.message_template_name,
          });
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("Error processing WhatsApp webhook", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle incoming text message from WhatsApp user
 */
async function handleIncomingText(waId: string, text: string) {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  try {
    // Normalize waId (remove + if present)
    const normalizedWaId = formatPhoneNumber(waId);
    if (!normalizedWaId) {
      logger.warn("Invalid WhatsApp number format", { waId });
      return;
    }

    // Ensure user record exists (create or update)
    try {
      await getOrCreateWhatsAppUser(normalizedWaId);
    } catch (error) {
      logger.error("Error creating/updating WhatsAppUser", {
        waId: normalizedWaId,
        error,
      });
      // Continue processing even if user record creation fails
    }

    // Menu commands
    if (["menu", "hi", "hello", "hey", "0", "start"].includes(lower)) {
      // Check if user is new
      const waUser = await prisma.whatsAppUser.findUnique({
        where: { waId: normalizedWaId },
      });
      const isNewUser = !waUser || 
        (waUser.firstSeenAt.getTime() === waUser.lastSeenAt.getTime() &&
         Date.now() - waUser.firstSeenAt.getTime() < 60000); // Within 1 minute of first seen
      
      if (isNewUser) {
        await sendWelcomeMessage(normalizedWaId);
      } else {
        await sendMainMenu(normalizedWaId);
      }
      return;
    }

    // Purchase history
    if (lower === "4" || lower === "history" || lower === "purchases" || lower === "mypicks") {
      await sendPurchaseHistory(normalizedWaId);
      return;
    }

    // Show picks
    if (lower === "1" || lower === "picks" || lower.startsWith("picks")) {
      logger.info("User requested today's picks", {
        waId: normalizedWaId,
        command: lower,
      });
      await sendTodaysPicks(normalizedWaId);
      return;
    }

    // Help
    if (lower === "3" || lower === "help") {
      await sendHelp(normalizedWaId);
      return;
    }

    // FREE COMMANDS - Available to all users
    
    // Command 2: Popular matches / leagues list
    if (lower === "2" || lower === "popular" || lower === "leagues") {
      await sendPopularMatches(normalizedWaId);
      return;
    }

    // TODAY: Free picks summary (alias of 1)
    if (lower === "today") {
      await sendTodaysPicks(normalizedWaId);
      return;
    }

    // FREE: Re-sends free tier options
    if (lower === "free") {
      await sendFreeTierOptions(normalizedWaId);
      return;
    }

    // HOW: How SnapBet AI predictions work
    if (lower === "how") {
      await sendHowSnapBetWorks(normalizedWaId);
      return;
    }

    // LEAGUES: Supported leagues
    if (lower === "leagues") {
      await sendSupportedLeagues(normalizedWaId);
      return;
    }

    // STATS: Basic team stats / trends
    if (lower === "stats" || lower === "statistics") {
      await sendBasicStats(normalizedWaId);
      return;
    }

    // PREMIUM COMMANDS - Require VIP access
    
    // VIP: Shows VIP pricing & plans
    if (lower === "vip") {
      await sendVIPPricing(normalizedWaId);
      return;
    }

    // BUY: Payment options by country
    if (lower === "buy") {
      await sendPaymentOptions(normalizedWaId);
      return;
    }

    // VIP PICKS: Daily premium AI picks
    if (lower === "vip picks" || lower === "vippicks") {
      const premiumStatus = await hasWhatsAppPremiumAccess(normalizedWaId);
      if (!premiumStatus.hasAccess) {
        await sendVIPRequiredMessage(normalizedWaId);
        return;
      }
      await sendVIPPicks(normalizedWaId);
      return;
    }

    // V2: High-accuracy ML model picks
    if (lower === "v2") {
      const premiumStatus = await hasWhatsAppPremiumAccess(normalizedWaId);
      if (!premiumStatus.hasAccess) {
        await sendVIPRequiredMessage(normalizedWaId);
        return;
      }
      await sendV2Picks(normalizedWaId);
      return;
    }

    // V3: Ensemble / highest-confidence picks
    if (lower === "v3") {
      const premiumStatus = await hasWhatsAppPremiumAccess(normalizedWaId);
      if (!premiumStatus.hasAccess) {
        await sendVIPRequiredMessage(normalizedWaId);
        return;
      }
      await sendV3Picks(normalizedWaId);
      return;
    }

    // PARLAY: AI-built parlay (3-6 matches)
    if (lower === "parlay" || lower === "parlays") {
      const premiumStatus = await hasWhatsAppPremiumAccess(normalizedWaId);
      if (!premiumStatus.hasAccess) {
        await sendVIPRequiredMessage(normalizedWaId);
        return;
      }
      await sendParlayPicks(normalizedWaId);
      return;
    }

    // CS: Correct score predictions (browse or match mode)
    if (lower.startsWith("cs") || lower.startsWith("correct score") || lower.startsWith("correctscore")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1) {
        // Match mode: CS [Match ID]
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendCorrectScoreForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      // Browse mode: CS
      await sendCorrectScorePicks(normalizedWaId);
      return;
    }

    // REASON: Team analysis for a match
    if (lower.startsWith("reason")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1) {
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendReasonForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      await sendWhatsAppText(normalizedWaId, "Please provide a Match ID.\n\nExample: REASON 1378986\n\nSend '1' to see available matches.");
      return;
    }

    // RISK: Risk assessment for a match
    if (lower.startsWith("risk")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1) {
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendRiskForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      await sendWhatsAppText(normalizedWaId, "Please provide a Match ID.\n\nExample: RISK 1378986\n\nSend '1' to see available matches.");
      return;
    }

    // CONFIDENCE: Probability breakdown for a match
    if (lower.startsWith("confidence")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1) {
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendConfidenceForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      await sendWhatsAppText(normalizedWaId, "Please provide a Match ID.\n\nExample: CONFIDENCE 1378986\n\nSend '1' to see available matches.");
      return;
    }

    // VALUE: Value assessment for a match
    if (lower.startsWith("value")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1) {
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendValueForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      await sendWhatsAppText(normalizedWaId, "Please provide a Match ID.\n\nExample: VALUE 1378986\n\nSend '1' to see available matches.");
      return;
    }

    // ALT: Alternative bets for a match
    if (lower.startsWith("alt")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1) {
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendAltForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      await sendWhatsAppText(normalizedWaId, "Please provide a Match ID.\n\nExample: ALT 1378986\n\nSend '1' to see available matches.");
      return;
    }

    // STATS: Match stats snapshot
    if (lower.startsWith("stats") && lower !== "stats" && lower !== "statistics") {
      const parts = raw.split(/\s+/);
      if (parts.length > 1) {
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendStatsForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
    }

    // MORE: All markets for a match
    if (lower.startsWith("more")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1) {
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendMoreForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      await sendWhatsAppText(normalizedWaId, "Please provide a Match ID.\n\nExample: MORE 1378986\n\nSend '1' to see available matches.");
      return;
    }

    // BTTS: Both Teams To Score picks (browse or match mode)
    // Free users get preview (3 matches), premium get full list
    if (lower.startsWith("btts") || lower.startsWith("both teams to score")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1 && parts[1] !== "more") {
        // Match mode: BTTS [Match ID]
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendBTTSForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      // Browse mode: BTTS or BTTS MORE
      const isMore = lower.includes("more");
      await sendBTTSPicks(normalizedWaId, isMore ? 1 : 0);
      return;
    }

    // OVERS: Over / Under goals (browse or match mode)
    // Free users get preview (3 matches), premium get full list
    if (lower.startsWith("overs") || lower.startsWith("over under") || lower.startsWith("overunder")) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1 && parts[1] !== "more") {
        // Match mode: OVERS [Match ID]
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendOversForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      // Browse mode: OVERS or OVERS MORE
      const isMore = lower.includes("more");
      await sendOversPicks(normalizedWaId, isMore ? 1 : 0);
      return;
    }

    // UNDERS: Under 2.5 goals (browse or match mode)
    // Free users get preview (3 matches), premium get full list
    if (lower.startsWith("unders") || (lower.startsWith("under") && !lower.startsWith("under "))) {
      const parts = raw.split(/\s+/);
      if (parts.length > 1 && parts[1] !== "more") {
        // Match mode: UNDERS [Match ID]
        const matchId = parts[1];
        const matchIdValidation = validateMatchId(matchId);
        if (matchIdValidation.valid && matchIdValidation.normalized) {
          await sendUndersForMatch(normalizedWaId, matchIdValidation.normalized);
          return;
        }
      }
      // Browse mode: UNDERS or UNDERS MORE
      const isMore = lower.includes("more");
      await sendUndersPicks(normalizedWaId, isMore ? 1 : 0);
      return;
    }

    // WEEKEND: Mega weekend pack (Fri-Sun) - Create payment session
    if (lower === "weekend" || lower === "weekend pack") {
      await createVIPSubscriptionPayment(normalizedWaId, "weekend_pass");
      return;
    }

    // WEEKLY: Weekly pack (7 days) - Create payment session
    if (lower === "weekly" || lower === "weekly pack") {
      await createVIPSubscriptionPayment(normalizedWaId, "weekly_pass");
      return;
    }

    // MONTHLY: Monthly subscription - Create payment session
    if (lower === "monthly" || lower === "monthly sub" || lower === "monthly subscription") {
      await createVIPSubscriptionPayment(normalizedWaId, "monthly_sub");
      return;
    }

    // AUTO: Auto daily picks subscription
    if (lower === "auto" || lower === "subscription") {
      const premiumStatus = await hasWhatsAppPremiumAccess(normalizedWaId);
      if (!premiumStatus.hasAccess) {
        await sendVIPRequiredMessage(normalizedWaId);
        return;
      }
      await sendAutoSubscriptionInfo(normalizedWaId);
      return;
    }

    // LIVE: In-play / live predictions
    if (lower === "live") {
      const premiumStatus = await hasWhatsAppPremiumAccess(normalizedWaId);
      if (!premiumStatus.hasAccess) {
        await sendVIPRequiredMessage(normalizedWaId);
        return;
      }
      await sendLivePicks(normalizedWaId);
      return;
    }

    // RENEW: Renew existing VIP access
    if (lower === "renew") {
      await sendRenewVIPInfo(normalizedWaId);
      return;
    }

    // STATUS: Check VIP expiry & status
    if (lower === "status") {
      await sendVIPStatus(normalizedWaId);
      return;
    }

    // Buy flow: accept "buy 123456" or just "123456" (matchId directly)
    if (lower.startsWith("buy")) {
      const parts = raw.split(/\s+/);
      
      if (parts.length < 2) {
        await sendPaymentOptions(normalizedWaId);
        return;
      }

      const matchIdStr = parts[1];
      const matchIdValidation = validateMatchId(matchIdStr);

      if (!matchIdValidation.valid) {
        await sendWhatsAppText(
          normalizedWaId,
          `${matchIdValidation.error || 'Invalid matchId'}. Please send a valid matchId.\n\nExample: buy 123456`
        );
        return;
      }

      await handleBuyByMatchId(normalizedWaId, matchIdValidation.normalized!);
      return;
    }

    // Check if input is just a number (matchId) - treat as purchase request
    const numericMatchId = raw.trim();
    const matchIdValidation = validateMatchId(numericMatchId);
    if (matchIdValidation.valid && matchIdValidation.normalized) {
      // It's a valid numeric matchId, treat as purchase request
      await handleBuyByMatchId(normalizedWaId, matchIdValidation.normalized);
      return;
    }

    // Fallback - show menu
    await sendMainMenu(normalizedWaId);
  } catch (error) {
    logger.error("Error handling incoming WhatsApp text", {
      waId,
      text,
      error,
    });
    await sendWhatsAppText(
      waId,
      "Sorry, something went wrong. Please try again or send 'menu' for options."
    );
  }
}

/**
 * Send main menu
 */
async function sendMainMenu(to: string) {
  const message = getMainMenuMessage();

  const result = await sendWhatsAppText(to, message);
  if (!result.success) {
    logger.error("Failed to send main menu", {
      to,
      error: result.error,
    });
  }
}

/**
 * Send welcome message for new users
 */
async function sendWelcomeMessage(to: string) {
  // Get SnapBet logo/image URL from environment variable or use default
  const SNAPBET_LOGO_URL = process.env.SNAPBET_LOGO_URL || "https://www.snapbet.bet/logo.png";
  
  // First, send the header image (if URL is configured)
  if (SNAPBET_LOGO_URL && SNAPBET_LOGO_URL !== "https://www.snapbet.bet/logo.png") {
    const imageResult = await sendWhatsAppImage(to, SNAPBET_LOGO_URL);
    if (!imageResult.success) {
      logger.warn("Failed to send welcome image, continuing with text message", {
        to,
        error: imageResult.error,
      });
    }
    // Small delay to ensure image is sent before text
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const message = getWelcomeMessage();

  const result = await sendWhatsAppText(to, message);
  if (!result.success) {
    logger.error("Failed to send welcome message", {
      to,
      error: result.error,
    });
  }
}

/**
 * Send today's picks
 */
async function sendTodaysPicks(to: string) {
  try {
    logger.info("Fetching today's picks for WhatsApp user", { to });
    
    const picks = await getTodaysPicks();
    
    logger.info("Fetched picks for WhatsApp", {
      to,
      picksCount: picks.length,
    });

    if (!picks || picks.length === 0) {
      logger.warn("No picks available for WhatsApp user", { to });
      await sendWhatsAppText(
        to,
        "No picks available for today yet. Check back later 🔄"
      );
      return;
    }

    const message = formatPicksList(picks);
    
    logger.debug("Formatted picks message", {
      to,
      messageLength: message.length,
      picksCount: picks.length,
    });

    // Check message length before sending (WhatsApp limit is 4096 characters)
    const WHATSAPP_MAX_LENGTH = 4096;
    if (message.length > WHATSAPP_MAX_LENGTH) {
      logger.error("Picks message exceeds WhatsApp character limit", {
        to,
        messageLength: message.length,
        maxLength: WHATSAPP_MAX_LENGTH,
        picksCount: picks.length,
      });
      
      // Dynamically reduce picks until message fits
      let reducedPicks = picks;
      let reducedMessage = message;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (reducedMessage.length > WHATSAPP_MAX_LENGTH && attempts < maxAttempts && reducedPicks.length > 1) {
        attempts++;
        // Reduce by 1 pick each time
        reducedPicks = reducedPicks.slice(0, reducedPicks.length - 1);
        reducedMessage = formatPicksList(reducedPicks, reducedPicks.length);
        
        logger.debug("Trying reduced picks", {
          to,
          attempts,
          picksCount: reducedPicks.length,
          messageLength: reducedMessage.length,
        });
      }
      
      if (reducedMessage.length <= WHATSAPP_MAX_LENGTH && reducedPicks.length > 0) {
        logger.info("Sending shortened picks message", {
          to,
          originalPicksCount: picks.length,
          shortenedPicksCount: reducedPicks.length,
          messageLength: reducedMessage.length,
        });
        const result = await sendWhatsAppText(to, reducedMessage);
        if (!result.success) {
          logger.error("Failed to send shortened picks", {
            to,
            error: result.error,
          });
          await sendWhatsAppText(
            to,
            "Sorry, couldn't send picks right now. Please try again later."
          );
        }
      } else {
        // Even with 1 pick, message is too long (shouldn't happen, but safety check)
        logger.error("Even single pick message is too long", {
          to,
          messageLength: reducedMessage.length,
          picksCount: reducedPicks.length,
        });
        await sendWhatsAppText(
          to,
          "Sorry, there are too many picks to display. Please try again later or contact support."
        );
      }
      return;
    }

    const result = await sendWhatsAppText(to, message);
    if (!result.success) {
      logger.error("Failed to send picks", {
        to,
        error: result.error,
        messageLength: message.length,
        errorDetails: result.error,
      });
      
      // Provide more specific error message based on error type
      let errorMessage = "Sorry, couldn't send picks right now. Please try again later.";
      
      if (result.errorType === "TOKEN_EXPIRED" || result.errorCode === 190) {
        errorMessage = "System error: Access token expired. Please contact support.";
      } else if (result.errorType === "RATE_LIMIT" || result.errorCode === 429) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (result.errorType === "INVALID_PHONE" || result.errorCode === 131047) {
        errorMessage = "Invalid phone number format. Please contact support.";
      } else if (result.errorType === "MESSAGE_TOO_LONG" || result.errorCode === 100) {
        errorMessage = "Message too long. Please try again later or contact support.";
      } else if (result.errorType === "NUMBER_NOT_REGISTERED" || result.errorCode === 131026) {
        errorMessage = "Phone number not registered on WhatsApp. Please verify your number.";
      } else if (result.errorType === "TEMPLATE_REQUIRED" || result.errorCode === 131031) {
        errorMessage = "Please send a message first to start a conversation.";
      }
      
      // Send fallback error message to user
      await sendWhatsAppText(to, errorMessage);
    } else {
      logger.info("Successfully sent picks to WhatsApp user", {
        to,
        picksCount: picks.length,
        messageLength: message.length,
      });
    }
  } catch (error) {
    logger.error("Error sending picks", {
      to,
      error: error instanceof Error ? error : undefined,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Always send error message to user
    try {
      await sendWhatsAppText(
        to,
        "Sorry, couldn't fetch picks right now. Please try again later."
      );
    } catch (sendError) {
      logger.error("Failed to send error message to user", {
        to,
        error: sendError instanceof Error ? sendError : undefined,
      });
    }
  }
}

/**
 * Handle buy by matchId
 */
/**
 * Handle buy by matchId
 * TEMPORARY: Skip payment and directly send full AI analysis from QuickPurchase
 */
async function handleBuyByMatchId(waId: string, matchId: string) {
  try {
    // Directly fetch from QuickPurchase table
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
      await sendWhatsAppText(
        waId,
        `Match ID ${matchId} not found in our database. Please send '1' to see available matches.`
      );
      return;
    }

    // Extract match and prediction data
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
    // If needed in future, can be re-added here
    let consensusOdds: { home: number; draw: number; away: number } | undefined;
    let isConsensusOdds = false;
    let primaryBook: string | undefined;
    let booksCount: number | undefined;

    // Format the full AI analysis message
    const message = formatPickDeliveryMessage({
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

    const result = await sendWhatsAppText(waId, message);
    if (!result.success) {
      logger.error("Failed to send pick details", {
        waId,
        matchId,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("Error handling buy by matchId", {
      waId,
      matchId,
      error,
    });

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await sendWhatsAppText(
      waId,
      `Sorry, I couldn't retrieve the pick for match ID ${matchId}. ${errorMessage}`
    );
  }
}

/**
 * Send help message
 */
async function sendHelp(to: string) {
  const message = getHelpMessage();

  const result = await sendWhatsAppText(to, message);
  if (!result.success) {
    logger.error("Failed to send help", {
      to,
      error: result.error,
    });
  }
}

/**
 * Send purchase history
 */
async function sendPurchaseHistory(to: string) {
  try {
    const waUser = await prisma.whatsAppUser.findUnique({
      where: { waId: to },
      include: {
        purchases: {
          where: {
            status: 'completed',
          },
          include: {
            quickPurchase: {
              select: {
                matchId: true,
                name: true,
                predictionType: true,
              },
            },
          },
          orderBy: {
            purchasedAt: 'desc',
          },
          take: 10, // Last 10 purchases
        },
      },
    });

    if (!waUser) {
      await sendWhatsAppText(
        to,
        "You haven't made any purchases yet. Send '1' to see available picks!"
      );
      return;
    }

    if (waUser.purchases.length === 0) {
      await sendWhatsAppText(
        to,
        "📚 **My Picks**\n\nYou haven't purchased any picks yet.\n\nSend '1' to see today's available picks!"
      );
      return;
    }

    const lines: string[] = [];
    lines.push("📚 **My Picks**");
    lines.push(`Total Purchases: ${waUser.totalPicks}`);
    lines.push("");

    waUser.purchases.forEach((purchase, index) => {
      const matchName = purchase.quickPurchase?.name || 'Unknown Match';
      const matchId = purchase.quickPurchase?.matchId || 'N/A';
      const purchasedDate = purchase.purchasedAt
        ? new Date(purchase.purchasedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'N/A';

      lines.push(`${index + 1}. ${matchName}`);
      lines.push(`   Match ID: ${matchId}`);
      lines.push(`   Date: ${purchasedDate}`);
      lines.push("");
    });

    lines.push("To view a pick again, send its matchId.");
    lines.push("Example: Send '123456' to get the full analysis.");

    const message = lines.join("\n");
    const result = await sendWhatsAppText(to, message);
    
    if (!result.success) {
      logger.error("Failed to send purchase history", {
        to,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("Error sending purchase history", {
      to,
      error,
    });
    await sendWhatsAppText(
      to,
      "Sorry, couldn't fetch your purchase history. Please try again later."
    );
  }
}

// ============================================
// NEW COMMAND HANDLERS - FREE TIER
// ============================================

/**
 * Send popular matches / leagues list (Command 2)
 */
async function sendPopularMatches(to: string) {
  try {
    // Get popular matches grouped by league
    const popularMatches = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        isPopular: true,
        matchId: { not: null },
      },
      take: 10,
      orderBy: { displayOrder: 'asc' },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true,
          },
        },
      },
    });

    if (popularMatches.length === 0) {
      await sendWhatsAppText(
        to,
        "📊 **Popular Matches**\n\nNo popular matches available right now.\n\nSend '1' to see today's picks!"
      );
      return;
    }

    const lines: string[] = [];
    lines.push("📊 **POPULAR MATCHES**");
    lines.push("");

    // Group by league if possible
    const leagueGroups = new Map<string, typeof popularMatches>();
    popularMatches.forEach((match) => {
      const matchData = match.matchData as any;
      const leagueName = matchData?.league?.name || "Other";
      if (!leagueGroups.has(leagueName)) {
        leagueGroups.set(leagueName, []);
      }
      leagueGroups.get(leagueName)!.push(match);
    });

    leagueGroups.forEach((matches, league) => {
      lines.push(`🏆 **${league}**`);
      matches.forEach((match, idx) => {
        const matchId = match.matchId || "N/A";
        lines.push(`${idx + 1}. ${match.name}`);
        lines.push(`   Match ID: ${matchId}`);
      });
      lines.push("");
    });

    lines.push("💡 Send a Match ID to get full AI analysis!");
    lines.push("Example: 1379099");

    const message = lines.join("\n");
    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending popular matches", { to, error });
    await sendWhatsAppText(to, "Sorry, couldn't fetch popular matches. Please try again later.");
  }
}

/**
 * Send free tier options (FREE command)
 */
async function sendFreeTierOptions(to: string) {
  const message = [
    "🆓 **FREE TIER OPTIONS**",
    "",
    "**Available Commands:**",
    "",
    "**1** - Today's free picks",
    "**2** - Popular matches",
    "**TODAY** - Free picks summary",
    "**MENU** - All options",
    "**HELP** - How SnapBet works",
    "**HOW** - How AI predictions work",
    "**LEAGUES** - Supported leagues",
    "**STATS** - Basic team stats",
    "",
    "**Or send a Match ID** to get sample AI analysis",
    "Example: 1379099",
    "",
    "💡 Upgrade to VIP for premium picks, parlays, and more!",
    "Send 'VIP' to see pricing.",
  ].join("\n");

  await sendWhatsAppText(to, message);
}

/**
 * Send how SnapBet works (HOW command)
 */
async function sendHowSnapBetWorks(to: string) {
  const message = [
    "🤖 **HOW SNAPBET AI WORKS**",
    "",
    "**Our AI System:**",
    "• Analyzes 100+ data points per match",
    "• Team form, injuries, head-to-head records",
    "• Market odds vs our probability models",
    "• Machine learning ensemble predictions",
    "",
    "**What You Get:**",
    "• Match predictions with confidence %",
    "• Team strengths & weaknesses analysis",
    "• Asian Handicap insights",
    "• Value betting opportunities",
    "",
    "**Free Tier:**",
    "• Sample AI analysis (V1 consensus)",
    "• Limited depth predictions",
    "",
    "**VIP Tier:**",
    "• V2/V3 high-accuracy ML models",
    "• Full comprehensive analysis",
    "• Parlay builder",
    "• Correct scores, BTTS, Over/Under",
    "",
    "Send 'VIP' to upgrade!",
  ].join("\n");

  await sendWhatsAppText(to, message);
}

/**
 * Send supported leagues (LEAGUES command)
 */
async function sendSupportedLeagues(to: string) {
  try {
    const leagues = await prisma.league.findMany({
      where: {
        isActive: true,
        isPredictionEnabled: true,
      },
      orderBy: { dataCollectionPriority: 'desc' },
      take: 20,
    });

    if (leagues.length === 0) {
      await sendWhatsAppText(to, "📋 **Supported Leagues**\n\nNo leagues available right now.");
      return;
    }

    const lines: string[] = [];
    lines.push("📋 **SUPPORTED LEAGUES**");
    lines.push("");

    leagues.forEach((league, idx) => {
      lines.push(`${idx + 1}. ${league.name}`);
      if (league.countryCode) {
        lines.push(`   Country: ${league.countryCode}`);
      }
    });

    lines.push("");
    lines.push("💡 We cover top leagues worldwide!");
    lines.push("Send '1' to see today's matches.");

    const message = lines.join("\n");
    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending supported leagues", { to, error });
    await sendWhatsAppText(to, "Sorry, couldn't fetch leagues. Please try again later.");
  }
}

/**
 * Send basic team stats (STATS command)
 */
async function sendBasicStats(to: string) {
  const message = [
    "📊 **BASIC STATS & TRENDS**",
    "",
    "**What We Track:**",
    "• Team form (last 5 matches)",
    "• Home/Away performance",
    "• Goals scored/conceded",
    "• Head-to-head records",
    "• Injury impact analysis",
    "",
    "**How to Use:**",
    "1. Send '1' to see today's picks",
    "2. Each pick includes basic stats",
    "3. Send Match ID for full analysis",
    "",
    "💡 VIP members get advanced stats & trends!",
    "Send 'VIP' to upgrade.",
  ].join("\n");

  await sendWhatsAppText(to, message);
}

// ============================================
// NEW COMMAND HANDLERS - PREMIUM TIER
// ============================================

/**
 * Send VIP pricing & plans (VIP command)
 */
async function sendVIPPricing(to: string) {
  const message = [
    "💎 **VIP PRICING & PLANS**",
    "",
    "**VIP Benefits:**",
    "• Premium AI picks (V2/V3 models)",
    "• Parlay builder (3-6 matches)",
    "• Correct score predictions",
    "• Both Teams To Score (BTTS)",
    "• Over/Under goals analysis",
    "• Weekend mega packs",
    "• Auto daily picks subscription",
    "• Live in-play predictions",
    "",
    "**Pricing:**",
    "• Monthly: $29.99/month",
    "• Annual: $299/year (Save $60!)",
    "",
    "**Payment Options:**",
    "• Credit/Debit Card (Stripe)",
    "• M-PESA (Kenya)",
    "• Paystack (Nigeria)",
    "• Other local methods available",
    "",
    "Send 'BUY' to see payment options and purchase links for your country.",
  ].join("\n");

  await sendWhatsAppText(to, message);
}

/**
 * Send payment options by country (BUY command)
 */
async function sendPaymentOptions(to: string) {
  try {
    const waUser = await prisma.whatsAppUser.findUnique({
      where: { waId: to },
    });

    const countryCode = waUser?.countryCode || "US";
    
    // Get package pricing for user's country
    const { getDbCountryPricing } = await import("@/lib/server-pricing-service");
    const weekendPrice = await getDbCountryPricing(countryCode, "weekend_pass");
    const weeklyPrice = await getDbCountryPricing(countryCode, "weekly_pass");
    const monthlyPrice = await getDbCountryPricing(countryCode, "monthly_sub");

    // Create payment sessions for each plan
    const weekendSession = await createWhatsAppVIPSubscriptionSession({
      waId: to,
      packageType: "weekend_pass",
    });

    const weeklySession = await createWhatsAppVIPSubscriptionSession({
      waId: to,
      packageType: "weekly_pass",
    });

    const monthlySession = await createWhatsAppVIPSubscriptionSession({
      waId: to,
      packageType: "monthly_sub",
    });

    const message = [
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
      "**Payment Methods:**",
      "",
      countryCode === "KE" ? "• M-PESA (Mobile Money)" : "",
      countryCode === "NG" ? "• Paystack (Card & Bank)" : "",
      "• Credit/Debit Card (Stripe)",
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

    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending payment options", { to, error });
    await sendWhatsAppText(to, "Sorry, couldn't create payment links. Please try again or send 'WEEKEND', 'WEEKLY', or 'MONTHLY' for specific plans.");
  }
}

/**
 * Send VIP required message
 */
async function sendVIPRequiredMessage(to: string) {
  const message = [
    "🔒 **VIP ACCESS REQUIRED**",
    "",
    "This feature is only available to VIP members.",
    "",
    "**Upgrade to VIP for:**",
    "• Premium AI picks",
    "• Parlay builder",
    "• Correct scores",
    "• BTTS, Over/Under",
    "• Multi-sport predictions",
    "",
    "Send 'VIP' to see pricing and plans.",
    "",
    "Send 'BUY' to see payment options",
  ].join("\n");

  await sendWhatsAppText(to, message);
}

/**
 * Send VIP picks (VIP PICKS command)
 */
async function sendVIPPicks(to: string) {
  // For now, send premium picks (can be enhanced with V2/V3 filtering)
  await sendTodaysPicks(to);
}

/**
 * Send V2 picks (V2 command)
 */
async function sendV2Picks(to: string) {
  const message = [
    "🤖 **V2 HIGH-ACCURACY PICKS**",
    "",
    "V2 uses advanced ML models for higher accuracy.",
    "",
    "**Fetching V2 picks...**",
    "",
    "💡 V2 picks are updated throughout the day.",
    "Check back later for more picks!",
    "",
    "Send '1' to see all available picks.",
  ].join("\n");

  await sendWhatsAppText(to, message);
  // TODO: Implement V2 picks fetching from backend
}

/**
 * Send V3 picks (V3 command)
 */
async function sendV3Picks(to: string) {
  const message = [
    "🎯 **V3 HIGHEST-CONFIDENCE PICKS**",
    "",
    "V3 uses ensemble models for maximum confidence.",
    "",
    "**Fetching V3 picks...**",
    "",
    "💡 V3 picks are our most confident predictions.",
    "Check back later for more picks!",
    "",
    "Send '1' to see all available picks.",
  ].join("\n");

  await sendWhatsAppText(to, message);
  // TODO: Implement V3 picks fetching from backend
}

/**
 * Send parlay picks (PARLAY command)
 */
async function sendParlayPicks(to: string) {
  try {
    // Fetch active parlays from database
    // Use type assertion since Prisma client might need regeneration
    const parlays = await (prisma as any).parlayConsensus.findMany({
      where: {
        status: 'active',
        confidenceTier: { in: ['high', 'medium'] },
      },
      include: {
        legs: {
          orderBy: { legOrder: 'asc' },
          take: 6,
        },
      },
      orderBy: { edgePct: 'desc' },
      take: 5,
    }).catch(() => []);

    if (parlays.length === 0) {
      await sendWhatsAppText(
        to,
        "🎯 **AI PARLAY BUILDER**\n\nNo active parlays available right now.\n\nCheck back later or send '1' for today's picks!"
      );
      return;
    }

    const lines: string[] = [];
    lines.push("🔗 **AI PARLAY**");
    lines.push("");
    lines.push("High-odds parlay ticket.");
    lines.push("");
    lines.push("👉 Get detailed info:");
    lines.push("");
    lines.push("Type: [matchid]");

    const message = lines.join("\n");
    
    // Check message length
    if (message.length > 4096) {
      const shortMessage = [
        "🎯 **AI-BUILT PARLAYS**",
        "",
        `Found ${parlays.length} active parlays!`,
        "",
        "**Top Parlay:**",
        `${parlays[0].legCount} legs | Edge: ${Number(parlays[0].edgePct).toFixed(1)}%`,
        "",
        "Send 'BUY' to see payment options",
        "to view and purchase all parlays.",
      ].join("\n");
      
      await sendWhatsAppText(to, shortMessage);
    } else {
      await sendWhatsAppText(to, message);
    }
  } catch (error) {
    logger.error("Error sending parlay picks", { to, error });
    await sendWhatsAppText(to, "Sorry, couldn't fetch parlays. Send 'BUY' to see payment options.");
  }
}

/**
 * Send correct score picks (CS command - browse mode)
 */
async function sendCorrectScorePicks(to: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    // Get upcoming matches from MarketMatch table and join with QuickPurchase
    const upcomingMatches = await getUpcomingMatchesWithPredictions();
    
    if (upcomingMatches.size === 0) {
      await sendWhatsAppText(to, "🎯 **CORRECT SCORES**\n\nNo Correct Score predictions available right now.\n\nSend '1' to see today's picks!");
      return;
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
      await sendWhatsAppText(to, "🎯 **CORRECT SCORES**\n\nNo correct score predictions available right now.\n\nSend '1' to see today's picks!");
      return;
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

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending correct score picks", { to, error });
    await sendWhatsAppText(to, "Sorry, couldn't fetch correct score picks. Please try again later.");
  }
}

/**
 * Send correct score details for a specific match (CS [Match ID])
 */
async function sendCorrectScoreForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      await sendWhatsAppText(to, `Match ID ${matchId} not found. Send '1' to see available matches.`);
      return;
    }

    const predictionData = quickPurchase.predictionData as any;
    const correctScores = predictionData?.additional_markets_v2?.correct_scores ||
                         predictionData?.additional_markets?.correct_score_top3;

    if (!correctScores || correctScores.length === 0) {
      await sendWhatsAppText(to, `Correct score data not available for Match ID ${matchId}.\n\nSend 'CS' to see matches with score predictions.`);
      return;
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

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending correct score for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch correct score data for Match ID ${matchId}.`);
  }
}

/**
 * Send team analysis for a match (REASON [Match ID])
 */
async function sendReasonForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      await sendWhatsAppText(to, `Match ID ${matchId} not found. Send '1' to see available matches.`);
      return;
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

    // Home team analysis
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

    // Away team analysis
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

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending reason for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch analysis for Match ID ${matchId}.`);
  }
}

/**
 * Send risk assessment for a match (RISK [Match ID])
 */
async function sendRiskForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      await sendWhatsAppText(to, `Match ID ${matchId} not found. Send '1' to see available matches.`);
      return;
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

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending risk for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch risk data for Match ID ${matchId}.`);
  }
}

/**
 * Send confidence breakdown for a match (CONFIDENCE [Match ID])
 */
async function sendConfidenceForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      await sendWhatsAppText(to, `Match ID ${matchId} not found. Send '1' to see available matches.`);
      return;
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

    // Determine recommendation
    const maxProb = Math.max(homeWin, draw, awayWin);
    let recommendation = "Draw";
    if (maxProb === homeWin) recommendation = "Home Win";
    else if (maxProb === awayWin) recommendation = "Away Win";

    lines.push(`💡 Lean: ${recommendation}`);
    lines.push("");
    lines.push("👉 Want higher-confidence odds?");
    lines.push("");
    lines.push(`Reply: VALUE ${matchId}`);

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending confidence for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch confidence data for Match ID ${matchId}.`);
  }
}

/**
 * Send value assessment for a match (VALUE [Match ID])
 */
async function sendValueForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      await sendWhatsAppText(to, `Match ID ${matchId} not found. Send '1' to see available matches.`);
      return;
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

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending value for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch value data for Match ID ${matchId}.`);
  }
}

/**
 * Send alternative bets for a match (ALT [Match ID])
 */
async function sendAltForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      await sendWhatsAppText(to, `Match ID ${matchId} not found. Send '1' to see available matches.`);
      return;
    }

    const predictionData = quickPurchase.predictionData as any;
    const flat = predictionData?.additional_markets_flat;
    const v2 = predictionData?.additional_markets_v2;

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    // Extract alternative market data
    let bttsYes = flat?.btts_yes || v2?.btts?.yes || 0;
    let bttsNo = flat?.btts_no || v2?.btts?.no || 0;
    let over25 = flat?.totals_over_2_5 || v2?.totals?.['2_5']?.over || 0;
    let under25 = flat?.totals_under_2_5 || v2?.totals?.['2_5']?.under || 0;
    let dc1X = flat?.double_chance_1X || v2?.double_chance?.['1X'] || 0;
    let dcX2 = flat?.double_chance_X2 || v2?.double_chance?.['X2'] || 0;
    let dnbHome = flat?.dnb_home || v2?.dnb?.home || 0;
    let dnbAway = flat?.dnb_away || v2?.dnb?.away || 0;

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

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending alt for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch alternative bets for Match ID ${matchId}.`);
  }
}

/**
 * Send match stats snapshot (STATS [Match ID])
 */
async function sendStatsForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      await sendWhatsAppText(to, `Match ID ${matchId} not found. Send '1' to see available matches.`);
      return;
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

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending stats for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch stats for Match ID ${matchId}.`);
  }
}

/**
 * Send all markets for a match (MORE [Match ID])
 */
async function sendMoreForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

  try {
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { matchId },
    });

    if (!quickPurchase) {
      await sendWhatsAppText(to, `Match ID ${matchId} not found. Send '1' to see available matches.`);
      return;
    }

    const predictionData = quickPurchase.predictionData as any;
    const flat = predictionData?.additional_markets_flat;
    const v2 = predictionData?.additional_markets_v2;
    const predictions = predictionData?.predictions;

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";

    // Extract all market data
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

    await sendWhatsAppText(to, lines.join("\n"));
  } catch (error) {
    logger.error("Error sending more for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch markets for Match ID ${matchId}.`);
  }
}

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
 * Send Both Teams To Score picks (BTTS command - browse mode)
 */
async function sendBTTSPicks(to: string, page: number = 0) {
  try {
    const limit = 5;
    const skip = page * limit;
    
    // Get upcoming matches from Market API and join with QuickPurchase
    const upcomingMatches = await getUpcomingMatchesWithPredictions();
    
    if (upcomingMatches.size === 0) {
      await sendWhatsAppText(
        to,
        "⚽ **BTTS PICKS**\n\nNo BTTS predictions available right now.\n\nSend '1' to see today's picks!"
      );
      return;
    }

    // Filter to matches with BTTS data and extract probabilities
    const bttsMatches = Array.from(upcomingMatches.values())
      .map(({ marketData, quickPurchase }) => {
        const match = quickPurchase;
        const predictionData = match.predictionData as any;
        
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
        
        // Log data extraction for verification
        logger.debug("BTTS data extraction", {
          matchId: match.matchId,
          hasFlat: !!flat,
          hasV2: !!v2,
          hasAdditionalMarkets: !!additionalMarkets,
          bttsYes,
          bttsNo,
          dataSource: flat ? 'flat' : v2 ? 'v2' : additionalMarkets ? 'legacy' : 'none',
        });
        
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
      .sort((a, b) => b.bttsYes - a.bttsYes) // Sort by highest BTTS Yes probability
      .slice(skip, skip + limit);
    
    // Log extracted data to verify it's not static
    if (bttsMatches.length > 0) {
      logger.info("BTTS matches extracted", {
        count: bttsMatches.length,
        sampleData: bttsMatches.slice(0, 3).map(m => ({
          matchId: m.matchId,
          bttsYes: m.bttsYes,
          bttsNo: m.bttsNo,
        })),
      });
    }

    if (bttsMatches.length === 0) {
      await sendWhatsAppText(
        to,
        "⚽ **BTTS PICKS**\n\nNo BTTS predictions available right now.\n\nSend '1' to see today's picks!"
      );
      return;
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

    const message = lines.join("\n");
    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending BTTS picks", { to, error });
    await sendWhatsAppText(to, "Sorry, couldn't fetch BTTS picks. Please try again later.");
  }
}

/**
 * Send BTTS details for a specific match (BTTS [Match ID])
 */
async function sendBTTSForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

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
      await sendWhatsAppText(
        to,
        `Match ID ${matchId} not found. Send '1' to see available matches.`
      );
      return;
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
      await sendWhatsAppText(
        to,
        `BTTS data not available for Match ID ${matchId}.\n\nSend '1' to see matches with BTTS predictions.`
      );
      return;
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

    const message = lines.join("\n");
    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending BTTS for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch BTTS data for Match ID ${matchId}.`);
  }
}

/**
 * Send Over/Under picks (OVERS command - browse mode)
 */
async function sendOversPicks(to: string, page: number = 0) {
  try {
    const limit = 5;
    const skip = page * limit;
    
    // Get upcoming matches from MarketMatch table and join with QuickPurchase
    const upcomingMatches = await getUpcomingMatchesWithPredictions();
    
    if (upcomingMatches.size === 0) {
      await sendWhatsAppText(
        to,
        "📊 **OVER/UNDER GOALS**\n\nNo Over/Under predictions available right now.\n\nSend '1' to see today's picks!"
      );
      return;
    }

    // Filter to matches with Over/Under data and extract probabilities
    const oversMatches = Array.from(upcomingMatches.values())
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
        
        // Log data extraction for verification
        logger.debug("OVERS browse data extraction", {
          matchId: match.matchId,
          hasFlat: !!flat,
          hasV2: !!totalsV2,
          hasTotalGoals: !!totalGoals,
          over25,
          under25,
          dataSource: flat ? 'flat' : totalsV2 ? 'v2' : totalGoals ? 'legacy' : 'none',
        });
        
        if (over25 === undefined && under25 === undefined) {
          return null;
        }

        const matchData = match.matchData as any;
        const homeTeam = matchData?.homeTeam?.name || match.name.split(" vs ")[0] || "Team A";
        const awayTeam = matchData?.awayTeam?.name || match.name.split(" vs ")[1] || "Team B";
        const league = matchData?.league?.name || "Unknown League";
        const startTime = matchData?.startTime || matchData?.date;
        
        return {
          matchId: match.matchId!,
          name: match.name,
          homeTeam,
          awayTeam,
          league,
          startTime,
          over25: over25 || 0,
          under25: under25 || 0,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => Math.max(b.over25, b.under25) - Math.max(a.over25, a.under25)) // Sort by highest probability
      .slice(skip, skip + limit);
    
    // Log extracted data to verify it's not static
    if (oversMatches.length > 0) {
      logger.info("OVERS matches extracted", {
        count: oversMatches.length,
        sampleData: oversMatches.slice(0, 3).map(m => ({
          matchId: m.matchId,
          over25: m.over25,
          under25: m.under25,
        })),
      });
    }

    if (oversMatches.length === 0) {
      await sendWhatsAppText(
        to,
        "📊 **OVER/UNDER GOALS**\n\nNo Over/Under predictions available right now.\n\nSend '1' to see today's picks!"
      );
      return;
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

    const message = lines.join("\n");
    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending Over/Under picks", { to, error });
    await sendWhatsAppText(to, "Sorry, couldn't fetch Over/Under picks. Please try again later.");
  }
}

/**
 * Send Over/Under details for a specific match (OVERS [Match ID])
 */
async function sendOversForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

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
      await sendWhatsAppText(
        to,
        `Match ID ${matchId} not found. Send '1' to see available matches.`
      );
      return;
    }

    const predictionData = quickPurchase.predictionData as any;
    
    // Try to get goal lines from additional_markets_flat first (has all lines)
    const flat = predictionData?.additional_markets_flat;
    // Or from additional_markets_v2.totals
    const totalsV2 = predictionData?.additional_markets_v2?.totals;
    // Fallback to old structure
    const additionalMarkets = predictionData?.additional_markets || 
                              predictionData?.prediction?.additional_markets;
    const totalGoals = additionalMarkets?.total_goals;

    // Check if we have any goal data
    const hasGoalData = flat || totalsV2 || totalGoals;

    if (!hasGoalData) {
      await sendWhatsAppText(
        to,
        `Over/Under data not available for Match ID ${matchId}.\n\nSend '1' to see matches with Over/Under predictions.`
      );
      return;
    }

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";
    const league = matchData?.league?.name || "Unknown League";

    // Extract all goal lines from available sources
    const goalLines: { line: string; over: number; under: number }[] = [];
    
    // Priority 1: additional_markets_flat (most complete)
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
    }
    // Priority 2: additional_markets_v2.totals
    else if (totalsV2) {
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
    }
    // Fallback: old structure (only 2.5)
    else if (totalGoals) {
      const over25 = totalGoals['over_2_5'] || totalGoals['over_2.5'] || 0;
      const under25 = totalGoals['under_2_5'] || totalGoals['under_2.5'] || 0;
      goalLines.push({ line: '2.5', over: over25, under: under25 });
    }

    const premiumStatus = await hasWhatsAppPremiumAccess(to);
    const isPremium = premiumStatus.hasAccess;

    // Log data extraction for verification
    logger.debug("OVERS match data extraction", {
      matchId,
      goalLinesCount: goalLines.length,
      sampleData: goalLines.slice(0, 3).map(gl => ({
        line: gl.line,
        over: gl.over,
        under: gl.under,
      })),
    });

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

    const message = lines.join("\n");
    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending Over/Under for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch Over/Under data for Match ID ${matchId}.`);
  }
}

/**
 * Send Under 2.5 picks (UNDERS command - browse mode)
 */
async function sendUndersPicks(to: string, page: number = 0) {
  try {
    const limit = 5;
    const skip = page * limit;
    
    // Get upcoming matches from MarketMatch table and join with QuickPurchase
    const upcomingMatches = await getUpcomingMatchesWithPredictions();
    
    if (upcomingMatches.size === 0) {
      await sendWhatsAppText(
        to,
        "📊 **UNDER PICKS**\n\nNo Under predictions available right now.\n\nSend '1' to see today's picks!"
      );
      return;
    }

    // Filter to matches with Under 2.5 data and extract probabilities
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
        
        // Log data extraction for verification
        logger.debug("UNDERS data extraction", {
          matchId: match.matchId,
          hasFlat: !!flat,
          hasV2: !!totalsV2,
          hasTotalGoals: !!totalGoals,
          over25,
          under25,
          dataSource: flat ? 'flat' : totalsV2 ? 'v2' : totalGoals ? 'legacy' : 'none',
        });
        
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
    
    // Log extracted data to verify it's not static
    if (undersMatches.length > 0) {
      logger.info("UNDERS matches extracted", {
        count: undersMatches.length,
        sampleData: undersMatches.slice(0, 3).map(m => ({
          matchId: m.matchId,
          under25: m.under25,
          over25: m.over25,
        })),
      });
    }

    if (undersMatches.length === 0) {
      await sendWhatsAppText(
        to,
        "📉 **UNDER 2.5 PICKS**\n\nNo Under 2.5 predictions available right now.\n\nSend '1' to see today's picks!"
      );
      return;
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

    const message = lines.join("\n");
    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending Under 2.5 picks", { to, error });
    await sendWhatsAppText(to, "Sorry, couldn't fetch Under 2.5 picks. Please try again later.");
  }
}

/**
 * Send Under 2.5 details for a specific match (UNDERS [Match ID])
 */
async function sendUndersForMatch(to: string, matchId: string) {
  // Check premium access
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  if (!premiumStatus.hasAccess) {
    await sendVIPRequiredMessage(to);
    return;
  }

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
      await sendWhatsAppText(
        to,
        `Match ID ${matchId} not found. Send '1' to see available matches.`
      );
      return;
    }

    const predictionData = quickPurchase.predictionData as any;
    
    // Try to get goal lines from additional_markets_flat first (has all lines)
    const flat = predictionData?.additional_markets_flat;
    // Or from additional_markets_v2.totals
    const totalsV2 = predictionData?.additional_markets_v2?.totals;
    // Fallback to old structure
    const additionalMarkets = predictionData?.additional_markets || 
                              predictionData?.prediction?.additional_markets;
    const totalGoals = additionalMarkets?.total_goals;

    const hasGoalData = flat || totalsV2 || totalGoals;

    if (!hasGoalData) {
      await sendWhatsAppText(
        to,
        `Under goals data not available for Match ID ${matchId}.\n\nSend '1' to see matches with predictions.`
      );
      return;
    }

    const matchData = quickPurchase.matchData as any;
    const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
    const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";
    const league = matchData?.league?.name || "Unknown League";

    // Extract all goal lines from available sources
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

    // Log data extraction for verification
    logger.debug("UNDERS match data extraction", {
      matchId,
      goalLinesCount: goalLines.length,
      sampleData: goalLines.slice(0, 3).map(gl => ({
        line: gl.line,
        over: gl.over,
        under: gl.under,
      })),
    });

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

    const message = lines.join("\n");
    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error sending Under goals for match", { to, matchId, error });
    await sendWhatsAppText(to, `Sorry, couldn't fetch Under goals data for Match ID ${matchId}.`);
  }
}

/**
 * Create VIP subscription payment session
 */
async function createVIPSubscriptionPayment(to: string, packageType: "weekend_pass" | "weekly_pass" | "monthly_sub") {
  try {
    const result = await createWhatsAppVIPSubscriptionSession({
      waId: to,
      packageType,
    });

    const packageNames: Record<string, string> = {
      weekend_pass: "Weekend Pack",
      weekly_pass: "Weekly Pack",
      monthly_sub: "Monthly VIP Subscription",
    };

    const message = [
      `💳 **${packageNames[packageType]} - Payment**`,
      "",
      "Click the link below to complete your purchase:",
      "",
      result.paymentUrl,
      "",
      "💡 This link expires in 30 minutes.",
      "",
      "After payment, you'll receive a confirmation message and your VIP access will be activated!",
    ].join("\n");

    await sendWhatsAppText(to, message);
  } catch (error) {
    logger.error("Error creating VIP subscription payment", {
      to,
      packageType,
      error,
    });
    await sendWhatsAppText(
      to,
      "Sorry, couldn't create payment link. Please try again or send 'BUY' to see all payment options."
    );
  }
}

/**
 * Send auto subscription info (AUTO command)
 */
async function sendAutoSubscriptionInfo(to: string) {
  const message = [
    "🔄 **AUTO DAILY PICKS SUBSCRIPTION**",
    "",
    "**How It Works:**",
    "• Receive picks automatically every day",
    "• No need to request manually",
    "• Premium AI analysis included",
    "• Cancel anytime",
    "",
    "**Pricing:**",
    "• $9.99/week",
    "• $29.99/month (Best value!)",
    "",
    "**To Subscribe:**",
    "Send 'BUY' to see subscription options and purchase links.",
    "",
    "Send 'VIP' to see all plans.",
  ].join("\n");

  await sendWhatsAppText(to, message);
}

/**
 * Send live picks (LIVE command)
 */
async function sendLivePicks(to: string) {
  const message = [
    "⚡ **LIVE IN-PLAY PREDICTIONS**",
    "",
    "**What You Get:**",
    "• Real-time match analysis",
    "• Live betting opportunities",
    "• Next goal scorer predictions",
    "• Match outcome updates",
    "",
    "**Fetching live picks...**",
    "",
    "💡 Live predictions are updated in real-time!",
    "Check back during match time for live picks.",
    "",
    "Send '1' to see upcoming matches.",
  ].join("\n");

  await sendWhatsAppText(to, message);
  // TODO: Implement live predictions
}

/**
 * Send renew VIP info (RENEW command)
 */
async function sendRenewVIPInfo(to: string) {
  const status = await getWhatsAppVIPStatus(to);
  
  const message = [
    "🔄 **RENEW VIP ACCESS**",
    "",
    status,
    "",
    "**To Renew:**",
    "Send 'BUY' to see payment options and purchase links.",
    "",
    "Need help? Send 'HELP'",
  ].join("\n");

  await sendWhatsAppText(to, message);
}

/**
 * Send VIP status (STATUS command)
 */
async function sendVIPStatus(to: string) {
  const premiumStatus = await hasWhatsAppPremiumAccess(to);
  
  let statusMessage = "📊 **Account STATUS**";
  statusMessage += "\n\n";
  
  if (premiumStatus.hasAccess && premiumStatus.expiresAt) {
    const expiresDate = new Date(premiumStatus.expiresAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    statusMessage += `Plan: ${premiumStatus.plan || 'VIP'}\n`;
    statusMessage += `Expires: ${expiresDate}\n`;
  } else {
    statusMessage += "Plan & expiry shown.\n";
  }
  
  statusMessage += "\n";
  statusMessage += "👉 Renew or upgrade:\n";
  statusMessage += "\n";
  statusMessage += "Type: BUY";

  await sendWhatsAppText(to, statusMessage);
}

