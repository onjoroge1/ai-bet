/**
 * GET /api/parlays/builder/matches
 * 
 * Fetch matches with available markets for parlay builder
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams
    const league = searchParams.get('league')
    const dateRange = searchParams.get('dateRange') || 'today' // today, tomorrow, this_week
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build date filter
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    let dateFilter: { gte: Date } = { gte: today }
    if (dateRange === 'tomorrow') {
      dateFilter = { gte: tomorrow }
    } else if (dateRange === 'this_week') {
      dateFilter = { gte: today }
    }

    // Build where clause
    const whereClause: any = {
      status: 'UPCOMING',
      kickoffDate: dateFilter,
      isActive: true
    }

    if (league && league !== 'all') {
      whereClause.league = league
    }

    // Fetch matches with market counts
    const matches = await prisma.marketMatch.findMany({
      where: whereClause,
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        homeTeamLogo: true,
        awayTeamLogo: true,
        league: true,
        leagueCountry: true,
        leagueFlagEmoji: true,
        kickoffDate: true,
        _count: {
          select: {
            additionalMarketData: {
              where: {
                consensusProb: { gte: 0.50 },
                modelAgreement: { gte: 0.60 }
              }
            }
          }
        }
      },
      orderBy: {
        kickoffDate: 'asc'
      },
      take: limit
    })

    // Get unique leagues for filter
    const leagues = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: dateFilter,
        isActive: true
      },
      select: {
        league: true
      },
      distinct: ['league'],
      orderBy: {
        league: 'asc'
      }
    })

    // Enrich matches with best edge info
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        // Get best edge market for this match
        const bestMarket = await prisma.additionalMarketData.findFirst({
          where: {
            matchId: match.matchId,
            consensusProb: { gte: 0.50 },
            modelAgreement: { gte: 0.60 }
          },
          orderBy: [
            { consensusProb: 'desc' },
            { modelAgreement: 'desc' }
          ],
          select: {
            marketType: true,
            marketSubtype: true,
            consensusProb: true,
            edgeConsensus: true
          }
        })

        return {
          matchId: match.matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeTeamLogo: match.homeTeamLogo,
          awayTeamLogo: match.awayTeamLogo,
          league: match.league,
          leagueCountry: match.leagueCountry,
          leagueFlagEmoji: match.leagueFlagEmoji,
          kickoffDate: match.kickoffDate.toISOString(),
          marketCount: match._count.additionalMarketData,
          bestMarket: bestMarket ? {
            marketType: bestMarket.marketType,
            marketSubtype: bestMarket.marketSubtype,
            consensusProb: Number(bestMarket.consensusProb),
            edgeConsensus: Number(bestMarket.edgeConsensus) * 100
          } : null
        }
      })
    )

    return NextResponse.json({
      success: true,
      matches: enrichedMatches,
      leagues: leagues.map(l => l.league).filter(Boolean),
      filters: {
        league,
        dateRange,
        limit
      }
    })
  } catch (error) {
    logger.error('Error fetching matches for builder', {
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

