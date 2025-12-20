import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendWhatsAppText, formatPhoneNumber } from "@/lib/whatsapp-service";
import { getTodaysPicks, formatPicksList } from "@/lib/whatsapp-picks";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/send-test
 * Test endpoint to send a WhatsApp message
 * 
 * Body: {
 *   to: string (phone number in E.164 format or any format)
 *   message?: string (message text - optional if type="picks")
 *   type?: string ("picks" to send today's picks, or omit for custom message)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, message, type } = body;

    if (!to) {
      return NextResponse.json(
        { error: "Missing required field: 'to'" },
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

    let messageToSend: string;

    // If type is "picks", fetch and format today's picks
    if (type === "picks") {
      try {
        logger.info("Fetching today's picks for test", {
          to: formattedPhone,
        });

        const picks = await getTodaysPicks();
        messageToSend = formatPicksList(picks);

        logger.info("Fetched picks for test", {
          to: formattedPhone,
          picksCount: picks.length,
          messageLength: messageToSend.length,
        });
      } catch (error) {
        logger.error("Error fetching picks for test", {
          to: formattedPhone,
          error: error instanceof Error ? error : undefined,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Failed to fetch picks",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 }
        );
      }
    } else {
      // Use provided message
      if (!message) {
        return NextResponse.json(
          { error: "Missing required field: 'message' (or use type='picks')" },
          { status: 400 }
        );
      }
      messageToSend = message;
    }

    logger.info("Sending test WhatsApp message", {
      to: formattedPhone,
      originalTo: to,
      type: type || "custom",
      messageLength: messageToSend.length,
    });

    const result = await sendWhatsAppText(formattedPhone, messageToSend);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp message sent successfully",
        to: formattedPhone,
        type: type || "custom",
        messageLength: messageToSend.length,
        fullMessage: messageToSend, // Return full message content
        preview: messageToSend.substring(0, 200) + (messageToSend.length > 200 ? "..." : ""),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to send WhatsApp message. Check server logs for details.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("Error in WhatsApp send-test endpoint", error);
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

