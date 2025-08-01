import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Get query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const league = searchParams.get('league') || ''
    const status = searchParams.get('status') || ''
    const result = searchParams.get('result') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    // Calculate offset
    const offset = (page - 1) * limit

    // Build where clause
    const where: any = {
      // Only show predictions for completed matches (past matches)
      match: {
        matchDate: {
          lt: new Date() // Only matches that have already happened
        }
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        {
          match: {
            homeTeam: {
              name: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          match: {
            awayTeam: {
              name: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          match: {
            league: {
              name: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        }
      ]
    }

    // League filter
    if (league) {
      where.match = {
        ...where.match,
        league: {
          name: league
        }
      }
    }

    // Status filter
    if (status) {
      where.status = status
    }

    // Result filter - this will be handled in the calculation, not in the where clause
    // since result is calculated from match scores and prediction type

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    // Get predictions with match data
    const predictions = await prisma.prediction.findMany({
      where,
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder as 'asc' | 'desc'
      },
      skip: offset,
      take: limit,
    })

    // Get total count for pagination
    const totalCount = await prisma.prediction.count({ where })

    // Transform data for frontend
    const transformedPredictions = predictions.map(prediction => ({
      id: prediction.id,
      match: {
        id: prediction.match.id,
        homeTeam: {
          id: prediction.match.homeTeam.id,
          name: prediction.match.homeTeam.name
        },
        awayTeam: {
          id: prediction.match.awayTeam.id,
          name: prediction.match.awayTeam.name
        },
        league: {
          id: prediction.match.league.id,
          name: prediction.match.league.name
        },
        matchDate: prediction.match.matchDate.toISOString(),
        status: prediction.match.status,
        homeScore: prediction.match.homeScore,
        awayScore: prediction.match.awayScore
      },
      predictionType: prediction.predictionType,
      confidenceScore: prediction.confidenceScore,
      odds: prediction.odds,
      valueRating: prediction.valueRating,
      explanation: prediction.explanation,
      status: prediction.status,
      isFree: prediction.isFree,
      isFeatured: prediction.isFeatured,
      showInDailyTips: prediction.showInDailyTips,
      showInWeeklySpecials: prediction.showInWeeklySpecials,
      type: prediction.type,
      matchesInAccumulator: prediction.matchesInAccumulator,
      totalOdds: prediction.totalOdds,
      stake: prediction.stake,
      potentialReturn: prediction.potentialReturn,
      createdAt: prediction.createdAt.toISOString(),
      resultUpdatedAt: prediction.resultUpdatedAt?.toISOString()
    }))

    // Calculate result for each prediction
    const predictionsWithResults = transformedPredictions.map(prediction => {
      let result = 'pending'
      
      if (prediction.match.status === 'finished' && prediction.match.homeScore !== null && prediction.match.awayScore !== null) {
        const homeScore = prediction.match.homeScore
        const awayScore = prediction.match.awayScore
        
        if (prediction.predictionType === 'home_win' && homeScore > awayScore) {
          result = 'won'
        } else if (prediction.predictionType === 'away_win' && awayScore > homeScore) {
          result = 'won'
        } else if (prediction.predictionType === 'draw' && homeScore === awayScore) {
          result = 'won'
        } else {
          result = 'lost'
        }
      } else if (prediction.match.status === 'cancelled' || prediction.match.status === 'postponed') {
        result = 'void'
      }
      
      return {
        ...prediction,
        result
      }
    })

    // Filter by result if specified
    const filteredPredictions = result 
      ? predictionsWithResults.filter(prediction => prediction.result === result)
      : predictionsWithResults

    // Apply pagination to filtered results
    const paginatedPredictions = filteredPredictions.slice(offset, offset + limit)

    return NextResponse.json({
      predictions: paginatedPredictions,
      pagination: {
        page,
        limit,
        totalCount: filteredPredictions.length,
        totalPages: Math.ceil(filteredPredictions.length / limit),
        hasNextPage: page < Math.ceil(filteredPredictions.length / limit),
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('Error fetching predictions history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch predictions history' },
      { status: 500 }
    )
  }
} 