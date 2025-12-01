import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendWhatsAppText } from "@/lib/whatsapp-service";

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
              // Echo back the message for testing
              // TODO: Replace with actual command handling logic
              await sendWhatsAppText(
                from,
                `You said: ${text}\n\nSnapBet WhatsApp Bot - Coming soon! 🎯`
              );
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

