import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/premium-tracker/track
 *
 * Fire-and-forget tracker event recorder. Mirrors /api/newsletter/track.
 * Clients call via navigator.sendBeacon so the event survives page
 * unload. Tracker-card impressions, CTA clicks (to picks or audit page).
 *
 * Body shape:
 *   {
 *     type: 'impression' | 'cta_click_picks' | 'cta_click_audit',
 *     blogId?: string,
 *   }
 *
 * Public endpoint — no auth. Append-only writes, small-impact, swallows
 * errors so tracker failure never breaks UX.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as
      | { type?: string; blogId?: string }
      | null

    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 })
    }

    const validTypes = new Set(['impression', 'cta_click_picks', 'cta_click_audit'])
    if (!body.type || !validTypes.has(body.type)) {
      return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 })
    }

    await prisma.trackerEvent.create({
      data: {
        type: body.type,
        blogId: typeof body.blogId === 'string' && body.blogId.length > 0 ? body.blogId : null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Premium Tracker Track] Error:', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
