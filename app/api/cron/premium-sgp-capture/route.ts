import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'
import { logger } from '@/lib/logger'
import {
  buildSgpVariants,
  type PremiumPickLike,
  type SecondaryMarketRow,
} from '@/lib/premium-tracker/parlay-builder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET/POST /api/cron/premium-sgp-capture
 *
 * Every 2h. For each pending premium pick within the next 48h, look up
 * AdditionalMarketData for the same match and emit SGP variants (1X2 +
 * secondary same-match markets). Each variant lands as a PremiumParlay
 * row with archetype='sgp_single_match'.
 *
 * Heartbeat: premium-sgp:capture
 */
async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let hb: HeartbeatToken | null = null
  try {
    hb = await beginCron('premium-sgp:capture')

    const now = new Date()
    const horizon = new Date(now.getTime() + 48 * 3600 * 1000)

    // Pending premium picks in the window
    const picks = await prisma.premiumPickHistory.findMany({
      where: {
        tier: 'premium',
        result: 'pending',
        kickoffDate: { gte: now, lte: horizon },
      },
      select: {
        id: true, marketMatchId: true, externalMatchId: true,
        market: true, pick: true, oddsAtPublish: true,
        homeTeam: true, awayTeam: true, league: true,
        kickoffDate: true, result: true,
      },
    })

    if (picks.length === 0) {
      if (hb) await endCron(hb, { status: 'ok', rowsAffected: 0 })
      return NextResponse.json({ success: true, picksCount: 0, captured: 0 })
    }

    // ADM for all those matches
    const externalIds = picks.map(p => p.externalMatchId)
    const admRows = await prisma.additionalMarketData.findMany({
      where: { matchId: { in: externalIds } },
      select: {
        matchId: true, marketType: true, marketSubtype: true,
        line: true, consensusProb: true,
      },
    })
    const admByMatch = new Map<string, SecondaryMarketRow[]>()
    for (const r of admRows) {
      if (!r.marketSubtype || r.consensusProb === null) continue
      const arr = admByMatch.get(r.matchId) || []
      arr.push({
        matchId: r.matchId,
        marketType: r.marketType,
        marketSubtype: r.marketSubtype,
        line: r.line !== null ? Number(r.line) : null,
        consensusProb: Number(r.consensusProb),
      })
      admByMatch.set(r.matchId, arr)
    }

    // Idempotency: load existing SGP parlay fingerprints for these matches
    const existing = await prisma.premiumParlay.findMany({
      where: { archetype: 'sgp_single_match', baseMatchId: { in: picks.map(p => p.marketMatchId) } },
      select: { baseMatchId: true, legs: { select: { market: true, selection: true, line: true } } },
    })
    function fingerprint(baseMatchId: string, legs: Array<{ market: string; selection: string; line: number | null }>): string {
      return [baseMatchId, ...legs.map(l => `${l.market}:${l.selection}:${l.line ?? ''}`).sort()].join('|')
    }
    const existingKeys = new Set<string>()
    for (const e of existing) {
      if (!e.baseMatchId) continue
      existingKeys.add(fingerprint(e.baseMatchId, e.legs.map(l => ({
        market: l.market, selection: l.selection, line: l.line !== null ? Number(l.line) : null,
      }))))
    }

    let captured = 0
    let skippedDuplicate = 0
    const sample: Array<{ archetype: string; combinedOdds: number; teams: string }> = []

    for (const p of picks) {
      const rows = admByMatch.get(p.externalMatchId) || []
      if (rows.length === 0) continue

      const basePick: PremiumPickLike = {
        id: p.id,
        marketMatchId: p.marketMatchId,
        market: p.market,
        oddsAtPublish: Number(p.oddsAtPublish),
        homeTeam: p.homeTeam,
        awayTeam: p.awayTeam,
        league: p.league,
        selection: p.pick,
        kickoffDate: p.kickoffDate,
        result: 'pending',
      }
      const variants = buildSgpVariants(basePick, rows)  // pendingOnly=false; live capture

      for (const v of variants) {
        const key = fingerprint(p.marketMatchId,
          v.legs.map(l => ({ market: l.market, selection: l.selection, line: l.line })))
        if (existingKeys.has(key)) { skippedDuplicate++; continue }

        try {
          await prisma.premiumParlay.create({
            data: {
              legCount: v.legCount,
              combinedOdds: v.combinedOdds,
              stakeDollars: 10,
              archetype: 'sgp_single_match',
              baseMatchId: p.marketMatchId,
              sgpLegCount: v.legs.filter(l => l.legType === 'sgp_overlay').length,
              publishedAt: now,
              earliestKickoff: v.earliestKickoff,
              latestKickoff: v.latestKickoff,
              result: 'pending',
              surfacedBy: 'live',
              legs: {
                create: v.legs.map((l, i) => ({
                  pickId: l.legType === 'premium_1x2' ? l.pickId : null,
                  legType: l.legType,
                  legOrder: i,
                  oddsAtPublish: l.oddsAtPublish,
                  homeTeam: l.homeTeam,
                  awayTeam: l.awayTeam,
                  league: l.league,
                  market: l.market,
                  selection: l.selection,
                  line: l.line !== null ? l.line : null,
                  kickoffDate: l.kickoffDate,
                  marketMatchId: l.marketMatchId,
                })),
              },
              rawSnapshot: { archetype: v.archetype, capturedAt: now.toISOString() },
            },
          })
          captured++
          existingKeys.add(key)
          if (sample.length < 5) sample.push({
            archetype: v.archetype,
            combinedOdds: v.combinedOdds,
            teams: `${p.homeTeam} vs ${p.awayTeam}`,
          })
        } catch (e) {
          logger.error('[Premium SGP Capture] Insert failed', {
            tags: ['premium-sgp', 'cron', 'error'],
            error: e instanceof Error ? e : undefined,
          })
        }
      }
    }

    logger.info(`[Premium SGP Capture] +${captured}`, {
      tags: ['premium-sgp', 'cron'],
      data: { picksCount: picks.length, captured, skippedDuplicate },
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: captured })
    return NextResponse.json({
      success: true,
      picksCount: picks.length,
      captured,
      skippedDuplicate,
      sample,
    })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Premium SGP Capture] Failed', {
      tags: ['premium-sgp', 'cron', 'error'],
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
