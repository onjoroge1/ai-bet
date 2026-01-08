/**
 * GET /api/parlays/builder/markets/[matchId]
 * 
 * Fetch markets for a specific match for parlay builder
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const matchId = params.matchId

    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      )
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams
    const marketType = searchParams.get('marketType') // Filter by market type
    const minProb = parseFloat(searchParams.get('minProb') || '0.50')
    const minAgreement = parseFloat(searchParams.get('minAgreement') || '0.60')

    // Verify match exists
    const match = await prisma.marketMatch.findUnique({
      where: { matchId },
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        status: true
      }
    })

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      )
    }

    if (match.status !== 'UPCOMING') {
      return NextResponse.json(
        { error: 'Match is not upcoming' },
        { status: 400 }
      )
    }

    // Build where clause
    const whereClause: any = {
      matchId,
      consensusProb: { gte: minProb },
      modelAgreement: { gte: minAgreement }
    }

    if (marketType && marketType !== 'all') {
      whereClause.marketType = marketType
    }

    // Fetch markets
    const markets = await prisma.additionalMarketData.findMany({
      where: whereClause,
      select: {
        id: true,
        marketType: true,
        marketSubtype: true,
        line: true,
        v1ModelProb: true,
        v1Confidence: true,
        v1Pick: true,
        v2ModelProb: true,
        v2Confidence: true,
        v2Pick: true,
        consensusProb: true,
        consensusConfidence: true,
        modelAgreement: true,
        decimalOdds: true,
        impliedProb: true,
        edgeConsensus: true,
        riskLevel: true,
        correlationTags: true
      },
      orderBy: [
        { consensusProb: 'desc' },
        { modelAgreement: 'desc' }
      ]
    })

    // Format markets for frontend
    const formattedMarkets = markets.map(market => ({
      id: market.id,
      marketType: market.marketType,
      marketSubtype: market.marketSubtype,
      line: market.line ? Number(market.line) : null,
      v1Model: {
        prob: market.v1ModelProb ? Number(market.v1ModelProb) : null,
        confidence: market.v1Confidence ? Number(market.v1Confidence) : null,
        pick: market.v1Pick
      },
      v2Model: {
        prob: market.v2ModelProb ? Number(market.v2ModelProb) : null,
        confidence: market.v2Confidence ? Number(market.v2Confidence) : null,
        pick: market.v2Pick
      },
      consensus: {
        prob: Number(market.consensusProb),
        confidence: Number(market.consensusConfidence),
        agreement: Number(market.modelAgreement)
      },
      odds: {
        decimal: market.decimalOdds ? Number(market.decimalOdds) : null,
        impliedProb: market.impliedProb ? Number(market.impliedProb) : null
      },
      edge: Number(market.edgeConsensus) * 100, // Convert to percentage
      riskLevel: market.riskLevel,
      correlationTags: market.correlationTags,
      displayLabel: getMarketDisplayLabel(market.marketType, market.marketSubtype, market.line)
    }))

    return NextResponse.json({
      success: true,
      match: {
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        kickoffDate: match.kickoffDate.toISOString()
      },
      markets: formattedMarkets,
      filters: {
        marketType,
        minProb,
        minAgreement
      }
    })
  } catch (error) {
    logger.error('Error fetching markets for builder', {
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

/**
 * Helper function to generate display label for market
 */
function getMarketDisplayLabel(
  marketType: string,
  marketSubtype: string | null,
  line: any
): string {
  switch (marketType) {
    case '1X2':
      if (marketSubtype === 'HOME') return 'Home Win'
      if (marketSubtype === 'AWAY') return 'Away Win'
      if (marketSubtype === 'DRAW') return 'Draw'
      return '1X2'
    case 'DNB':
      if (marketSubtype === 'HOME') return 'Home Win (DNB)'
      if (marketSubtype === 'AWAY') return 'Away Win (DNB)'
      return 'Draw No Bet'
    case 'BTTS':
      if (marketSubtype === 'YES') return 'Both Teams to Score'
      if (marketSubtype === 'NO') return 'Both Teams Not to Score'
      return 'BTTS'
    case 'TOTALS':
      const lineValue = line ? Number(line) : null
      if (marketSubtype === 'OVER') return `Over ${lineValue} Goals`
      if (marketSubtype === 'UNDER') return `Under ${lineValue} Goals`
      return `Totals ${lineValue}`
    case 'DOUBLE_CHANCE':
      if (marketSubtype === '1X') return 'Home Win or Draw'
      if (marketSubtype === 'X2') return 'Draw or Away Win'
      if (marketSubtype === '12') return 'Home Win or Away Win'
      return 'Double Chance'
    default:
      return `${marketType} ${marketSubtype || ''}`.trim()
  }
}

