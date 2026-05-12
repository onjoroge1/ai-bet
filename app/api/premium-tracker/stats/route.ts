import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import {
  aggregateStats,
  filterRowsByTier,
  filterRowsBySport,
  type TrackerPickRow,
} from '@/lib/premium-tracker/stats'

export const dynamic = 'force-dynamic'

/**
 * GET /api/premium-tracker/stats
 *
 * Public read endpoint. Powers the /performance audit page and the
 * PremiumTrackerCard on blog pages. Always pulls from PremiumPickHistory
 * — never recomputes via getSnapBetPicks at request time.
 *
 * Query params (all optional):
 *   ?window=7|30|90|all     — rolling window in days (default 30)
 *   ?tier=premium|strong|all — tier filter (default 'all')
 *   ?sport=soccer|all       — sport filter (default 'all')
 *   ?teamId=<externalId>    — scope to picks involving this team
 *                              (matched against PremiumPickHistory via
 *                              MarketMatch.homeTeamId OR awayTeamId)
 *   ?includeRows=1          — include the per-pick rows for the audit table
 *
 * Response shape stable; never breaking, always additive.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const windowParam = sp.get('window') || '30'
    const tier = sp.get('tier') || 'all'
    const sport = sp.get('sport') || 'all'
    const teamId = sp.get('teamId') || undefined
    const includeRows = sp.get('includeRows') === '1'

    const validWindows = new Set(['7', '30', '90', 'all'])
    if (!validWindows.has(windowParam)) {
      return NextResponse.json(
        { success: false, error: 'window must be 7 | 30 | 90 | all' },
        { status: 400 }
      )
    }
    const windowDays = windowParam === 'all' ? 0 : parseInt(windowParam, 10)

    const now = new Date()
    const cutoff = windowDays > 0 ? new Date(now.getTime() - windowDays * 86400 * 1000) : null

    // Build query. Pull only settled + pending rows whose publishedAt is in
    // the window. We pull rows (not aggregate) so the pure helper computes
    // everything — keeps the math single-sourced and testable.
    const where: {
      publishedAt?: { gte: Date }
      marketMatch?: { OR: Array<{ homeTeamId: string } | { awayTeamId: string }> }
    } = {}
    if (cutoff) where.publishedAt = { gte: cutoff }
    if (teamId) {
      where.marketMatch = { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] }
    }

    const rawRows = await prisma.premiumPickHistory.findMany({
      where,
      select: {
        id: true,
        oddsAtPublish: true,
        stakeDollars: true,
        netDollars: true,
        netUnits: true,
        result: true,
        tier: true,
        sport: true,
        league: true,
        market: true,
        pick: true,
        homeTeam: true,
        awayTeam: true,
        publishedAt: true,
        kickoffDate: true,
        settledAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 2000,
    })

    // Map Decimal → number for the pure helpers.
    const rows: TrackerPickRow[] = rawRows.map(r => ({
      oddsAtPublish: Number(r.oddsAtPublish),
      stakeDollars: Number(r.stakeDollars),
      netDollars: r.netDollars !== null ? Number(r.netDollars) : null,
      netUnits: r.netUnits !== null ? Number(r.netUnits) : null,
      result: r.result as TrackerPickRow['result'],
      tier: r.tier,
      sport: r.sport,
      league: r.league,
      publishedAt: r.publishedAt,
      kickoffDate: r.kickoffDate,
      settledAt: r.settledAt,
      market: r.market,
    }))

    const filtered = filterRowsBySport(filterRowsByTier(rows, tier), sport)
    const stats = aggregateStats(filtered)

    // Surface "premium-only" stats alongside the (filtered) total, since the
    // tracker card may want to highlight the premium-tier headline. Cheaper
    // than a second endpoint call.
    const premiumOnly = filterRowsByTier(filtered, 'premium')
    const premiumStats = aggregateStats(premiumOnly)

    return NextResponse.json({
      success: true,
      window: { days: windowDays, start: cutoff?.toISOString() || null, end: now.toISOString() },
      filters: { tier, sport, teamId: teamId || null },
      stats,
      premiumOnly: premiumStats,
      ...(includeRows ? {
        rows: rawRows.map(r => ({
          id: r.id,
          publishedAt: r.publishedAt,
          kickoffDate: r.kickoffDate,
          settledAt: r.settledAt,
          league: r.league,
          homeTeam: r.homeTeam,
          awayTeam: r.awayTeam,
          market: r.market,
          pick: r.pick,
          tier: r.tier,
          odds: Number(r.oddsAtPublish),
          stake: Number(r.stakeDollars),
          result: r.result,
          netDollars: r.netDollars !== null ? Number(r.netDollars) : null,
          netUnits: r.netUnits !== null ? Number(r.netUnits) : null,
        })),
      } : {}),
    })
  } catch (error) {
    console.error('[Premium Tracker Stats] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
