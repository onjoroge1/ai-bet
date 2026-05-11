import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

interface HealthRow {
  name: string
  lastStartedAt: string | null
  lastCompletedAt: string | null
  lastDurationMs: number | null
  lastStatus: string | null
  lastError: string | null
  rowsAffected: number | null
  runCount: number
  errorCount: number
  /** Computed: ms since the last successful completion. */
  ageMs: number | null
  /** Computed: 'healthy' | 'stale' | 'failed' | 'unknown' — driven by ageMs +
   *  lastStatus + the heuristic threshold below. Frontend uses this to colour
   *  badges without re-implementing the rules. */
  health: 'healthy' | 'stale' | 'failed' | 'unknown'
}

// Per-cron expected interval (ms). If lastCompletedAt is older than 2× this,
// we mark the row 'stale' regardless of lastStatus. Pulled from vercel.json
// schedules — keep in sync if those change.
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const EXPECTED_INTERVAL_MS: Record<string, number> = {
  'market-sync:live': 1 * MIN,
  'market-sync:upcoming': 10 * MIN,
  'market-sync:completed': 10 * MIN,
  'market-sync:zombie-sweep': 2 * HOUR,
  'market-sync:additional-markets': 3 * HOUR,
  'parlay-sync:backend': 15 * MIN,
  'parlay-sync:lite': 30 * MIN,
  'parlay-sync:generate-best': 3 * HOUR,
  'predictions-sync:availability': 2 * HOUR,
  'predictions-sync:progressive': 30 * MIN,
  'multisport-sync': 2 * HOUR,
  'settle-saved-bets': 30 * MIN,
  'clv-sync': 30 * MIN,
  'social:twitter-post': 5 * MIN,
  'social:live-events': 2 * MIN,
  'social:results': 30 * MIN,
  'email:nightly-briefing': 1 * DAY,
  // Weekly Mondays — flag evergreens older than 90d for refresh.
  'blog:evergreen-refresh': 7 * DAY,
}

/**
 * GET /api/admin/cron-health
 *
 * Returns the heartbeat row for every cron the system has ever recorded,
 * augmented with derived freshness/health fields. Admin-only.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await prisma.cronHeartbeat.findMany({
      orderBy: { name: 'asc' },
    })

    const now = Date.now()
    const enriched: HealthRow[] = rows.map((r) => {
      const completedMs = r.lastCompletedAt?.getTime() ?? null
      const ageMs = completedMs == null ? null : now - completedMs
      const expectedInterval = EXPECTED_INTERVAL_MS[r.name]
      const isStale =
        ageMs != null && expectedInterval != null && ageMs > expectedInterval * 2
      let health: HealthRow['health'] = 'unknown'
      if (r.lastStatus === 'error') health = 'failed'
      else if (ageMs == null) health = 'unknown'
      else if (isStale) health = 'stale'
      else if (r.lastStatus === 'ok') health = 'healthy'

      return {
        name: r.name,
        lastStartedAt: r.lastStartedAt?.toISOString() ?? null,
        lastCompletedAt: r.lastCompletedAt?.toISOString() ?? null,
        lastDurationMs: r.lastDurationMs,
        lastStatus: r.lastStatus,
        lastError: r.lastError,
        rowsAffected: r.rowsAffected,
        runCount: r.runCount,
        errorCount: r.errorCount,
        ageMs,
        health,
      }
    })

    return NextResponse.json({
      success: true,
      now: new Date(now).toISOString(),
      rows: enriched,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
