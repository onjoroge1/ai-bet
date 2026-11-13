import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getMultisportName, isMultisportKey } from '@/lib/multisport/sports'

/**
 * POST /api/multisport/predict  { sport_key, event_id }
 *
 * Returns the prediction payload the pipeline stored in
 * MultisportMatch.predictionData (match_info, predictions, odds, model_info,
 * markets, market/value/clv/model_track_record). When the pipeline has only
 * published market data for the event (cold start, no trained model yet) the
 * payload carries `predictions: null` and the UI renders the market line.
 */
export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(request: NextRequest) {
  let body: { sport_key?: string; sport?: string; event_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const sportKey = body.sport_key || body.sport
  const eventId = body.event_id
  if (!sportKey || !eventId) {
    return NextResponse.json({ error: 'sport_key and event_id are required' }, { status: 400 })
  }
  if (!isMultisportKey(sportKey)) {
    return NextResponse.json({ error: `Unknown sport: ${sportKey}` }, { status: 400 })
  }

  try {
    const row = await prisma.multisportMatch.findUnique({
      where: { eventId_sport: { eventId: String(eventId), sport: sportKey } },
    })
    if (!row) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const stored = row.predictionData as Record<string, unknown> | null
    const odds = row.odds as { consensus?: Record<string, unknown> } | null
    const payload = stored ?? {
      source: 'multisport_match_row',
      match_info: {
        event_id: row.eventId,
        sport: row.sport,
        home_team: row.homeTeam,
        away_team: row.awayTeam,
        league_name: row.league || getMultisportName(row.sport),
        commence_time: row.commenceTime.toISOString(),
      },
      predictions: null,
      odds: odds?.consensus ?? {},
      model_info: null,
      markets: [],
      market: null,
      value: null,
      clv: null,
      model_track_record: null,
    }

    return NextResponse.json(
      {
        ...payload,
        status: row.status,
        final_result: row.finalResult,
        prediction_fetched_at: row.predictionFetchedAt?.toISOString() ?? null,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Multisport Predict API]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
