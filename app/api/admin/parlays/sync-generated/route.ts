import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

interface MarketData {
  dnb?: { home: number; away: number }
  btts?: { yes: number; no: number }
  totals?: Record<string, { over: number; under: number }>
  double_chance?: { "12": number; "1X": number; "X2": number }
  win_to_nil?: { home: number; away: number }
}

interface SGP {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: Date
  legs: Array<{
    market: string
    side: string
    probability: number
    description: string
    outcome: string
  }>
  combinedProb: number
  fairOdds: number
  confidence: 'high' | 'medium' | 'low'
}

async function generateSGPs(): Promise<SGP[]> {
  const upcomingMatches = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      kickoffDate: { gte: new Date() },
      isActive: true
    },
    select: {
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
      kickoffDate: true
    }
  })

  const upcomingMatchIdSet = new Set(upcomingMatches.map(m => m.matchId))
  const quickPurchases = await prisma.quickPurchase.findMany({
    where: {
      matchId: { in: Array.from(upcomingMatchIdSet) },
      isActive: true,
      isPredictionActive: true,
      predictionData: { not: null }
    },
    select: {
      matchId: true,
      predictionData: true
    }
  })

  const sgps: SGP[] = []

  for (const qp of quickPurchases) {
    const match = upcomingMatches.find(m => m.matchId === qp.matchId)
    if (!match) continue

    const predictionData = qp.predictionData as any
    const marketsV2 = predictionData?.additional_markets_v2 as MarketData | undefined

    if (!marketsV2) continue

    const legs: SGP['legs'] = []

    if (marketsV2.dnb) {
      if (marketsV2.dnb.home >= 0.55) {
        legs.push({
          market: 'DNB',
          side: 'HOME',
          probability: marketsV2.dnb.home,
          description: `Draw No Bet - Home`,
          outcome: 'H'
        })
      }
      if (marketsV2.dnb.away >= 0.55) {
        legs.push({
          market: 'DNB',
          side: 'AWAY',
          probability: marketsV2.dnb.away,
          description: `Draw No Bet - Away`,
          outcome: 'A'
        })
      }
    }

    if (marketsV2.totals) {
      if (marketsV2.totals['3_5']?.under >= 0.55) {
        legs.push({
          market: 'TOTALS',
          side: 'UNDER',
          probability: marketsV2.totals['3_5'].under,
          description: `Under 3.5 Goals`,
          outcome: 'UNDER_3_5'
        })
      }
      if (marketsV2.totals['4_5']?.under >= 0.55) {
        legs.push({
          market: 'TOTALS',
          side: 'UNDER',
          probability: marketsV2.totals['4_5'].under,
          description: `Under 4.5 Goals`,
          outcome: 'UNDER_4_5'
        })
      }
      if (marketsV2.totals['2_5']?.over >= 0.55) {
        legs.push({
          market: 'TOTALS',
          side: 'OVER',
          probability: marketsV2.totals['2_5'].over,
          description: `Over 2.5 Goals`,
          outcome: 'OVER_2_5'
        })
      }
    }

    if (marketsV2.btts) {
      if (marketsV2.btts.no >= 0.55) {
        legs.push({
          market: 'BTTS',
          side: 'NO',
          probability: marketsV2.btts.no,
          description: `Both Teams to Score - No`,
          outcome: 'BTTS_NO'
        })
      }
      if (marketsV2.btts.yes >= 0.55) {
        legs.push({
          market: 'BTTS',
          side: 'YES',
          probability: marketsV2.btts.yes,
          description: `Both Teams to Score - Yes`,
          outcome: 'BTTS_YES'
        })
      }
    }

    if (marketsV2.double_chance) {
      if (marketsV2.double_chance['1X'] >= 0.55) {
        legs.push({
          market: 'DOUBLE_CHANCE',
          side: '1X',
          probability: marketsV2.double_chance['1X'],
          description: `Double Chance 1X`,
          outcome: '1X'
        })
      }
      if (marketsV2.double_chance['X2'] >= 0.55) {
        legs.push({
          market: 'DOUBLE_CHANCE',
          side: 'X2',
          probability: marketsV2.double_chance['X2'],
          description: `Double Chance X2`,
          outcome: 'X2'
        })
      }
    }

    if (legs.length >= 2) {
      const safeLegs = legs.filter(l => l.probability >= 0.55).slice(0, 3)
      if (safeLegs.length >= 2) {
        for (let i = 0; i < safeLegs.length - 1; i++) {
          for (let j = i + 1; j < safeLegs.length; j++) {
            const leg1 = safeLegs[i]
            const leg2 = safeLegs[j]

            if (leg1.market === leg2.market && leg1.side !== leg2.side) continue

            const combinedProb = leg1.probability * leg2.probability
            const fairOdds = 1 / combinedProb
            const correlationPenalty = 0.85 // Default correlation penalty for SGPs
            const adjustedProb = combinedProb * correlationPenalty
            const impliedOdds = 1 / adjustedProb
            const edgePct = ((impliedOdds - fairOdds) / fairOdds) * 100

            sgps.push({
              matchId: match.matchId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              league: match.league,
              kickoffDate: match.kickoffDate,
              legs: [leg1, leg2],
              combinedProb,
              fairOdds,
              confidence: combinedProb >= 0.30 ? 'high' : combinedProb >= 0.20 ? 'medium' : 'low'
            })

            if (safeLegs.length >= 3 && j < safeLegs.length - 1) {
              for (let k = j + 1; k < safeLegs.length; k++) {
                const leg3 = safeLegs[k]
                if (leg1.market === leg3.market && leg1.side !== leg3.side) continue
                if (leg2.market === leg3.market && leg2.side !== leg3.side) continue

                const combinedProb3 = leg1.probability * leg2.probability * leg3.probability
                const fairOdds3 = 1 / combinedProb3
                const correlationPenalty3 = 0.80
                const adjustedProb3 = combinedProb3 * correlationPenalty3
                const impliedOdds3 = 1 / adjustedProb3
                const edgePct3 = ((impliedOdds3 - fairOdds3) / fairOdds3) * 100

                sgps.push({
                  matchId: match.matchId,
                  homeTeam: match.homeTeam,
                  awayTeam: match.awayTeam,
                  league: match.league,
                  kickoffDate: match.kickoffDate,
                  legs: [leg1, leg2, leg3],
                  combinedProb: combinedProb3,
                  fairOdds: fairOdds3,
                  confidence: combinedProb3 >= 0.20 ? 'medium' : 'low'
                })
              }
            }
          }
        }
      }
    }
  }

  return sgps.sort((a, b) => b.combinedProb - a.combinedProb)
}

