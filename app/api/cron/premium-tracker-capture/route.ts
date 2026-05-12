import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'
import { logger } from '@/lib/logger'
import {
  qualifyForTracker,
  consensusToDecimalOdds,
  pickToMarket,
  pickToLabel,
} from '@/lib/premium-tracker/capture-helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET/POST /api/cron/premium-tracker-capture
 *
 * Forward-only capture of premium-qualified picks. Runs every 2 hours
 * (vercel.json). For each UPCOMING match with a v3Model + QuickPurchase
 * prediction, replays the qualification logic (lib/premium-tracker/
 * capture-helpers.ts) and writes a PremiumPickHistory row locked at
 * publish-time odds.
 *
 * Idempotent: the (marketMatchId, market) unique constraint prevents
 * duplicate captures if the cron runs twice for the same match. Once
 * locked, oddsAtPublish + tier + confidence are NEVER overwritten —
 * later runs are no-ops for that match/market.
 *
 * Heartbeat: premium-tracker:capture (2h interval).
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
    hb = await beginCron('premium-tracker:capture')

    const now = new Date()
    // Only capture for matches that haven't started AND will start within
    // a reasonable window (48h). Outside the window, V3 may not be stable
    // yet; inside the window, odds are usually finalized.
    const horizonHours = 48
    const horizon = new Date(now.getTime() + horizonHours * 3600 * 1000)

    // Candidate matches with v3Model populated. Soccer-only in v1.
    const candidates = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        isActive: true,
        kickoffDate: { gte: now, lte: horizon },
        v3Model: { not: { equals: null as unknown as object } },
      },
      select: {
        id: true,
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        v3Model: true,
        consensusOdds: true,
      },
      orderBy: { kickoffDate: 'asc' },
      take: 200,
    })

    // Pre-load existing tracker rows for these matches to skip duplicates.
    const existing = await prisma.premiumPickHistory.findMany({
      where: { marketMatchId: { in: candidates.map(c => c.id) } },
      select: { marketMatchId: true, market: true },
    })
    const existingKey = new Set(existing.map(e => `${e.marketMatchId}::${e.market}`))

    // Pre-load QuickPurchase rows for the v3 predictionData
    const qps = await prisma.quickPurchase.findMany({
      where: {
        matchId: { in: candidates.map(c => c.matchId) },
        predictionData: { not: { equals: null as unknown as object } },
      },
      select: { matchId: true, predictionData: true, premiumScore: true, premiumTier: true },
    })
    const qpByMatchId = new Map(qps.map(qp => [qp.matchId, qp]))

    let capturedCount = 0
    let skippedDuplicate = 0
    let skippedNoOdds = 0
    let skippedNotQualified = 0
    const captured: Array<{ matchId: string; tier: string; market: string; odds: number }> = []

    for (const m of candidates) {
      const qp = qpByMatchId.get(m.matchId)
      const qual = qualifyForTracker({
        v3Model: m.v3Model,
        predictionData: qp?.predictionData ?? null,
        premiumScore: qp?.premiumScore ? Number(qp.premiumScore) : null,
        league: m.league,
      })
      if (!qual) { skippedNotQualified++; continue }

      const market = pickToMarket(qual.pick)
      if (existingKey.has(`${m.id}::${market}`)) { skippedDuplicate++; continue }

      const odds = consensusToDecimalOdds(m.consensusOdds, qual.pick)
      if (odds === null || odds <= 1) { skippedNoOdds++; continue }

      try {
        await prisma.premiumPickHistory.create({
          data: {
            marketMatchId: m.id,
            externalMatchId: m.matchId,
            sport: 'soccer',
            league: m.league,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            market,
            pick: pickToLabel(qual.pick, m.homeTeam, m.awayTeam),
            oddsAtPublish: odds,
            stakeUnits: 1.0,
            stakeDollars: 100,
            tier: qual.tier,
            confidence: qual.confidence,
            surfacedBy: 'getSnapBetPicks',
            publishedAt: now,
            kickoffDate: m.kickoffDate,
            result: 'pending',
            rawSnapshot: {
              v3Model: m.v3Model,
              predictionData: qp?.predictionData ?? null,
              premiumScore: qp?.premiumScore ? Number(qp.premiumScore) : null,
              premiumTier: qp?.premiumTier ?? null,
              consensusOdds: m.consensusOdds,
              reasons: qual.reasons,
              capturedAt: now.toISOString(),
            },
          },
        })
        capturedCount++
        captured.push({ matchId: m.matchId, tier: qual.tier, market, odds })
      } catch (e) {
        // Unique constraint race — another concurrent cron beat us. Safe to skip.
        if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
          skippedDuplicate++
        } else {
          logger.error('[Premium Tracker Capture] Insert failed', {
            tags: ['premium-tracker', 'cron', 'error'],
            data: { matchId: m.matchId, market },
            error: e instanceof Error ? e : undefined,
          })
        }
      }
    }

    logger.info(`[Premium Tracker Capture] +${capturedCount} captured`, {
      tags: ['premium-tracker', 'cron'],
      data: { capturedCount, skippedDuplicate, skippedNoOdds, skippedNotQualified, candidateCount: candidates.length },
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: capturedCount })

    return NextResponse.json({
      success: true,
      capturedCount,
      skippedDuplicate,
      skippedNoOdds,
      skippedNotQualified,
      candidateCount: candidates.length,
      sample: captured.slice(0, 10),
    })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Premium Tracker Capture] Failed', {
      tags: ['premium-tracker', 'cron', 'error'],
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
