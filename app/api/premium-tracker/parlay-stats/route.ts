import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/premium-tracker/parlay-stats
 *
 * Per-leg-count aggregate stats from PremiumParlay (includes backfill +
 * live captures). Powers the parlay section of /performance.
 *
 * Query: ?window=7|30|90|all  (default 90)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const windowParam = url.searchParams.get('window') || '90'
    const valid = new Set(['7', '30', '90', 'all'])
    if (!valid.has(windowParam)) {
      return NextResponse.json({ success: false, error: 'window must be 7|30|90|all' }, { status: 400 })
    }
    const windowDays = windowParam === 'all' ? 0 : parseInt(windowParam, 10)
    const now = new Date()
    const cutoff = windowDays > 0 ? new Date(now.getTime() - windowDays * 86400 * 1000) : null

    const rows = await prisma.premiumParlay.findMany({
      where: cutoff ? { publishedAt: { gte: cutoff } } : {},
      select: {
        id: true,
        legCount: true,
        combinedOdds: true,
        stakeDollars: true,
        result: true,
        netDollars: true,
        publishedAt: true,
        latestKickoff: true,
        surfacedBy: true,
      },
      orderBy: { publishedAt: 'desc' },
    })

    interface Bucket {
      legCount: number
      total: number
      wins: number
      losses: number
      voids: number
      pending: number
      totalStaked: number
      netDollars: number
      sampleOdds: number[]
    }
    const byLeg = new Map<number, Bucket>()
    function ensure(lc: number): Bucket {
      let b = byLeg.get(lc)
      if (!b) {
        b = { legCount: lc, total: 0, wins: 0, losses: 0, voids: 0, pending: 0, totalStaked: 0, netDollars: 0, sampleOdds: [] }
        byLeg.set(lc, b)
      }
      return b
    }

    let backfillCount = 0
    let liveCount = 0
    let dataStart: Date | null = null

    for (const r of rows) {
      const b = ensure(r.legCount)
      b.total++
      const stake = Number(r.stakeDollars)
      const net = r.netDollars !== null ? Number(r.netDollars) : 0
      if (r.result === 'win') {
        b.wins++
        b.totalStaked += stake
        b.netDollars += net
        b.sampleOdds.push(Number(r.combinedOdds))
      } else if (r.result === 'loss') {
        b.losses++
        b.totalStaked += stake
        b.netDollars += net
        b.sampleOdds.push(Number(r.combinedOdds))
      } else if (r.result === 'void' || r.result === 'push') {
        b.voids++
      } else {
        b.pending++
      }
      if (r.surfacedBy === 'backfill') backfillCount++
      else liveCount++
      if (!dataStart || r.publishedAt < dataStart) dataStart = r.publishedAt
    }

    const buckets = [...byLeg.values()].sort((a, b) => a.legCount - b.legCount).map(b => {
      const settled = b.wins + b.losses
      const hitRatePct = settled > 0 ? +(b.wins / settled * 100).toFixed(2) : 0
      const roiPct = b.totalStaked > 0 ? +(b.netDollars / b.totalStaked * 100).toFixed(2) : 0
      const avgOdds = b.sampleOdds.length > 0
        ? +(b.sampleOdds.reduce((s, n) => s + n, 0) / b.sampleOdds.length).toFixed(3)
        : 0
      return {
        legCount: b.legCount,
        total: b.total,
        wins: b.wins,
        losses: b.losses,
        voids: b.voids,
        pending: b.pending,
        totalStakedDollars: +b.totalStaked.toFixed(2),
        netDollars: +b.netDollars.toFixed(2),
        roiPct,
        hitRatePct,
        avgCombinedOdds: avgOdds,
      }
    })

    // All-tier aggregate
    const totalSettled = buckets.reduce((s, b) => s + b.wins + b.losses, 0)
    const totalNet = buckets.reduce((s, b) => s + b.netDollars, 0)
    const totalStaked = buckets.reduce((s, b) => s + b.totalStakedDollars, 0)
    const totalWins = buckets.reduce((s, b) => s + b.wins, 0)
    const overall = {
      total: buckets.reduce((s, b) => s + b.total, 0),
      settled: totalSettled,
      wins: totalWins,
      losses: totalSettled - totalWins,
      pending: buckets.reduce((s, b) => s + b.pending, 0),
      voids: buckets.reduce((s, b) => s + b.voids, 0),
      totalStakedDollars: +totalStaked.toFixed(2),
      netDollars: +totalNet.toFixed(2),
      roiPct: totalStaked > 0 ? +(totalNet / totalStaked * 100).toFixed(2) : 0,
      hitRatePct: totalSettled > 0 ? +(totalWins / totalSettled * 100).toFixed(2) : 0,
    }

    return NextResponse.json({
      success: true,
      window: { days: windowDays, start: cutoff?.toISOString() || null, end: now.toISOString() },
      overall,
      byLegCount: buckets,
      provenance: {
        backfillCount,
        liveCount,
        dataStartDate: dataStart?.toISOString() || null,
      },
    })
  } catch (error) {
    console.error('[Parlay Stats] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