/**
 * POST /api/admin/parlays/sync-generated - Generate and sync parlays to database
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Syncing generated parlays to database', {
      tags: ['api', 'admin', 'parlays', 'sync']
    })

    const sgps = await generateSGPs()
    let created = 0
    let skipped = 0
    let errors = 0

    for (const sgp of sgps) {
      try {
        // Verify match exists in MarketMatch and get team names
        const matchData = await prisma.marketMatch.findUnique({
          where: { matchId: sgp.matchId },
          select: {
            homeTeam: true,
            awayTeam: true,
            league: true
          }
        })

        if (!matchData) {
          logger.warn('Match not found in MarketMatch, skipping parlay', {
            tags: ['api', 'admin', 'parlays', 'sync'],
            data: { matchId: sgp.matchId }
          })
          skipped++
          continue
        }

        // Use MarketMatch team names (most reliable)
        const homeTeam = matchData.homeTeam || sgp.homeTeam
        const awayTeam = matchData.awayTeam || sgp.awayTeam

        if (homeTeam === 'TBD' || awayTeam === 'TBD' || !homeTeam || !awayTeam) {
          logger.warn('Match has invalid team names, skipping parlay', {
            tags: ['api', 'admin', 'parlays', 'sync'],
            data: { matchId: sgp.matchId, homeTeam, awayTeam }
          })
          skipped++
          continue
        }

        // Check if parlay already exists (same match, same leg outcomes)
        const newLegOutcomes = sgp.legs.map(l => l.outcome).sort().join('|')
        const existing = await prisma.parlayConsensus.findFirst({
          where: {
            parlayType: 'single_game',
            legs: {
              every: {
                matchId: sgp.matchId
              },
              some: {
                outcome: { in: sgp.legs.map(l => l.outcome) }
              }
            }
          },
          include: { 
            legs: {
              orderBy: { legOrder: 'asc' }
            }
          }
        })

        if (existing) {
          // Check if legs match exactly
          const existingLegOutcomes = existing.legs.map(l => l.outcome).sort().join('|')
          
          if (existingLegOutcomes === newLegOutcomes && existing.legs.length === sgp.legs.length) {
            skipped++
            continue
          }
        }

        // Calculate parlay metrics
        const correlationPenalty = sgp.legs.length === 2 ? 0.85 : 0.80
        const adjustedProb = sgp.combinedProb * correlationPenalty
        const impliedOdds = 1 / adjustedProb
        const edgePct = ((impliedOdds - sgp.fairOdds) / sgp.fairOdds) * 100

        // Create parlay
        const parlayId = randomUUID()
        const parlayConsensus = await prisma.parlayConsensus.create({
          data: {
            parlayId,
            apiVersion: 'v2',
            legCount: sgp.legs.length,
            combinedProb: sgp.combinedProb,
            correlationPenalty,
            adjustedProb,
            impliedOdds,
            edgePct,
            confidenceTier: sgp.confidence,
            parlayType: 'single_game',
            leagueGroup: matchData.league || sgp.league,
            earliestKickoff: sgp.kickoffDate,
            latestKickoff: sgp.kickoffDate,
            kickoffWindow: 'today',
            status: 'active',
            syncedAt: new Date()
          }
        })

        // Create legs
        for (let i = 0; i < sgp.legs.length; i++) {
          const leg = sgp.legs[i]
          await prisma.parlayLeg.create({
            data: {
              parlayId: parlayConsensus.id,
              matchId: sgp.matchId,
              outcome: leg.outcome,
              homeTeam, // Use validated team names from MarketMatch
              awayTeam, // Use validated team names from MarketMatch
              modelProb: leg.probability,
              decimalOdds: 1 / leg.probability,
              edge: edgePct / sgp.legs.length,
              legOrder: i + 1
            }
          })
        }

        created++
      } catch (error) {
        errors++
        logger.error('Error creating parlay', {
          tags: ['api', 'admin', 'parlays', 'sync'],
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            matchId: sgp.matchId
          }
        })
      }
    }

    logger.info('Completed syncing parlays', {
      tags: ['api', 'admin', 'parlays', 'sync'],
      data: { created, skipped, errors, total: sgps.length }
    })

    return NextResponse.json({
      success: true,
      message: `Synced ${created} parlays (${skipped} skipped, ${errors} errors)`,
      stats: {
        generated: sgps.length,
        created,
        skipped,
        errors
      }
    })
  } catch (error) {
    logger.error('Error syncing parlays', {
      tags: ['api', 'admin', 'parlays', 'sync'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to sync parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

