import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Zombie Sweep — periodic cleanup of stale UPCOMING matches.
 *
 * A "zombie" is a MarketMatch row still flagged status=UPCOMING whose kickoff
 * is already in the past — because the backend's UPCOMING→LIVE→FINISHED
 * transition never reached it (cancelled/postponed/data gap).
 *
 * Policy:
 *  - 4-48h past kickoff → leave alone. Backend often catches up within a day.
 *  - >48h past kickoff  → try to recover from backend /market?status=finished.
 *      - If found      → transition to FINISHED with score.
 *      - If not found  → flip to CANCELLED (keep isActive=true for admin visibility).
 *
 * Auth: Bearer CRON_SECRET (same pattern as sync-scheduled).
 * Dry run: ?dryRun=true logs what it would do without writing.
 *
 * Schedule: every 2 hours via vercel.json cron.
 */

export const maxDuration = 120
export const runtime = 'nodejs'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || 'betgenius_secure_key_2024'

const STALE_THRESHOLD_HOURS = 48
const GRACE_THRESHOLD_HOURS = 4
// Backend /market?status=finished 500s above limit=100; cap here to avoid the timeout.
// Finished results are served newest-first, so limit=100 covers every zombie created in
// the last few weeks (we have ~50 zombies and run every 2h, so any stale match will be
// well within the recent-100 window when the sweep fires).
const FINISHED_FETCH_LIMIT = 100
const LIVE_FETCH_LIMIT = 50

interface ZombieSweepResult {
  scanned: number
  stillInGrace: number      // 4-48h past, deferred to next sweep
  recoveredAsFinished: number
  recoveredAsLive: number   // edge case: match running into extra time
  cancelled: number
  errors: number
  dryRun: boolean
  details?: Array<{
    matchId: string
    homeTeam: string
    awayTeam: string
    kickoffDate: Date
    hoursPastKickoff: number
    action: 'grace' | 'recover-finished' | 'recover-live' | 'cancel' | 'error'
    note?: string
  }>
}

/**
 * Extract a final-result object from a backend match payload.
 * Mirrors the logic in sync-scheduled/route.ts:transformMatchData so a
 * recovered zombie looks identical to a match that synced through the normal path.
 */
function extractFinalResult(apiMatch: any): any | null {
  const scoreSources = [
    apiMatch.final_result?.score,
    apiMatch.score,
    apiMatch.final_score,
    apiMatch.live_data?.current_score,
  ]
  const finalScore = scoreSources.find(s => s && (s.home !== undefined || s.away !== undefined))
  if (!finalScore) return null
  return apiMatch.final_result || {
    score: { home: finalScore.home ?? 0, away: finalScore.away ?? 0 },
    outcome: apiMatch.outcome ||
      (finalScore.home > finalScore.away ? 'home'
        : finalScore.away > finalScore.home ? 'away'
        : 'draw'),
    outcome_text: apiMatch.outcome_text ||
      (finalScore.home > finalScore.away ? 'Home Win'
        : finalScore.away > finalScore.home ? 'Away Win'
        : 'Draw'),
  }
}

/**
 * Fetch a page of matches from backend by status.
 * Returns a map of matchId → apiMatch so lookup is O(1) against zombies.
 */
async function fetchBackendMatches(status: 'finished' | 'live'): Promise<Map<string, any>> {
  if (!BASE_URL) throw new Error('BACKEND_API_URL not configured')

  const limit = status === 'finished' ? FINISHED_FETCH_LIMIT : LIVE_FETCH_LIMIT
  const url = `${BASE_URL}/market?status=${status}&limit=${limit}&include_v2=false`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) {
    throw new Error(`Backend /market?status=${status} returned ${res.status}`)
  }

  const data = await res.json()
  const matches = (data?.matches || []) as any[]

  const map = new Map<string, any>()
  for (const m of matches) {
    const id = String(m.id ?? m.match_id ?? m.matchId ?? '')
    if (id && id !== 'undefined' && id !== 'null') map.set(id, m)
  }
  return map
}

