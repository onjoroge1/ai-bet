import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Short URL redirect for WhatsApp payment links
 * Redirects /whatsapp/pay/[sessionId] to Stripe Checkout Session URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.redirect(new URL("/whatsapp/payment/cancel", request.url));
    }

    // Fetch Stripe Checkout Session to get the payment URL
    const stripe = (await import("@/lib/stripe-server")).stripe;

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.url) {
        logger.info("Redirecting to Stripe Checkout", {
          sessionId,
          url: session.url,
        });
        return NextResponse.redirect(session.url);
      }

      // If no URL, redirect to cancel page
      logger.warn("Stripe session has no URL", { sessionId });
      return NextResponse.redirect(new URL("/whatsapp/payment/cancel", request.url));
    } catch (stripeError) {
      logger.error("Error retrieving Stripe session", {
        sessionId,
        error: stripeError instanceof Error ? stripeError : undefined,
      });
      return NextResponse.redirect(new URL("/whatsapp/payment/cancel", request.url));
    }
  } catch (error) {
    logger.error("Error in payment redirect", {
      error: error instanceof Error ? error : undefined,
    });
    return NextResponse.redirect(new URL("/whatsapp/payment/cancel", request.url));
  }
}

