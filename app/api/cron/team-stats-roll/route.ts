import { NextRequest, NextResponse } from 'next/server'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'
import { logger } from '@/lib/logger'
import { rollupAllTeams } from '@/lib/team-stats/cron-impl'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 min — team-stats roll can take time over 200-400 teams

/**
 * GET/POST /api/cron/team-stats-roll
 *
 * Daily 03:00 UTC. Walks the qualifying teams (≥10 historical matches +
 * upcoming/recent activity), recomputes TeamStats from MarketMatch state,
 * upserts by slug.
 *
 * Heartbeat: team-stats:roll (1d interval).
 * Auth: Bearer CRON_SECRET.
 */
async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let hb: HeartbeatToken | null = null
  try {
    hb = await beginCron('team-stats:roll')

    const result = await rollupAllTeams()

    logger.info(`[Team Stats Roll] ${result.rolled} teams rolled, ${result.skipped} skipped`, {
      tags: ['team-stats', 'cron'],
      data: result,
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: result.rolled })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Team Stats Roll] Failed', {
      tags: ['team-stats', 'cron', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