async function runSweep(dryRun: boolean): Promise<ZombieSweepResult> {
  const now = new Date()
  const graceCutoff = new Date(now.getTime() - GRACE_THRESHOLD_HOURS * 3600 * 1000)
  const staleCutoff = new Date(now.getTime() - STALE_THRESHOLD_HOURS * 3600 * 1000)

  // Find all zombies (UPCOMING + kickoff in past + active)
  const zombies = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      isActive: true,
      kickoffDate: { lt: graceCutoff },
    },
    select: { id: true, matchId: true, homeTeam: true, awayTeam: true, league: true, kickoffDate: true },
    orderBy: { kickoffDate: 'asc' },
  })

  const result: ZombieSweepResult = {
    scanned: zombies.length,
    stillInGrace: 0,
    recoveredAsFinished: 0,
    recoveredAsLive: 0,
    cancelled: 0,
    errors: 0,
    dryRun,
    details: [],
  }

  if (zombies.length === 0) {
    logger.info('[Zombie Sweep] No zombies found — DB is clean', {
      tags: ['cron', 'market', 'zombie-sweep'],
    })
    return result
  }

  logger.info(`[Zombie Sweep] Starting sweep over ${zombies.length} zombies (dryRun=${dryRun})`, {
    tags: ['cron', 'market', 'zombie-sweep'],
  })

  // Pull backend FINISHED and LIVE maps once per run (cheaper than per-match lookup)
  let finishedMap = new Map<string, any>()
  let liveMap = new Map<string, any>()
  try {
    finishedMap = await fetchBackendMatches('finished')
    liveMap = await fetchBackendMatches('live')
    logger.info(`[Zombie Sweep] Fetched backend context: ${finishedMap.size} finished, ${liveMap.size} live`, {
      tags: ['cron', 'market', 'zombie-sweep'],
    })
  } catch (e) {
    logger.error('[Zombie Sweep] Failed to fetch backend context — aborting sweep', {
      tags: ['cron', 'market', 'zombie-sweep', 'error'],
      error: e instanceof Error ? e : undefined,
    })
    throw e
  }

  for (const zombie of zombies) {
    const hoursPastKickoff = (now.getTime() - zombie.kickoffDate.getTime()) / (3600 * 1000)
    const isStale = zombie.kickoffDate < staleCutoff

    // Case 1: backend now has it as FINISHED — recover
    const finishedMatch = finishedMap.get(zombie.matchId)
    if (finishedMatch) {
      const finalResult = extractFinalResult(finishedMatch)
      result.recoveredAsFinished++
      result.details!.push({
        matchId: zombie.matchId,
        homeTeam: zombie.homeTeam,
        awayTeam: zombie.awayTeam,
        kickoffDate: zombie.kickoffDate,
        hoursPastKickoff: Math.round(hoursPastKickoff * 10) / 10,
        action: 'recover-finished',
        note: finalResult ? `score ${finalResult.score?.home}-${finalResult.score?.away}` : 'no-score',
      })
      if (!dryRun) {
        try {
          await prisma.marketMatch.update({
            where: { id: zombie.id },
            data: {
              status: 'FINISHED',
              finalResult: finalResult ?? undefined,
              lastSyncedAt: now,
              syncErrors: 0,
              lastSyncError: null,
              nextSyncAt: null,
            },
          })
        } catch (e) {
          result.errors++
          logger.error(`[Zombie Sweep] Failed to recover ${zombie.matchId} as FINISHED`, {
            tags: ['cron', 'market', 'zombie-sweep', 'error'],
            error: e instanceof Error ? e : undefined,
          })
        }
      }
      continue
    }

    // Case 2: backend still has it as LIVE (match ran long) — transition to LIVE, let normal sync handle
    if (liveMap.get(zombie.matchId)) {
      result.recoveredAsLive++
      result.details!.push({
        matchId: zombie.matchId,
        homeTeam: zombie.homeTeam,
        awayTeam: zombie.awayTeam,
        kickoffDate: zombie.kickoffDate,
        hoursPastKickoff: Math.round(hoursPastKickoff * 10) / 10,
        action: 'recover-live',
      })
      if (!dryRun) {
        try {
          await prisma.marketMatch.update({
            where: { id: zombie.id },
            data: { status: 'LIVE', lastSyncedAt: now, nextSyncAt: new Date(now.getTime() + 30_000) },
          })
        } catch (e) {
          result.errors++
        }
      }
      continue
    }

    // Case 3: not stale enough yet (4-48h) — leave for next sweep
    if (!isStale) {
      result.stillInGrace++
      result.details!.push({
        matchId: zombie.matchId,
        homeTeam: zombie.homeTeam,
        awayTeam: zombie.awayTeam,
        kickoffDate: zombie.kickoffDate,
        hoursPastKickoff: Math.round(hoursPastKickoff * 10) / 10,
        action: 'grace',
        note: `Waiting for backend to transition (${Math.round(hoursPastKickoff)}h past kickoff, cutoff ${STALE_THRESHOLD_HOURS}h)`,
      })
      continue
    }

    // Case 4: stale + not recoverable → mark CANCELLED (preserve row, hide from user-facing queries)
    result.cancelled++
    result.details!.push({
      matchId: zombie.matchId,
      homeTeam: zombie.homeTeam,
      awayTeam: zombie.awayTeam,
      kickoffDate: zombie.kickoffDate,
      hoursPastKickoff: Math.round(hoursPastKickoff * 10) / 10,
      action: 'cancel',
      note: `auto-cancelled after ${Math.round(hoursPastKickoff)}h, backend has no record`,
    })
    if (!dryRun) {
      try {
        await prisma.marketMatch.update({
          where: { id: zombie.id },
          data: {
            status: 'CANCELLED',
            lastSyncedAt: now,
            lastSyncError: `zombie-sweep: auto-cancelled after ${Math.round(hoursPastKickoff)}h past kickoff, backend has no record`,
            nextSyncAt: null,
          },
        })
      } catch (e) {
        result.errors++
        logger.error(`[Zombie Sweep] Failed to cancel ${zombie.matchId}`, {
          tags: ['cron', 'market', 'zombie-sweep', 'error'],
          error: e instanceof Error ? e : undefined,
        })
      }
    }
  }

  logger.info('[Zombie Sweep] Complete', {
    tags: ['cron', 'market', 'zombie-sweep'],
    data: {
      scanned: result.scanned,
      stillInGrace: result.stillInGrace,
      recoveredAsFinished: result.recoveredAsFinished,
      recoveredAsLive: result.recoveredAsLive,
      cancelled: result.cancelled,
      errors: result.errors,
      dryRun,
    },
  })

  return result
}

export async function GET(request: NextRequest) {
  try {
    // Auth: Bearer CRON_SECRET (same pattern as sync-scheduled)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[Zombie Sweep] Unauthorized request', {
        tags: ['cron', 'market', 'zombie-sweep', 'security'],
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') === 'true'

    const result = await runSweep(dryRun)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logger.error('[Zombie Sweep] Fatal error', {
      tags: ['cron', 'market', 'zombie-sweep', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
