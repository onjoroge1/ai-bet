import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/match/[match_id]/odds-history?hours=24
 *
 * Returns the consensus 1X2 odds timeseries for a match. Powers the
 * "odds drift" sparkline on the live match page. Snapshots are populated
 * by the live/upcoming sync cron in app/api/admin/market/sync-scheduled.
 *
 * Response shape:
 *   { matchId, points: [{ t: ISO, h: number|null, d: number|null, a: number|null }] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const { match_id } = await params
    const matchId = String(match_id || '').trim()
    if (!matchId) {
      return NextResponse.json({ error: 'match_id required' }, { status: 400 })
    }

    const hoursRaw = Number(request.nextUrl.searchParams.get('hours') ?? '24')
    const hours = Math.min(Math.max(isFinite(hoursRaw) ? hoursRaw : 24, 1), 168)
    const since = new Date(Date.now() - hours * 3600 * 1000)

    const snapshots = await prisma.oddsSnapshot.findMany({
      where: { matchId, capturedAt: { gte: since } },
      orderBy: { capturedAt: 'asc' },
      select: { capturedAt: true, homeOdds: true, drawOdds: true, awayOdds: true },
    })

    const points = snapshots.map((s) => ({
      t: s.capturedAt.toISOString(),
      h: s.homeOdds ? Number(s.homeOdds) : null,
      d: s.drawOdds ? Number(s.drawOdds) : null,
      a: s.awayOdds ? Number(s.awayOdds) : null,
    }))

    return NextResponse.json(
      { matchId, hours, count: points.length, points },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
