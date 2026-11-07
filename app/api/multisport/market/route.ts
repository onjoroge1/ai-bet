import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getMultisportName, isMultisportKey, multisportSeasonStatus } from '@/lib/multisport/sports'

/**
 * GET /api/multisport/market?sport=basketball_nba&status=upcoming|finished&limit=25&event_id=
 *
 * Serves MultisportMatch rows written by pipeline/ (collect → predict → publish).
 * No upstream calls: the pipeline is the only writer, this route only reads.
 */
export const runtime = 'nodejs'
export const maxDuration = 15

const STALE_AFTER_MS = 3 * 60 * 60 * 1000       // flag data older than 3h as stale
const IN_PROGRESS_GRACE_MS = 6 * 60 * 60 * 1000  // keep games that started <6h ago in "upcoming"

export function toMarketMatch(m: {
  eventId: string; status: string; commenceTime: Date; league: string; sport: string
  homeTeam: string; awayTeam: string; homeTeamId: number | null; awayTeamId: number | null
  odds: unknown; spread: unknown; model: unknown; finalResult: unknown
}) {
  return {
    event_id: m.eventId,
    status: m.status,
    commence_time: m.commenceTime.toISOString(),
    league: { name: m.league, sport_key: m.sport },
    home: { name: m.homeTeam, team_id: m.homeTeamId },
    away: { name: m.awayTeam, team_id: m.awayTeamId },
    odds: m.odds,
    spread: m.spread,
    model: m.model,
    final_result: m.finalResult,
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const sport = sp.get('sport') || 'basketball_nba'
  const status = sp.get('status') === 'finished' ? 'finished' : 'upcoming'
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25', 10) || 25, 1), 100)
  const eventId = sp.get('event_id')

  if (!isMultisportKey(sport)) {
    return NextResponse.json({ error: `Unknown sport: ${sport}`, matches: [], total_count: 0 }, { status: 400 })
  }

  const now = new Date()
  try {
    const rows = await prisma.multisportMatch.findMany({
      where: {
        sport,
        status,
        ...(eventId ? { eventId } : {}),
        ...(status === 'upcoming' && !eventId
          ? { commenceTime: { gte: new Date(now.getTime() - IN_PROGRESS_GRACE_MS) } }
          : {}),
      },
      orderBy: { commenceTime: status === 'finished' ? 'desc' : 'asc' },
      take: limit,
    })

    const newestSync = rows.reduce((max, r) => (r.lastSyncedAt > max ? r.lastSyncedAt : max), new Date(0))
    const stale = rows.length > 0 && now.getTime() - newestSync.getTime() > STALE_AFTER_MS
    const withModel = rows.filter(r => r.model !== null).length
    const latestModelInfo = rows.find(r => r.modelInfo)?.modelInfo as { n_samples?: number } | undefined

    const body = {
      sport,
      sport_name: getMultisportName(sport),
      season: multisportSeasonStatus(sport, now),
      matches: rows.map(toMarketMatch),
      total_count: rows.length,
      model_info: {
        training_samples: latestModelInfo?.n_samples ?? 0,
        confidence_note: rows.length > 0 && withModel === 0 && status === 'upcoming'
          ? 'Market line only — no trained model yet for this sport'
          : null,
      },
      live_data_available: false,
      source: rows.length === 0 ? 'database_empty' : stale ? 'database_stale' : 'database',
      last_synced: rows.length > 0 ? newestSync.toISOString() : null,
    }

    const cacheControl = status === 'finished'
      ? 'public, s-maxage=600, stale-while-revalidate=3600'
      : 'public, s-maxage=60, stale-while-revalidate=300'
    return NextResponse.json(body, { headers: { 'Cache-Control': cacheControl } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Multisport Market API]', msg)
    return NextResponse.json({ error: msg, matches: [], total_count: 0 }, { status: 500 })
  }
}
