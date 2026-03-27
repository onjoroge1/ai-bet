/**
 * GET/POST /api/admin/parlays/generate-best-scheduled
 *
 * Cron job endpoint for scheduled curated parlay generation.
 * Generates a small set of high-quality parlays using AdditionalMarketData.
 *
 * Strategy:
 *  A. "Best Picks"   — top 1X2 favourites across different matches
 *  B. "SGP"          — same-game parlays (1X2 + Over/Under + BTTS)
 *  C. "Mixed Market"  — best single-market picks across different matches
 *
 * Before generating, all previously-generated AI parlays (cross_league / single_game)
 * are expired to keep the list fresh.
 *
 * Vercel Cron sends GET requests; both methods are supported.
 * Authenticates using CRON_SECRET environment variable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateBestParlays, GenerationConfig } from '@/lib/parlays/best-parlay-generator'
import { scoreAndUpdateParlay } from '@/lib/parlays/premium-parlay-scorer'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

// ── Save helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a ParlayCombination into a ParlayConsensus + ParlayLeg DB records.
 */
async function saveParlayToDatabase(
  parlay: Awaited<ReturnType<typeof generateBestParlays>>[0],
  matchDataMap: Map<string, { homeTeam: string; awayTeam: string; league: string; kickoffDate: Date }>
): Promise<{ created: boolean; parlayId: string }> {
  try {
    const matchDates = parlay.matchIds
      .map(id => matchDataMap.get(id)?.kickoffDate)
      .filter((d): d is Date => d !== undefined)
      .sort((a, b) => a.getTime() - b.getTime())

    if (matchDates.length === 0) {
      throw new Error('No valid match dates found')
    }

    const earliestKickoff = matchDates[0]
    const latestKickoff = matchDates[matchDates.length - 1]

    // Kickoff window label
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const dayAfter = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)

    let kickoffWindow = 'this_week'
    if (earliestKickoff >= today && earliestKickoff < tomorrow) {
      kickoffWindow = 'today'
    } else if (earliestKickoff >= tomorrow && earliestKickoff < dayAfter) {
      kickoffWindow = 'tomorrow'
    }

    // League group
    const leagues = Array.from(
      new Set(parlay.matchIds.map(id => matchDataMap.get(id)?.league).filter(Boolean))
    )
    const leagueGroup = leagues.length === 1 ? leagues[0] || null : `${leagues.length} leagues`

    const parlayId = randomUUID()

    // ── Duplicate check ──────────────────────────────────────────────────
    const existingParlays = await prisma.parlayConsensus.findMany({
      where: {
        parlayType: parlay.parlayType === 'multi_game' ? 'cross_league' : 'single_game',
        legCount: parlay.legCount,
        status: 'active',
        earliestKickoff: {
          gte: new Date(earliestKickoff.getTime() - 60 * 60 * 1000),
          lte: new Date(earliestKickoff.getTime() + 60 * 60 * 1000),
        },
      },
      include: { legs: true },
    })

    const existingMatchSets = existingParlays.map(ep =>
      [...new Set(ep.legs.map(l => l.matchId))].sort().join(',')
    )
    const newMatchSet = [...parlay.matchIds].sort().join(',')
    if (existingMatchSets.includes(newMatchSet)) {
      return { created: false, parlayId: '' }
    }

    // ── Create ParlayConsensus ───────────────────────────────────────────
    const parlayConsensus = await prisma.parlayConsensus.create({
      data: {
        parlayId,
        apiVersion: 'v2',
        legCount: parlay.legCount,
        combinedProb: parlay.combinedProb,
        correlationPenalty: parlay.correlationPenalty,
        adjustedProb: parlay.adjustedProb,
        impliedOdds: parlay.impliedOdds,
        edgePct: parlay.parlayEdge,
        confidenceTier: parlay.confidenceTier,
        parlayType: parlay.parlayType === 'multi_game' ? 'cross_league' : 'single_game',
        leagueGroup,
        earliestKickoff,
        latestKickoff,
        kickoffWindow,
        status: 'active',
        syncedAt: new Date(),
      },
    })

    // ── Create ParlayLegs ────────────────────────────────────────────────
    for (let i = 0; i < parlay.legs.length; i++) {
      const leg = parlay.legs[i]
      const matchData = matchDataMap.get(leg.matchId)

      if (!matchData) {
        logger.warn('Match data not found for leg', {
          tags: ['parlays', 'generator', 'save'],
          data: { matchId: leg.matchId },
        })
        continue
      }

      let outcome = 'H'
      if (leg.marketType === '1X2') {
        outcome = leg.marketSubtype === 'HOME' ? 'H' : leg.marketSubtype === 'AWAY' ? 'A' : 'D'
      } else if (leg.marketType === 'TOTALS') {
        outcome = leg.marketSubtype === 'OVER' ? 'OVER' : 'UNDER'
      } else if (leg.marketType === 'BTTS') {
        outcome = leg.marketSubtype === 'YES' ? 'YES' : 'NO'
      } else if (leg.marketType === 'DNB') {
        outcome = leg.marketSubtype === 'HOME' ? 'DNB_H' : 'DNB_A'
      }

      await prisma.parlayLeg.create({
        data: {
          parlayId: parlayConsensus.id,
          matchId: leg.matchId,
          outcome,
          homeTeam: matchData.homeTeam,
          awayTeam: matchData.awayTeam,
          modelProb: leg.consensusProb,
          decimalOdds: leg.decimalOdds && leg.decimalOdds > 0
            ? leg.decimalOdds
            : parseFloat((1 / leg.consensusProb).toFixed(2)), // implied fair odds from probability
          edge: leg.edgeConsensus / 100,
          legOrder: i + 1,
          additionalMarketId: leg.id,
        },
      })
    }

    // ── Score premium quality ────────────────────────────────────────────
    try {
      const premiumResult = await scoreAndUpdateParlay(parlayConsensus.id)
      if (premiumResult) {
        logger.info(`Parlay premium scored: ${premiumResult.tier} (${premiumResult.score})`, {
          tags: ['parlays', 'generator', 'premium'],
          data: { parlayId: parlayConsensus.parlayId, score: premiumResult.score, tier: premiumResult.tier },
        })
      }
    } catch (premiumError) {
      // Non-fatal — parlay is still saved
      logger.warn('Failed to score parlay premium', {
        tags: ['parlays', 'generator', 'premium'],
        error: premiumError instanceof Error ? premiumError.message : String(premiumError),
      })
    }

    return { created: true, parlayId: parlayConsensus.parlayId }
  } catch (error) {
    logger.error('Error saving parlay to database', {
      tags: ['parlays', 'generator', 'save'],
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Expire all previously-generated AI parlays (cross_league / single_game)
 * so the UI always shows a fresh, curated set.
 */
async function expireOldAIParlays(): Promise<number> {
  const result = await prisma.parlayConsensus.updateMany({
    where: {
      parlayType: { in: ['cross_league', 'single_game'] },
      status: 'active',
    },
    data: { status: 'expired' },
  })
  return result.count
}

// ── Route handlers ───────────────────────────────────────────────────────────

/** GET  – called by Vercel Cron */
export async function GET(req: NextRequest) {
  return handleRequest(req)
}

/** POST – called manually or via internal fetch */
export async function POST(req: NextRequest) {
  return handleRequest(req)
}

async function handleRequest(req: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      logger.error('CRON_SECRET not configured', { tags: ['parlays', 'cron'] })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron request', { tags: ['parlays', 'cron'] })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Check for premium backfill action ──────────────────────────────
    const { searchParams } = new URL(req.url)
    if (searchParams.get('action') === 'backfill_premium') {
      const { scoreAllActiveParlays } = await import('@/lib/parlays/premium-parlay-scorer')
      const result = await scoreAllActiveParlays()
      logger.info('Premium backfill complete', { tags: ['parlays', 'premium'], data: result })
      return NextResponse.json({ success: true, action: 'backfill_premium', ...result })
    }

    // ── Parse optional config ──────────────────────────────────────────
    let config: GenerationConfig = {}
    try {
      const body = await req.json().catch(() => ({}))
      config = body.config || {}
    } catch {
      // defaults
    }

    logger.info('Scheduled curated parlay generation started', {
      tags: ['parlays', 'cron'],
      data: { config },
    })

    // ── Step 0: Expire old AI parlays ──────────────────────────────────
    const expired = await expireOldAIParlays()
    logger.info(`Expired ${expired} old AI parlays`, { tags: ['parlays', 'cron'] })

    // ── Step 1: Generate parlays ───────────────────────────────────────
    const parlays = await generateBestParlays(config)

    if (parlays.length === 0) {
      logger.info('No parlays generated', { tags: ['parlays', 'cron'] })
      return NextResponse.json({
        success: true,
        message: 'No parlays generated (no eligible markets found)',
        expired,
        parlaysGenerated: 0,
        parlaysCreated: 0,
        parlaysSkipped: 0,
        errors: 0,
      })
    }

    // ── Step 2: Fetch match data for team names / kickoff dates ────────
    const matchIds = Array.from(new Set(parlays.flatMap(p => p.matchIds)))

    const matches = await prisma.marketMatch.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, homeTeam: true, awayTeam: true, league: true, kickoffDate: true },
    })

    const matchDataMap = new Map(
      matches.map(m => [
        m.matchId,
        { homeTeam: m.homeTeam, awayTeam: m.awayTeam, league: m.league, kickoffDate: m.kickoffDate },
      ])
    )

    // ── Step 3: Save parlays ───────────────────────────────────────────
    let created = 0
    let skipped = 0
    let errors = 0

    for (const parlay of parlays) {
      try {
        const missingMatches = parlay.matchIds.filter(id => !matchDataMap.has(id))
        if (missingMatches.length > 0) {
          skipped++
          continue
        }

        const result = await saveParlayToDatabase(parlay, matchDataMap)
        if (result.created) {
          created++
        } else {
          skipped++ // duplicate
        }
      } catch (error) {
        errors++
        logger.error('Error processing parlay', {
          tags: ['parlays', 'cron'],
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('Scheduled curated parlay generation complete', {
      tags: ['parlays', 'cron'],
      data: { expired, parlaysGenerated: parlays.length, created, skipped, errors },
    })

    return NextResponse.json({
      success: true,
      message: `Generated ${parlays.length}, created ${created}, skipped ${skipped}`,
      expired,
      parlaysGenerated: parlays.length,
      parlaysCreated: created,
      parlaysSkipped: skipped,
      errors,
      summary: {
        multiGame: parlays.filter(p => p.isMultiGame).length,
        singleGame: parlays.filter(p => !p.isMultiGame).length,
        byLegCount: {
          2: parlays.filter(p => p.legCount === 2).length,
          3: parlays.filter(p => p.legCount === 3).length,
          4: parlays.filter(p => p.legCount === 4).length,
        },
      },
    })
  } catch (error) {
    logger.error('Error in scheduled curated parlay generation', {
      tags: ['parlays', 'cron'],
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
