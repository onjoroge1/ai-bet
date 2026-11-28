import { NextRequest, NextResponse } from 'next/server'
import { getPropDetail } from '@/lib/props/queries'
import { logger } from '@/lib/logger'

/** GET /api/admin/props/:id — one estimate: distribution curve, every quote, hit rates, factors, combos. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const n = Number(id)
    if (!Number.isInteger(n)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
    const detail = await getPropDetail(n)
    if (!detail) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (error) {
    logger.error('admin prop detail failed', { error })
    return NextResponse.json({ error: 'Failed to load prop' }, { status: 500 })
  }
}
