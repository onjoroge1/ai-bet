import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createWhatsAppPaymentSession } from "@/lib/whatsapp-payment";
import { formatPhoneNumber } from "@/lib/whatsapp-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/whatsapp/payment/create
 * Create a Stripe Checkout Session for WhatsApp purchase
 * 
 * Body: {
 *   waId: string (WhatsApp number)
 *   matchId: string (match ID from QuickPurchase)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { waId, matchId } = body;

    if (!waId || !matchId) {
      return NextResponse.json(
        { error: "Missing required fields: 'waId' and 'matchId'" },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedWaId = formatPhoneNumber(waId);
    if (!formattedWaId) {
      return NextResponse.json(
        { error: "Invalid WhatsApp number format" },
        { status: 400 }
      );
    }

    logger.info("Creating WhatsApp payment session", {
      waId: formattedWaId,
      matchId,
    });

    const result = await createWhatsAppPaymentSession({
      waId: formattedWaId,
      matchId: String(matchId),
    });

    return NextResponse.json({
      success: true,
      paymentUrl: result.paymentUrl,
      sessionId: result.sessionId,
    });
  } catch (error) {
    logger.error("Error in WhatsApp payment create endpoint", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment session",
      },
      { status: 500 }
    );
  }
}

