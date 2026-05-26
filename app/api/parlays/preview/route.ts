import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/parlays/preview — public premium-only parlay preview.
 *
 * Replaces the legacy ParlayConsensus surface that ran at −55% ROI
 * (see Plan 2026-05-15 audit). Returns PENDING premium parlays only —
 * combinations of premium-qualified picks within a 48h kickoff window.
 *
 * Backfilled audit table at /performance covers historical performance.
 *
 * Default leg counts surfaced publicly: 2 + 3. 4-leg and 5-leg are
 * captured in the DB for the audit but not shown publicly because the
 * 90-day backfill showed 4-leg at −16.6% ROI and 5-leg at −45%.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const includeAllLegCounts = url.searchParams.get('all') === '1'
    const allowedLegCounts = includeAllLegCounts ? [2, 3, 4, 5] : [2, 3]

    const now = new Date()
    const parlays = await prisma.premiumParlay.findMany({
      where: {
        result: 'pending',
        legCount: { in: allowedLegCounts },
        latestKickoff: { gte: now },
        surfacedBy: 'live',  // exclude backfill rows from public preview
      },
      select: {
        id: true,
        legCount: true,
        combinedOdds: true,
        earliestKickoff: true,
        latestKickoff: true,
        publishedAt: true,
        legs: {
          select: {
            legOrder: true,
            oddsAtPublish: true,
            homeTeam: true,
            awayTeam: true,
            league: true,
            market: true,
            selection: true,
            kickoffDate: true,
            pick: { select: { confidence: true, marketMatchId: true } },
          },
          orderBy: { legOrder: 'asc' },
        },
      },
      orderBy: [
        { legCount: 'asc' },           // 2-leg first (highest hit rate)
        { combinedOdds: 'desc' },      // then by payout
      ],
      take: 50,
    })

    const shaped = parlays.map(p => {
      const combinedOdds = Number(p.combinedOdds)
      // Probability ≈ 1 / odds (with vig baked in — same convention used elsewhere)
      const combinedProb = combinedOdds > 0 ? 1 / combinedOdds : 0
      const legSelections = p.legs.map(l => l.selection).join(', ')
      const earliest = p.earliestKickoff
      const latest = p.latestKickoff

      return {
        parlay_id: p.id,
        is_preview: true,                           // every premium parlay shows full data
        masked: false,
        leg_count: p.legCount,
        legs: p.legs.map(l => ({
          edge: 0,                                  // we don't expose edge separately here
          outcome: l.market,
          match_id: l.pick.marketMatchId,
          away_team: l.awayTeam,
          home_team: l.homeTeam,
          model_prob: l.pick.confidence ? Number(l.pick.confidence) : 0,
          decimal_odds: Number(l.oddsAtPublish),
        })),
        combined_prob: +combinedProb.toFixed(4),
        combined_odds: combinedOdds,
        edge_pct: 0,                                // edge displayed differently for premium-only
        confidence_tier: p.legCount === 2 ? 'high' : 'medium',  // empirical from backfill
        parlay_type: 'premium_only',
        earliest_kickoff: earliest.toISOString(),
        latest_kickoff: latest.toISOString(),
        legs_summary: legSelections,
        quality: {
          score: undefined,
          is_tradable: true,
          risk_level: p.legCount === 2 ? 'low' : p.legCount === 3 ? 'medium' : 'high',
        },
      }
    })

    return NextResponse.json({
      parlays: shaped,
      meta: {
        source: 'premium-only',
        leg_counts_shown: allowedLegCounts,
        note: 'Backfilled performance audit available at /performance',
      },
    })
  } catch (error) {
    logger.error('[Parlays Preview] Failed', {
      tags: ['parlays', 'preview', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { parlays: [], error: 'Failed to load parlays' },
      { status: 500 }
    )
  }
}
