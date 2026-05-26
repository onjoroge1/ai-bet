import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'
import { logger } from '@/lib/logger'
import { buildParlayCandidates, parlayKey, type PremiumPickLike } from '@/lib/premium-tracker/parlay-builder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET/POST /api/cron/premium-parlay-capture
 *
 * Every 2h. Builds premium-only parlays from the pool of pending premium
 * PremiumPickHistory rows in a 48h forward window. For each (legCount ∈
 * {2,3,4,5}) emits up to N parlays sorted by combined odds desc.
 *
 * Heartbeat: premium-parlay:capture
 * Auth: Bearer CRON_SECRET.
 */

const WINDOW_HOURS = 48
const LEG_COUNTS = [2, 3, 4, 5]
const CAP_PER_LEG_COUNT = 5    // max 5 parlays per leg-count, per run

async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let hb: HeartbeatToken | null = null
  try {
    hb = await beginCron('premium-parlay:capture')

    const now = new Date()
    const horizon = new Date(now.getTime() + WINDOW_HOURS * 3600 * 1000)

    // Pool: every pending premium pick whose kickoff is in the next 48h.
    const pool = await prisma.premiumPickHistory.findMany({
      where: {
        tier: 'premium',
        result: 'pending',
        kickoffDate: { gte: now, lte: horizon },
      },
      select: {
        id: true, marketMatchId: true, market: true,
        oddsAtPublish: true,
        homeTeam: true, awayTeam: true, league: true,
        pick: true,
        kickoffDate: true,
        result: true,
      },
      orderBy: { kickoffDate: 'asc' },
    })

    if (pool.length < 2) {
      logger.info(`[Premium Parlay Capture] Pool too small (${pool.length}); skipping`, {
        tags: ['premium-parlay', 'cron'],
      })
      if (hb) await endCron(hb, { status: 'ok', rowsAffected: 0 })
      return NextResponse.json({ success: true, poolSize: pool.length, captured: 0 })
    }

    const inputs: PremiumPickLike[] = pool.map(r => ({
      id: r.id,
      marketMatchId: r.marketMatchId,
      market: r.market,
      oddsAtPublish: Number(r.oddsAtPublish),
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      league: r.league,
      selection: r.pick,
      kickoffDate: r.kickoffDate,
      result: r.result as PremiumPickLike['result'],
    }))

    const candidates = buildParlayCandidates(inputs, {
      legCounts: LEG_COUNTS,
      windowHours: WINDOW_HOURS,
      capPerLegCount: CAP_PER_LEG_COUNT,
    })

    // Idempotency: skip parlays whose exact leg set we've already captured.
    const existingLegs = await prisma.premiumParlayLeg.findMany({
      where: { pickId: { in: pool.map(p => p.id) } },
      select: { parlayId: true, pickId: true },
    })
    // Group existing leg sets by parlayId
    const existingSetsByParlay = new Map<string, Set<string>>()
    for (const l of existingLegs) {
      const s = existingSetsByParlay.get(l.parlayId) ?? new Set<string>()
      s.add(l.pickId)
      existingSetsByParlay.set(l.parlayId, s)
    }
    const existingKeys = new Set<string>()
    for (const s of existingSetsByParlay.values()) {
      existingKeys.add([...s].sort().join('|'))
    }

    let captured = 0
    let skippedDuplicate = 0
    const sample: Array<{ legCount: number; combinedOdds: number; legs: string[] }> = []
    for (const c of candidates) {
      const key = parlayKey({ legs: c.legs })
      if (existingKeys.has(key)) { skippedDuplicate++; continue }
      try {
        await prisma.premiumParlay.create({
          data: {
            legCount: c.legCount,
            combinedOdds: c.combinedOdds,
            stakeDollars: 10,
            publishedAt: now,
            earliestKickoff: c.earliestKickoff,
            latestKickoff: c.latestKickoff,
            result: 'pending',
            surfacedBy: 'live',
            legs: {
              create: c.legs.map((leg, i) => ({
                pickId: leg.id,
                legOrder: i,
                oddsAtPublish: leg.oddsAtPublish,
                homeTeam: leg.homeTeam,
                awayTeam: leg.awayTeam,
                league: leg.league,
                market: leg.market,
                selection: leg.selection,
                kickoffDate: leg.kickoffDate,
              })),
            },
            rawSnapshot: {
              poolSize: pool.length,
              capturedAt: now.toISOString(),
            },
          },
        })
        captured++
        if (sample.length < 5) {
          sample.push({
            legCount: c.legCount,
            combinedOdds: c.combinedOdds,
            legs: c.legs.map(l => `${l.homeTeam} vs ${l.awayTeam}`),
          })
        }
        existingKeys.add(key)
      } catch (e) {
        logger.error('[Premium Parlay Capture] Insert failed', {
          tags: ['premium-parlay', 'cron', 'error'],
          error: e instanceof Error ? e : undefined,
        })
      }
    }

    logger.info(`[Premium Parlay Capture] +${captured} captured`, {
      tags: ['premium-parlay', 'cron'],
      data: { poolSize: pool.length, captured, skippedDuplicate, candidateCount: candidates.length },
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: captured })

    return NextResponse.json({
      success: true,
      poolSize: pool.length,
      candidateCount: candidates.length,
      captured,
      skippedDuplicate,
      sample,
    })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Premium Parlay Capture] Failed', {
      tags: ['premium-parlay', 'cron', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }
