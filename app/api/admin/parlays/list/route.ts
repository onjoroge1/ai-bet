import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/parlays/list - Get all parlays with filters
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'active'
    const parlayType = searchParams.get('type')
    const confidenceTier = searchParams.get('confidence')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { status }

    if (parlayType) {
      where.parlayType = parlayType
    }

    if (confidenceTier) {
      where.confidenceTier = confidenceTier
    }

    const [parlays, total, stats] = await Promise.all([
      prisma.parlayConsensus.findMany({
        where,
        include: {
          legs: {
            orderBy: { legOrder: 'asc' }
          },
          purchases: {
            select: {
              id: true,
              userId: true,
              status: true,
              amount: true,
              purchasedAt: true
            }
          },
          performance: true
        },
        orderBy: [
          { edgePct: 'desc' },
          { earliestKickoff: 'asc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.parlayConsensus.count({ where }),
      prisma.parlayConsensus.groupBy({
        by: ['status', 'parlayType', 'confidenceTier'],
        _count: true
      })
    ])

    // Enrich legs with MarketMatch data if team names are missing
    const matchIds = new Set<string>()
    parlays.forEach(parlay => {
      parlay.legs.forEach(leg => {
        if (leg.homeTeam === 'TBD' || leg.awayTeam === 'TBD' || !leg.homeTeam || !leg.awayTeam) {
          matchIds.add(leg.matchId)
        }
      })
    })

    const marketMatches = matchIds.size > 0 ? await prisma.marketMatch.findMany({
      where: {
        matchId: { in: Array.from(matchIds) }
      },
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true
      }
    }) : []

    const matchMap = new Map(marketMatches.map(m => [m.matchId, m]))

    // Helper function to format outcome
    const formatOutcome = (outcome: string, homeTeam: string, awayTeam: string): string => {
      if (outcome === 'H') return `${homeTeam} to Win`
      if (outcome === 'A') return `${awayTeam} to Win`
      if (outcome === 'D') return 'Draw'
      // Handle other outcomes (BTTS, Totals, etc.)
      if (outcome.startsWith('BTTS_')) {
        return outcome === 'BTTS_YES' ? 'Both Teams to Score' : 'Both Teams NOT to Score'
      }
      if (outcome.startsWith('OVER_') || outcome.startsWith('UNDER_')) {
        const num = outcome.split('_')[1]?.replace('_', '.') || ''
        return outcome.startsWith('OVER_') ? `Over ${num} Goals` : `Under ${num} Goals`
      }
      if (outcome === '1X' || outcome === 'X2' || outcome === '12') {
        return `Double Chance ${outcome}`
      }
      return outcome
    }

    // Filter out parlays with TBD team names
    const validParlays = parlays.filter(parlay => {
      return parlay.legs.every(leg => {
        const matchData = matchMap.get(leg.matchId)
        const homeTeam = (leg.homeTeam && leg.homeTeam !== 'TBD') ? leg.homeTeam : (matchData?.homeTeam || '')
        const awayTeam = (leg.awayTeam && leg.awayTeam !== 'TBD') ? leg.awayTeam : (matchData?.awayTeam || '')
        return homeTeam && homeTeam !== 'TBD' && awayTeam && awayTeam !== 'TBD'
      })
    })

    return NextResponse.json({
      success: true,
      count: validParlays.length,
      totalBeforeFilter: total,
      filteredOut: total - validParlays.length,
      parlays: validParlays.map(parlay => ({
        id: parlay.id,
        parlayId: parlay.parlayId,
        apiVersion: parlay.apiVersion,
        legCount: parlay.legCount,
        legs: parlay.legs.map(leg => {
          // Enrich with MarketMatch data if team names are missing
          const matchData = matchMap.get(leg.matchId)
          const homeTeam = (leg.homeTeam && leg.homeTeam !== 'TBD') ? leg.homeTeam : (matchData?.homeTeam || 'Unknown')
          const awayTeam = (leg.awayTeam && leg.awayTeam !== 'TBD') ? leg.awayTeam : (matchData?.awayTeam || 'Unknown')
          
          return {
            id: leg.id,
            matchId: leg.matchId,
            outcome: leg.outcome,
            outcomeLabel: formatOutcome(leg.outcome, homeTeam, awayTeam),
            homeTeam,
            awayTeam,
            modelProb: Number(leg.modelProb),
            decimalOdds: Number(leg.decimalOdds),
            edge: Number(leg.edge),
            legOrder: leg.legOrder,
            hasTeamNames: !!(matchData || (leg.homeTeam && leg.homeTeam !== 'TBD'))
          }
        }),
        // Quality indicators
        quality: {
          isTradable: Number(parlay.edgePct) >= 5 && Number(parlay.combinedProb) >= 0.05, // At least 5% edge and 5% probability
          hasLowEdge: Number(parlay.edgePct) < 5,
          hasLowProbability: Number(parlay.combinedProb) < 0.05,
          riskLevel: Number(parlay.combinedProb) >= 0.20 ? 'low' : 
                     Number(parlay.combinedProb) >= 0.10 ? 'medium' : 
                     Number(parlay.combinedProb) >= 0.05 ? 'high' : 'very_high'
        },
        combinedProb: Number(parlay.combinedProb),
        correlationPenalty: Number(parlay.correlationPenalty),
        adjustedProb: Number(parlay.adjustedProb),
        impliedOdds: Number(parlay.impliedOdds),
        edgePct: Number(parlay.edgePct),
        confidenceTier: parlay.confidenceTier,
        parlayType: parlay.parlayType,
        leagueGroup: parlay.leagueGroup,
        earliestKickoff: parlay.earliestKickoff.toISOString(),
        latestKickoff: parlay.latestKickoff.toISOString(),
        kickoffWindow: parlay.kickoffWindow,
        status: parlay.status,
        createdAt: parlay.createdAt.toISOString(),
        syncedAt: parlay.syncedAt.toISOString(),
        purchaseCount: parlay.purchases.length,
        totalRevenue: parlay.purchases.reduce((sum, p) => sum + Number(p.amount), 0),
        performance: parlay.performance ? {
          totalPurchases: parlay.performance.totalPurchases,
          totalWins: parlay.performance.totalWins,
          totalLosses: parlay.performance.totalLosses,
          winRate: parlay.performance.winRate ? Number(parlay.performance.winRate) : null,
          roi: parlay.performance.roi ? Number(parlay.performance.roi) : null
        } : null
      })),
      stats: stats.reduce((acc, stat) => {
        const key = `${stat.status}_${stat.parlayType || 'unknown'}_${stat.confidenceTier || 'unknown'}`
        acc[key] = stat._count
        return acc
      }, {} as Record<string, number>)
    })
  } catch (error) {
    logger.error('Error fetching parlays', {
      tags: ['api', 'admin', 'parlays'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to fetch parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

