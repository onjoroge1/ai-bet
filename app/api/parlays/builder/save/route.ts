/**
 * POST /api/parlays/builder/save
 * 
 * Save user-created parlay to database
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const saveParlaySchema = z.object({
  legs: z.array(z.object({
    marketId: z.string(), // AdditionalMarketData.id
    matchId: z.string(),
    marketType: z.string(),
    marketSubtype: z.string().nullable(),
    line: z.number().nullable()
  })).min(2).max(5),
  name: z.string().optional(),
  notes: z.string().optional()
})

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Parse and validate request body
    const body = await req.json()
    const validated = saveParlaySchema.parse(body)

    // Fetch market data for all legs
    const marketIds = validated.legs.map(leg => leg.marketId)
    const markets = await prisma.additionalMarketData.findMany({
      where: {
        id: { in: marketIds }
      },
      include: {
        match: {
          select: {
            matchId: true,
            homeTeam: true,
            awayTeam: true,
            league: true,
            kickoffDate: true
          }
        }
      }
    })

    if (markets.length !== validated.legs.length) {
      return NextResponse.json(
        { error: 'One or more markets not found' },
        { status: 404 }
      )
    }

    // Verify all matches are UPCOMING
    const allUpcoming = markets.every(m => m.match.status === 'UPCOMING')
    if (!allUpcoming) {
      return NextResponse.json(
        { error: 'All matches must be upcoming' },
        { status: 400 }
      )
    }

    // Calculate parlay metrics
    const legProbs = markets.map(m => Number(m.consensusProb))
    const combinedProb = legProbs.reduce((prod, prob) => prod * prob, 1)
    
    // Check match diversification
    const matchIds = markets.map(m => m.matchId)
    const uniqueMatches = new Set(matchIds)
    const isMultiGame = uniqueMatches.size > 1
    
    // Calculate correlation penalty
    let hasCorrelation = false
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const m1 = markets[i]
        const m2 = markets[j]
        
        // Check if same match and correlated markets
        if (m1.matchId === m2.matchId) {
          // Same match correlation checks
          if (
            (m1.marketType === '1X2' && m1.marketSubtype === 'HOME' &&
             m2.marketType === 'TOTALS' && m2.marketSubtype === 'OVER' && m2.line && m2.line >= 2.5) ||
            (m1.marketType === '1X2' && m1.marketSubtype === 'HOME' &&
             m2.marketType === 'BTTS' && m2.marketSubtype === 'YES')
          ) {
            hasCorrelation = true
            break
          }
        }
        if (hasCorrelation) break
      }
      if (hasCorrelation) break
    }

    const legCount = markets.length
    const correlationPenalty = isMultiGame
      ? (hasCorrelation ? 0.90 : 0.92) // Multi-game: lower penalty
      : (hasCorrelation ? 0.80 : 0.85) // Single-game: higher penalty

    const adjustedProb = combinedProb * correlationPenalty
    const impliedOdds = 1 / adjustedProb
    
    // Calculate parlay-level edge (if odds available)
    const avgEdge = markets.reduce((sum, m) => sum + Number(m.edgeConsensus) * 100, 0) / markets.length
    const parlayEdge = avgEdge // Simplified for now

    // Get match dates
    const matchDates = markets.map(m => m.match.kickoffDate).sort((a, b) => a.getTime() - b.getTime())
    const earliestKickoff = matchDates[0]
    const latestKickoff = matchDates[matchDates.length - 1]

    // Determine kickoff window
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let kickoffWindow = 'this_week'
    if (earliestKickoff >= today && earliestKickoff < tomorrow) {
      kickoffWindow = 'today'
    } else if (earliestKickoff >= tomorrow && earliestKickoff < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
      kickoffWindow = 'tomorrow'
    }

    // Determine league group
    const leagues = Array.from(new Set(markets.map(m => m.match.league)))
    const leagueGroup = leagues.length === 1 ? leagues[0] : `${leagues.length} leagues`

    // Calculate quality score
    const avgAgreement = markets.reduce((sum, m) => sum + Number(m.modelAgreement), 0) / legCount
    let confidenceTier = 'low'
    if (avgAgreement >= 0.80 && parlayEdge >= 15) {
      confidenceTier = 'high'
    } else if (avgAgreement >= 0.70 && parlayEdge >= 10) {
      confidenceTier = 'medium'
    }

    // Create parlay
    const parlayId = randomUUID()
    const parlayConsensus = await prisma.parlayConsensus.create({
      data: {
        parlayId,
        apiVersion: 'v2',
        legCount,
        combinedProb,
        correlationPenalty,
        adjustedProb,
        impliedOdds,
        edgePct: parlayEdge,
        confidenceTier,
        parlayType: isMultiGame ? 'cross_league' : 'single_game',
        leagueGroup,
        earliestKickoff,
        latestKickoff,
        kickoffWindow,
        status: 'active',
        syncedAt: new Date()
      }
    })

    // Create legs
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i]
      const leg = validated.legs[i]

      // Determine outcome
      let outcome = 'H'
      if (market.marketType === '1X2') {
        outcome = market.marketSubtype === 'HOME' ? 'H' : market.marketSubtype === 'AWAY' ? 'A' : 'D'
      } else if (market.marketType === 'TOTALS') {
        outcome = market.marketSubtype === 'OVER' ? 'OVER' : 'UNDER'
      } else if (market.marketType === 'BTTS') {
        outcome = market.marketSubtype === 'YES' ? 'YES' : 'NO'
      } else if (market.marketType === 'DNB') {
        outcome = market.marketSubtype === 'HOME' ? 'DNB_H' : 'DNB_A'
      }

      await prisma.parlayLeg.create({
        data: {
          parlayId: parlayConsensus.id,
          matchId: market.matchId,
          outcome,
          homeTeam: market.match.homeTeam,
          awayTeam: market.match.awayTeam,
          modelProb: market.consensusProb,
          decimalOdds: market.decimalOdds || 0,
          edge: Number(market.edgeConsensus),
          legOrder: i + 1,
          additionalMarketId: market.id
        }
      })
    }

    logger.info('User parlay saved', {
      tags: ['api', 'parlays', 'builder'],
      data: {
        userId,
        parlayId: parlayConsensus.parlayId,
        legCount,
        isMultiGame
      }
    })

    return NextResponse.json({
      success: true,
      parlay: {
        parlayId: parlayConsensus.parlayId,
        legCount,
        combinedProb,
        adjustedProb,
        parlayEdge,
        confidenceTier,
        parlayType: isMultiGame ? 'multi_game' : 'single_game',
        isMultiGame
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Error saving user parlay', {
      tags: ['api', 'parlays', 'builder'],
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

