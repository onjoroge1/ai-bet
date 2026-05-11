import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/blogs/[id]/share
 *
 * Increments the BlogPost.shareCount counter. Optional `platform` body field
 * (twitter / facebook / linkedin / native / copy) is logged for the future
 * per-platform breakdown; for now it just bumps the aggregate counter.
 *
 * Public endpoint — no auth needed. Idempotency / spam protection is
 * intentionally minimal because the increment is small-impact + reversible.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Blog ID required' }, { status: 400 })
    }

    let platform: string | undefined
    try {
      const body = await request.json()
      platform = typeof body?.platform === 'string' ? body.platform : undefined
    } catch {
      /* body is optional */
    }

    const updated = await prisma.blogPost.update({
      where: { id },
      data: { shareCount: { increment: 1 } },
      select: { id: true, shareCount: true },
    })

    console.log(`[Blog Share] +1 share for ${id}${platform ? ` (${platform})` : ''}`)

    return NextResponse.json({ success: true, shareCount: updated.shareCount })
  } catch (error) {
    // P2025: record not found
    if (
      typeof error === 'object' && error !== null && 'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ success: false, error: 'Blog not found' }, { status: 404 })
    }
    console.error('[Blog Share] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to track share' }, { status: 500 })
  }
}
