import { NextRequest, NextResponse } from 'next/server'
import { listProps, propFacets, type PropMode } from '@/lib/props/queries'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/props — every collected prop line priced against our estimate (paper research).
 * Query: mode (live|backtest), sport, stat, source (sportsbook|kalshi), side (yes|no), minSample,
 *        positiveOnly (1), search, sort (ev|our_prob|edge|hit_rate|hit_n|commence_time|prediction_ts|threshold|subject),
 *        dir (asc|desc), limit (<=1000). Admin only (middleware).
 */
export async function GET(request: NextRequest) {
  try {
    const q = new URL(request.url).searchParams
    const mode = (q.get('mode') === 'backtest' ? 'backtest' : 'live') as PropMode
    const [rows, facets] = await Promise.all([
      listProps({
        mode,
        sport: q.get('sport') || undefined,
        stat: q.get('stat') || undefined,
        source: q.get('source') || undefined,
        side: q.get('side') || undefined,
        minSample: q.get('minSample') ? Number(q.get('minSample')) : undefined,
        positiveOnly: q.get('positiveOnly') === '1',
        search: q.get('search') || undefined,
        sort: q.get('sort') || 'ev',
        dir: q.get('dir') === 'asc' ? 'asc' : 'desc',
        limit: q.get('limit') ? Number(q.get('limit')) : 300,
      }),
      propFacets(mode),
    ])
    return NextResponse.json({ rows, facets })
  } catch (error) {
    logger.error('admin props list failed', { error })
    return NextResponse.json({ error: 'Failed to load props' }, { status: 500 })
  }
}
