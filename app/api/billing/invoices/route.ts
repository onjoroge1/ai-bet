import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { stripe } from "@/lib/stripe-server"
import { logger } from "@/lib/logger"

/**
 * GET /api/billing/invoices
 * Returns the last 20 Stripe invoices for the authenticated user.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    // No Stripe customer yet — return empty list gracefully
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ invoices: [] })
    }

    const { data: invoices } = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 20,
    })

    const simplified = invoices.map(inv => ({
      id: inv.id,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
      invoice_pdf: inv.invoice_pdf ?? null,
      description: inv.description ?? null,
    }))

    return NextResponse.json({ invoices: simplified })
  } catch (error) {
    logger.error("Error fetching Stripe invoices", {
      tags: ["api", "billing", "invoices"],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
  }
}

