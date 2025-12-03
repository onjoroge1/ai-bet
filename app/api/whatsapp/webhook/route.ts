import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendWhatsAppText, formatPhoneNumber } from "@/lib/whatsapp-service";
import {
  getTodaysPicks,
  formatPicksList,
  getPickByMatchId,
} from "@/lib/whatsapp-picks";
import { formatPickDeliveryMessage, getOrCreateWhatsAppUser } from "@/lib/whatsapp-payment";
import { checkWhatsAppRateLimit } from "@/lib/whatsapp-rate-limit";
import { validateMatchId, sanitizeText } from "@/lib/whatsapp-validation";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp-webhook-verification";
import prisma from "@/lib/db";

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

    // Buy flow: accept "2 123456", "buy 123456", or just "123456" (matchId directly)
    if (lower.startsWith("2") || lower.startsWith("buy")) {
      const parts = raw.split(/\s+/);
      const matchIdIndex = lower.startsWith("2") ? 1 : 1; // "2 123456" or "buy 123456"
      
      if (parts.length < 2) {
        await sendWhatsAppText(
          normalizedWaId,
          [
            "To buy a pick 💰",
            "",
            "Send the matchId directly:",
            "Example: 123456",
            "",
            "Or send '1' to see available picks.",
          ].join("\n")
        );
        return;
      }

      const matchIdStr = parts[matchIdIndex];
      const matchIdValidation = validateMatchId(matchIdStr);

      if (!matchIdValidation.valid) {
        await sendWhatsAppText(
          normalizedWaId,
          `${matchIdValidation.error || 'Invalid matchId'}. Please send a valid matchId.\n\nExample: 123456`
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
  const message = [
    "Welcome to SnapBet ⚽🔥",
    "",
    "**Available Commands:**",
    "",
    "**1** = See today's picks",
    "   Type: 1",
    "   Shows top matches with Match IDs",
    "",
    "**2** = Get AI Analysis (requires Match ID)",
    "   Type: 2 [Match ID]",
    "   Example: 2 1379099",
    "",
    "**3** = Help",
    "   Type: 3",
    "   Shows all available commands",
    "",
    "**4** = My Picks",
    "   Type: 4",
    "   View your purchase history",
    "",
    "**Or type a Match ID directly**",
    "   Example: 1379099",
    "   Sends you the full AI analysis for that match",
    "",
    "**Quick Start:**",
    "1. Type '1' to see today's picks",
    "2. Each pick shows a Match ID",
    "3. Type that Match ID to get AI analysis",
    "",
    "💡 You can type a Match ID anytime without typing '2' first!",
    "",
    "For more information visit https://www.snapbet.bet",
  ].join("\n");

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
  const message = [
    "🎉 Welcome to SnapBet! ⚽🔥",
    "",
    "Get AI-powered sports predictions delivered directly to your WhatsApp.",
    "",
    "📊 **What we offer:**",
    "• Daily top picks with AI analysis",
    "• Team strengths, weaknesses & injuries",
    "• Asian Handicap insights",
    "• Confidence factors & betting intelligence",
    "",
    "💰 **Currently FREE** - All picks are free to access!",
    "",
    "**How to use:**",
    "",
    "**1** = See today's picks",
    "   Type: 1",
    "   Shows top matches with Match IDs",
    "",
    "**2** = Get AI Analysis (requires Match ID)",
    "   Type: 2 [Match ID]",
    "   Example: 2 1379099",
    "",
    "**3** = Help",
    "   Type: 3",
    "   Shows all available commands",
    "",
    "**menu** = Main menu",
    "   Type: menu",
    "   Shows all available options",
    "",
    "**Or type a Match ID directly**",
    "   Example: 1379099",
    "   Sends you the full AI analysis for that match",
    "",
    "**Quick Start:**",
    "1. Type '1' to see today's picks",
    "2. Each pick shows a Match ID",
    "3. Type that Match ID to get AI analysis",
    "",
    "💡 You can type a Match ID anytime without typing '2' first!",
    "",
    "For more information visit https://www.snapbet.bet",
  ].join("\n");

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
  const message = [
    "Help 📲",
    "",
    "**Available Commands:**",
    "",
    "**1** = See today's picks",
    "   Type: 1",
    "   Shows top matches with Match IDs",
    "",
    "**2** = Get AI Analysis (requires Match ID)",
    "   Type: 2 [Match ID]",
    "   Example: 2 1379099",
    "",
    "**3** = Help",
    "   Type: 3 (you're here!)",
    "",
    "**menu** = Main menu",
    "   Type: menu",
    "   Shows all available options",
    "",
    "**Or type a Match ID directly**",
    "   Example: 1379099",
    "   Sends you the full AI analysis for that match",
    "",
    "**Quick Start:**",
    "1. Type '1' to see today's picks",
    "2. Each pick shows a Match ID",
    "3. Type that Match ID to get AI analysis",
    "",
    "💡 You can type a Match ID anytime without typing '2' first!",
    "",
    "To get more matches Visit https://www.snapbet.bet",
  ].join("\n");

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

