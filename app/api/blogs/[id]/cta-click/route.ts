import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/blogs/[id]/cta-click
 *
 * Logs that a reader clicked the "See the full AI prediction →" CTA on a
 * blog post. Single counter for now: increments BlogPost.shareCount uses
 * a similar pattern; we use BlogConversionEvent (TBD: dedicated model) but
 * for v1 we piggy-back on the existing `BlogPost.shareCount` would conflict —
 * so we store CTA clicks in a separate field: `ctaClickCount` (added in
 * the same migration as this endpoint).
 *
 * Public endpoint, no auth. Best-effort — failures don't surface to the
 * client because the click still navigates to the destination regardless.
 *
 * Body: { destination?: string } — for future per-destination breakdown
 * (currently only "match" CTAs exist).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false }, { status: 400 })
    }

    let destination = 'match'
    try {
      const body = await request.json()
      if (typeof body?.destination === 'string') destination = body.destination
    } catch { /* empty body OK */ }

    const updated = await prisma.blogPost.update({
      where: { id },
      data: { ctaClickCount: { increment: 1 } },
      select: { id: true, ctaClickCount: true },
    })

    console.log(`[Blog CTA] +1 click for ${id} → ${destination} (total: ${updated.ctaClickCount})`)

    return NextResponse.json({ success: true, ctaClickCount: updated.ctaClickCount })
  } catch (error) {
    // Don't fail the client — they're already navigating away
    console.error('[Blog CTA] error:', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
