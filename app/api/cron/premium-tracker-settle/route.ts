import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'
import { logger } from '@/lib/logger'
import { outcomeFromFinalResult, settlePick } from '@/lib/premium-tracker/capture-helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET/POST /api/cron/premium-tracker-settle
 *
 * Hourly settlement of pending PremiumPickHistory rows whose parent match
 * has FINISHED. Reads MarketMatch.finalResult, derives the outcome side,
 * computes flat-$100 P/L via settlePick(), persists result + netDollars +
 * netUnits.
 *
 * Idempotent: only operates on `result = 'pending'`. Settled rows are
 * NEVER modified again — the audit table is append-only post-settlement.
 *
 * Heartbeat: premium-tracker:settle (1h interval).
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
    hb = await beginCron('premium-tracker:settle')

    // Find pending picks whose match has finished.
    const pending = await prisma.premiumPickHistory.findMany({
      where: {
        result: 'pending',
        marketMatch: { status: 'FINISHED' },
      },
      select: {
        id: true,
        market: true,
        oddsAtPublish: true,
        stakeDollars: true,
        marketMatch: { select: { finalResult: true, matchId: true } },
      },
      take: 200,
      orderBy: { kickoffDate: 'asc' },
    })

    let settledCount = 0
    let voidCount = 0
    let unparseable = 0
    const settled: Array<{ id: string; result: string; netDollars: number }> = []

    for (const row of pending) {
      const outcome = outcomeFromFinalResult(row.marketMatch.finalResult)
      if (!outcome) {
        // FINISHED but we couldn't parse a 1X2 outcome (cancelled w/o score,
        // walkover, etc). Mark as void so it stops appearing in the pending
        // queue but doesn't pollute ROI math.
        await prisma.premiumPickHistory.update({
          where: { id: row.id },
          data: {
            result: 'void',
            settledAt: new Date(),
            netDollars: 0,
            netUnits: 0,
            notes: 'finalResult lacked parseable 1X2 outcome',
          },
        })
        voidCount++
        unparseable++
        continue
      }

      // Reverse market → side
      const pickedSide = row.market === '1X2_HOME' ? 'home' : row.market === '1X2_AWAY' ? 'away' : 'draw'
      const outcomeResult = settlePick(
        pickedSide,
        outcome,
        Number(row.oddsAtPublish),
        Number(row.stakeDollars),
      )
      if (!outcomeResult) {
        unparseable++
        continue
      }

      await prisma.premiumPickHistory.update({
        where: { id: row.id },
        data: {
          result: outcomeResult.result,
          settledAt: new Date(),
          netDollars: outcomeResult.netDollars,
          netUnits: outcomeResult.netUnits,
        },
      })
      settledCount++
      settled.push({ id: row.id, result: outcomeResult.result, netDollars: outcomeResult.netDollars })
    }

    logger.info(`[Premium Tracker Settle] ${settledCount} settled, ${voidCount} voided`, {
      tags: ['premium-tracker', 'cron'],
      data: { settledCount, voidCount, unparseable, pendingScanned: pending.length },
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: settledCount + voidCount })

    return NextResponse.json({
      success: true,
      settledCount,
      voidCount,
      unparseable,
      pendingScanned: pending.length,
      sample: settled.slice(0, 10),
    })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Premium Tracker Settle] Failed', {
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
