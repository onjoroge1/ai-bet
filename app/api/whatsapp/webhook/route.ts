import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendWhatsAppText, formatPhoneNumber } from "@/lib/whatsapp-service";
import {
  getTodaysPicks,
  formatPicksList,
} from "@/lib/whatsapp-picks";
import { createWhatsAppPaymentSession } from "@/lib/whatsapp-payment";

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
    const body = await req.json();
    
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
              // Handle incoming text message with menu system
              await handleIncomingText(from, text);
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

    // Menu commands
    if (["menu", "hi", "hello", "hey", "0", "start"].includes(lower)) {
      await sendMainMenu(normalizedWaId);
      return;
    }

    // Show picks
    if (lower === "1" || lower === "picks" || lower.startsWith("picks")) {
      await sendTodaysPicks(normalizedWaId);
      return;
    }

    // Help
    if (lower === "3" || lower === "help") {
      await sendHelp(normalizedWaId);
      return;
    }

    // Buy flow: expect "2 123456" or "buy 123456"
    if (lower.startsWith("2") || lower.startsWith("buy")) {
      const parts = raw.split(/\s+/);
      const matchIdIndex = lower.startsWith("2") ? 1 : 1; // "2 123456" or "buy 123456"
      
      if (parts.length < 2) {
        await sendWhatsAppText(
          normalizedWaId,
          [
            "To buy a pick 💰",
            "",
            "Reply in this format:",
            "2 <matchId>",
            "",
            "Example:",
            "2 123456",
            "",
            "Send '1' to see available picks.",
          ].join("\n")
        );
        return;
      }

      const matchIdStr = parts[matchIdIndex];
      const matchId = matchIdStr.trim();

      if (!matchId || matchId.length === 0) {
        await sendWhatsAppText(
          normalizedWaId,
          `MatchId is required. Please send:\n\n2 <matchId>\n\nExample: 2 123456`
        );
        return;
      }

      await handleBuyByMatchId(normalizedWaId, matchId);
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
    "Reply with:",
    "1️⃣ Today's picks",
    "2️⃣ Buy a pick (send: 2 <matchId>)",
    "3️⃣ Help",
    "",
    "Example: 2 123456",
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
 * Send today's picks
 */
async function sendTodaysPicks(to: string) {
  try {
    const picks = await getTodaysPicks();
    const message = formatPicksList(picks);

    const result = await sendWhatsAppText(to, message);
    if (!result.success) {
      logger.error("Failed to send picks", {
        to,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("Error sending picks", { to, error });
    await sendWhatsAppText(
      to,
      "Sorry, couldn't fetch picks right now. Please try again later."
    );
  }
}

/**
 * Handle buy by matchId
 */
async function handleBuyByMatchId(waId: string, matchId: string) {
  try {
    // Create payment session
    const { paymentUrl, sessionId } = await createWhatsAppPaymentSession({
      waId,
      matchId,
    });

    if (!paymentUrl) {
      await sendWhatsAppText(
        waId,
        "Sorry, couldn't create payment link. Please try again or contact support."
      );
      return;
    }

    // Get pick details for the message
    const { getPickByMatchId } = await import("@/lib/whatsapp-picks");
    const pick = await getPickByMatchId(matchId);

    const currencySymbol = pick?.currency === "USD" ? "$" : pick?.currency || "$";
    const price = pick?.price || 0;

    const message = [
      "You're buying this pick 💰",
      "",
      pick
        ? `${matchId} – ${pick.homeTeam} vs ${pick.awayTeam}`
        : `Match ID: ${matchId}`,
      pick ? `Market: ${pick.market}` : "",
      pick ? `Tip: ${pick.tip}` : "",
      `Price: ${currencySymbol}${price.toFixed(2)}`,
      "",
      "Tap the link below to pay (opens inside WhatsApp):",
      paymentUrl,
      "",
      "Once payment is confirmed, we'll send your full pick details here in WhatsApp ✅",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const result = await sendWhatsAppText(waId, message);
    if (!result.success) {
      logger.error("Failed to send payment link", {
        waId,
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

    if (errorMessage.includes("already purchased")) {
      await sendWhatsAppText(
        waId,
        "You have already purchased this pick. Send '1' to see other available picks."
      );
    } else if (errorMessage.includes("not found")) {
      await sendWhatsAppText(
        waId,
        `I couldn't find a pick for matchId ${matchId}. Please send '1' to see today's available picks.`
      );
    } else {
      await sendWhatsAppText(
        waId,
        "Sorry, something went wrong. Please try again or send 'menu' for options."
      );
    }
  }
}

/**
 * Send help message
 */
async function sendHelp(to: string) {
  const message = [
    "Help 📲",
    "",
    "1️⃣ Today's picks – see top matches + matchIds",
    "2️⃣ Buy a pick – send: 2 <matchId>",
    "3️⃣ Help – you're here 😊",
    "",
    "You can type MENU anytime to see options again.",
    "",
    "Example:",
    "Send '1' to see picks",
    "Send '2 123456' to buy pick with matchId 123456",
  ].join("\n");

  const result = await sendWhatsAppText(to, message);
  if (!result.success) {
    logger.error("Failed to send help", {
      to,
      error: result.error,
    });
  }
}

