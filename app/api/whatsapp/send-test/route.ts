import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendWhatsAppText, formatPhoneNumber } from "@/lib/whatsapp-service";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/send-test
 * Test endpoint to send a WhatsApp message
 * 
 * Body: {
 *   to: string (phone number in E.164 format or any format)
 *   message: string (message text)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json(
        { error: "Missing required fields: 'to' and 'message'" },
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

    logger.info("Sending test WhatsApp message", {
      to: formattedPhone,
      originalTo: to,
      messageLength: message.length,
    });

    const result = await sendWhatsAppText(formattedPhone, message);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp message sent successfully",
        to: formattedPhone,
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

