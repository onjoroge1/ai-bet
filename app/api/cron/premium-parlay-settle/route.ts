import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'
import { logger } from '@/lib/logger'
import { settleParlay, deriveSecondaryOutcome } from '@/lib/premium-tracker/parlay-builder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET/POST /api/cron/premium-parlay-settle
 *
 * Every hour. Walks pending PremiumParlay rows whose latestKickoff is in
 * the past + 3h (everyone should have a result by then) and rolls them
 * up via settleParlay() if every leg has settled.
 *
 * Heartbeat: premium-parlay:settle
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
    hb = await beginCron('premium-parlay:settle')

    const now = new Date()
    // Look at parlays whose latest kickoff was at least 3 hours ago.
    const cutoff = new Date(now.getTime() - 3 * 3600 * 1000)

    const pending = await prisma.premiumParlay.findMany({
      where: {
        result: 'pending',
        latestKickoff: { lte: cutoff },
      },
      select: {
        id: true,
        stakeDollars: true,
        archetype: true,
        legs: {
          select: {
            pickId: true,
            legType: true,
            market: true,
            selection: true,
            line: true,
            oddsAtPublish: true,
            marketMatchId: true,
            pick: { select: { result: true } },
          },
        },
      },
      take: 500,
    })

    // Pre-load finalResult.score for any SGP overlay legs we need to settle.
    // Collect all marketMatchIds across pending SGP legs.
    const overlayMatchIds = new Set<string>()
    for (const p of pending) {
      for (const l of p.legs) {
        if (l.legType === 'sgp_overlay' && l.marketMatchId) {
          overlayMatchIds.add(l.marketMatchId)
        }
      }
    }
    const scoreByMatchId = new Map<string, { home: number; away: number } | null>()
    if (overlayMatchIds.size > 0) {
      const matches = await prisma.marketMatch.findMany({
        where: { id: { in: [...overlayMatchIds] }, status: 'FINISHED' },
        select: { id: true, finalResult: true },
      })
      for (const m of matches) {
        const fr = m.finalResult as { score?: { home?: number; away?: number } } | null
        if (fr?.score && typeof fr.score.home === 'number' && typeof fr.score.away === 'number') {
          scoreByMatchId.set(m.id, { home: fr.score.home, away: fr.score.away })
        } else {
          scoreByMatchId.set(m.id, null)
        }
      }
    }

    let settled = 0
    let stillPending = 0
    let voided = 0
    const summary: Array<{ id: string; result: string; netDollars: number }> = []

    for (const p of pending) {
      const legResults = p.legs.map(l => {
        if (l.legType === 'sgp_overlay') {
          // Resolve via final score of the underlying match
          const score = l.marketMatchId ? scoreByMatchId.get(l.marketMatchId) : null
          if (score === undefined) {
            // We haven't loaded a score for this match (shouldn't happen given our preload)
            return { result: 'pending' as const, oddsAtPublish: Number(l.oddsAtPublish) }
          }
          const outcome = deriveSecondaryOutcome(
            l.market, l.selection, l.line !== null ? Number(l.line) : null, score,
          )
          // null score → still pending; null outcome → unparseable, treat as void
          let r: 'pending' | 'win' | 'loss' | 'void'
          if (!score) r = 'pending'
          else if (outcome === null) r = 'void'
          else r = outcome
          return { result: r, oddsAtPublish: Number(l.oddsAtPublish) }
        }
        // premium_1x2 — use the linked pick's result
        return {
          result: (l.pick?.result ?? 'pending') as 'pending' | 'win' | 'loss' | 'push' | 'void',
          oddsAtPublish: Number(l.oddsAtPublish),
        }
      })
      const outcome = settleParlay(legResults, Number(p.stakeDollars))
      if (!outcome) { stillPending++; continue }

      await prisma.premiumParlay.update({
        where: { id: p.id },
        data: {
          result: outcome.result,
          settledAt: now,
          netDollars: outcome.netDollars,
        },
      })
      if (outcome.result === 'void') voided++
      else settled++
      if (summary.length < 10) {
        summary.push({ id: p.id, result: outcome.result, netDollars: outcome.netDollars })
      }
    }

    logger.info(`[Premium Parlay Settle] ${settled} settled, ${voided} voided, ${stillPending} still pending`, {
      tags: ['premium-parlay', 'cron'],
      data: { settled, voided, stillPending, scanned: pending.length },
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: settled + voided })

    return NextResponse.json({
      success: true,
      settled, voided, stillPending,
      scanned: pending.length,
      sample: summary,
    })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Premium Parlay Settle] Failed', {
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
