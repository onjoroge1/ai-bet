import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/parlays/preview — public premium-only parlay surface.
 *
 * Replaces the legacy ParlayConsensus surface that ran at −55% ROI
 * (see Plan 2026-05-15 audit). Returns three sections so the page is
 * always useful, even when no live picks qualify (which is most of the
 * time — premium 1X2 picks gate at V3 ≥60%):
 *
 *   pending[]  — live parlays currently capturable (often empty)
 *   recent[]   — last N settled parlays (audit / proof)
 *   stats      — 30d aggregate (win/loss count, ROI, net $)
 *
 * By default 2-leg and 3-leg cross-match + 2-leg SGP overlays. Larger
 * leg counts are captured in the DB for the audit but not shown
 * publicly (the backfill data didn't support the +ROI claim with
 * confidence on 4/5-leg variants).
 */

interface ShapedLeg {
  outcome: string
  match_id: string | null
  away_team: string
  home_team: string
  league: string | null
  model_prob: number
  decimal_odds: number
  kickoff: string
  leg_type: string                          // 'premium_1x2' | 'sgp_overlay'
}

interface ShapedParlay {
  parlay_id: string
  archetype: string                         // 'cross_match' | 'sgp_single_match'
  leg_count: number
  sgp_leg_count: number
  legs: ShapedLeg[]
  combined_odds: number
  combined_prob: number
  earliest_kickoff: string
  latest_kickoff: string
  risk_level: 'low' | 'medium' | 'high'
  // Settlement (null for pending)
  result?: 'pending' | 'win' | 'loss' | 'void'
  settled_at?: string
  net_dollars?: number
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const includeAllLegCounts = url.searchParams.get('all') === '1'
    const allowedLegCounts = includeAllLegCounts ? [2, 3, 4, 5] : [2, 3]
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000)

    function shape(p: {
      id: string
      archetype: string
      legCount: number
      sgpLegCount: number
      combinedOdds: { toString(): string }
      earliestKickoff: Date
      latestKickoff: Date
      result?: string
      settledAt?: Date | null
      netDollars?: { toString(): string } | null
      legs: Array<{
        legOrder: number
        oddsAtPublish: { toString(): string }
        homeTeam: string
        awayTeam: string
        league: string | null
        market: string
        selection: string
        kickoffDate: Date
        legType: string
        pick: { confidence: { toString(): string } | null; marketMatchId: string } | null
      }>
    }): ShapedParlay {
      const combinedOdds = Number(p.combinedOdds)
      const combinedProb = combinedOdds > 0 ? 1 / combinedOdds : 0
      const risk: 'low' | 'medium' | 'high' =
        p.legCount === 2 ? 'low' : p.legCount === 3 ? 'medium' : 'high'

      return {
        parlay_id: p.id,
        archetype: p.archetype,
        leg_count: p.legCount,
        sgp_leg_count: p.sgpLegCount,
        legs: p.legs.map(l => ({
          outcome: l.selection,
          match_id: l.pick?.marketMatchId ?? null,
          away_team: l.awayTeam,
          home_team: l.homeTeam,
          league: l.league,
          model_prob: l.pick?.confidence ? Number(l.pick.confidence) : 1 / Number(l.oddsAtPublish),
          decimal_odds: Number(l.oddsAtPublish),
          kickoff: l.kickoffDate.toISOString(),
          leg_type: l.legType,
        })),
        combined_odds: +combinedOdds.toFixed(3),
        combined_prob: +combinedProb.toFixed(4),
        earliest_kickoff: p.earliestKickoff.toISOString(),
        latest_kickoff: p.latestKickoff.toISOString(),
        risk_level: risk,
        result: p.result as ShapedParlay['result'] | undefined,
        settled_at: p.settledAt?.toISOString(),
        net_dollars: p.netDollars !== undefined && p.netDollars !== null ? Number(p.netDollars) : undefined,
      }
    }

    // ── Pending live parlays ───────────────────────────────────────────
    const pending = await prisma.premiumParlay.findMany({
      where: {
        result: 'pending',
        legCount: { in: allowedLegCounts },
        latestKickoff: { gte: now },
        surfacedBy: 'live',
      },
      select: {
        id: true, archetype: true, legCount: true, sgpLegCount: true,
        combinedOdds: true, earliestKickoff: true, latestKickoff: true,
        legs: {
          select: {
            legOrder: true, legType: true,
            oddsAtPublish: true, homeTeam: true, awayTeam: true, league: true,
            market: true, selection: true, kickoffDate: true,
            pick: { select: { confidence: true, marketMatchId: true } },
          },
          orderBy: { legOrder: 'asc' },
        },
      },
      orderBy: [{ archetype: 'asc' }, { legCount: 'asc' }, { combinedOdds: 'desc' }],
      take: 20,
    })

    // ── Recent settled parlays (proof) ─────────────────────────────────
    const recent = await prisma.premiumParlay.findMany({
      where: {
        result: { in: ['win', 'loss'] },
        legCount: { in: allowedLegCounts },
        archetype: { in: ['cross_match', 'sgp_single_match'] },
      },
      select: {
        id: true, archetype: true, legCount: true, sgpLegCount: true,
        combinedOdds: true, earliestKickoff: true, latestKickoff: true,
        result: true, settledAt: true, netDollars: true,
        legs: {
          select: {
            legOrder: true, legType: true,
            oddsAtPublish: true, homeTeam: true, awayTeam: true, league: true,
            market: true, selection: true, kickoffDate: true,
            pick: { select: { confidence: true, marketMatchId: true } },
          },
          orderBy: { legOrder: 'asc' },
        },
      },
      orderBy: { settledAt: 'desc' },
      take: 12,
    })

    // ── 30d aggregate stats ───────────────────────────────────────────
    const settled30d = await prisma.premiumParlay.findMany({
      where: {
        result: { in: ['win', 'loss'] },
        legCount: { in: allowedLegCounts },
        settledAt: { gte: thirtyDaysAgo },
      },
      select: {
        result: true, netDollars: true, stakeDollars: true,
        archetype: true, legCount: true, combinedOdds: true,
      },
    })

    let wins = 0, losses = 0, stake = 0, net = 0, oddsSum = 0
    const byArchetype: Record<string, { wins: number; losses: number; net: number; stake: number }> = {}
    for (const r of settled30d) {
      const s = Number(r.stakeDollars)
      const n = r.netDollars !== null ? Number(r.netDollars) : 0
      if (r.result === 'win') wins++
      else losses++
      stake += s
      net += n
      oddsSum += Number(r.combinedOdds)
      const key = r.archetype
      if (!byArchetype[key]) byArchetype[key] = { wins: 0, losses: 0, net: 0, stake: 0 }
      byArchetype[key].wins += r.result === 'win' ? 1 : 0
      byArchetype[key].losses += r.result === 'loss' ? 1 : 0
      byArchetype[key].net += n
      byArchetype[key].stake += s
    }
    const settledCount = wins + losses
    const stats = {
      window_days: 30,
      settled: settledCount,
      wins,
      losses,
      hit_rate_pct: settledCount > 0 ? +(wins / settledCount * 100).toFixed(1) : 0,
      net_dollars: +net.toFixed(2),
      total_staked: +stake.toFixed(2),
      roi_pct: stake > 0 ? +(net / stake * 100).toFixed(2) : 0,
      avg_combined_odds: settledCount > 0 ? +(oddsSum / settledCount).toFixed(2) : 0,
      by_archetype: Object.fromEntries(
        Object.entries(byArchetype).map(([k, v]) => [k, {
          settled: v.wins + v.losses,
          wins: v.wins, losses: v.losses,
          hit_rate_pct: (v.wins + v.losses) > 0 ? +(v.wins / (v.wins + v.losses) * 100).toFixed(1) : 0,
          net_dollars: +v.net.toFixed(2),
          roi_pct: v.stake > 0 ? +(v.net / v.stake * 100).toFixed(2) : 0,
        }])
      ),
    }

    return NextResponse.json({
      pending: pending.map(shape),
      recent: recent.map(shape),
      stats,
      meta: {
        source: 'premium-only',
        leg_counts_shown: allowedLegCounts,
        note: pending.length === 0
          ? 'No live parlays right now — premium picks require V3 ≥60% confidence and are rare. Audit at /performance.'
          : undefined,
      },
    })
  } catch (error) {
    logger.error('[Parlays Preview] Failed', {
      tags: ['parlays', 'preview', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { pending: [], recent: [], stats: null, error: 'Failed to load parlays' },
      { status: 500 }
    )
  }
}
