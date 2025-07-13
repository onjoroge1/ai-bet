import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { cacheManager } from "@/lib/cache-manager"

// Cache configuration for predictions timeline
const CACHE_CONFIG = {
  ttl: 300, // 5 minutes - short TTL for fresh predictions
  prefix: 'predictions-timeline'
}

// GET /api/predictions/timeline
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // won, lost, pending, upcoming
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Create cache key based on user and filters
    const cacheKey = `timeline:${session.user.id}:${limit}:${status || 'all'}:${dateFrom || 'all'}:${dateTo || 'all'}`

    // Check cache first
    const cachedData = await cacheManager.get(cacheKey, CACHE_CONFIG)
    if (cachedData) {
      logger.info('GET /api/predictions/timeline - Cache hit', {
        tags: ['api', 'predictions', 'timeline', 'cache'],
        data: {
          userId: session.user.id,
          source: 'cache'
        }
      })
      
      return NextResponse.json({
        ...cachedData,
        source: 'cache'
      })
    }

    // Build where clause for predictions
    const predictionWhere: any = {}
    if (status) {
      predictionWhere.status = status
    }

    // Build where clause for matches
    const matchWhere: any = {}
    if (dateFrom || dateTo) {
      matchWhere.matchDate = {}
      if (dateFrom) matchWhere.matchDate.gte = new Date(dateFrom)
      if (dateTo) matchWhere.matchDate.lte = new Date(dateTo)
    }

    // Get predictions with match data and user predictions
    const predictions = await prisma.prediction.findMany({
      where: predictionWhere,
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        },
        userPredictions: {
          where: {
            userId: session.user.id
          },
          select: {
            id: true,
            status: true,
            stakeAmount: true,
            potentialReturn: true,
            actualReturn: true,
            placedAt: true
          }
        }
      },
      orderBy: {
        match: {
          matchDate: 'desc'
        }
      },
      take: limit
    })

    // Transform data for timeline
    const timelineData = predictions.map(prediction => {
      const userPrediction = prediction.userPredictions[0] || null
      
      // Determine timeline status
      let timelineStatus = 'upcoming'
      if (prediction.status === 'won' || prediction.status === 'lost') {
        timelineStatus = prediction.status
      } else if (prediction.match.matchDate < new Date()) {
        timelineStatus = 'pending'
      }

      // Calculate user profit/loss
      let userProfit = null
      if (userPrediction) {
        if (userPrediction.status === 'won') {
          userProfit = Number(userPrediction.actualReturn || userPrediction.potentialReturn) - Number(userPrediction.stakeAmount)
        } else if (userPrediction.status === 'lost') {
          userProfit = -Number(userPrediction.stakeAmount)
        }
      }

      return {
        id: prediction.id,
        match: {
          id: prediction.match.id,
          homeTeam: prediction.match.homeTeam,
          awayTeam: prediction.match.awayTeam,
          league: prediction.match.league,
          matchDate: prediction.match.matchDate,
          status: prediction.match.status,
          homeScore: prediction.match.homeScore,
          awayScore: prediction.match.awayScore
        },
        prediction: {
          type: prediction.predictionType,
          odds: prediction.odds,
          confidence: prediction.confidenceScore,
          valueRating: prediction.valueRating,
          explanation: prediction.explanation,
          isFree: prediction.isFree,
          status: prediction.status,
          resultUpdatedAt: prediction.resultUpdatedAt
        },
        userPrediction: userPrediction ? {
          id: userPrediction.id,
          status: userPrediction.status,
          amount: Number(userPrediction.stakeAmount),
          potentialReturn: Number(userPrediction.potentialReturn),
          profit: userProfit,
          placedAt: userPrediction.placedAt
        } : null,
        timelineStatus,
        createdAt: prediction.createdAt
      }
    })

    const responseData = {
      predictions: timelineData,
      count: timelineData.length,
      userId: session.user.id,
      filters: { status, dateFrom, dateTo, limit }
    }

    // Cache the response
    await cacheManager.set(cacheKey, responseData, CACHE_CONFIG)

    logger.info('GET /api/predictions/timeline - Success (Database)', {
      tags: ['api', 'predictions', 'timeline'],
      data: { 
        count: timelineData.length,
        userId: session.user.id,
        filters: { status, dateFrom, dateTo, limit },
        source: 'database'
      }
    })

    return NextResponse.json({
      ...responseData,
      source: 'database'
    })
  } catch (error) {
    logger.error('GET /api/predictions/timeline - Error', {
      tags: ['api', 'predictions', 'timeline'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 