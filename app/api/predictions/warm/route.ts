import { NextResponse } from "next/server"
import prisma from "@/lib/db"

/**
 * Fire-and-forget prediction warm-up endpoint.
 * Accepts { match_id: number } and triggers the internal predict endpoint
 * without blocking the caller. Returns 202 immediately.
 *
 * Note: This does not alter schemas and should rely on existing persistence
 * behavior of the predict endpoint. It is safe to call on page load to
 * pre-compute predictions and improve subsequent access speed.
 */
export async function POST(request: Request) {
  try {
    const { match_id } = await request.json()
    if (!match_id || typeof match_id !== "number") {
      return NextResponse.json({ error: "match_id required" }, { status: 400 })
    }

    // If a QuickPurchase already exists for this match and has prediction data, skip
    const existing = await prisma.quickPurchase.findFirst({
      where: { matchId: String(match_id) },
      select: { id: true, predictionData: true },
    })

    if (!existing || !existing.predictionData) {
      // Trigger background call; do not await the result
      // keepalive ensures the request is dispatched even if the client disconnects
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/predictions/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id }),
        keepalive: true,
      }).catch(() => {})
    }

    return NextResponse.json({ status: "scheduled" }, { status: 202 })
  } catch (e) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 })
  }
}


