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

    // Create cache key based on filters only (no user-specific caching for global predictions)
    const cacheKey = `timeline:${limit}:${status || 'all'}:${dateFrom || 'all'}:${dateTo || 'all'}`

    // Check cache first
    const cachedData = await cacheManager.get(cacheKey, CACHE_CONFIG)
    if (cachedData) {
      logger.info('GET /api/predictions/timeline - Cache hit', {
        tags: ['api', 'predictions', 'timeline', 'cache'],
        data: {
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

    // Get upcoming predictions using raw SQL with proper JSON date filtering
    const predictions = await prisma.$queryRaw`
      SELECT 
          qp.id,
          qp.name,
          qp.description,
          qp.features,
          qp.type,
          qp.odds,
          qp."valueRating",
          qp."analysisSummary",
          qp."isPredictionActive",
          qp."matchId",
          qp."matchData",
          qp."predictionData",
          qp."predictionType",
          qp."confidenceScore",
          qp."createdAt",
          c."currencyCode",
          c."currencySymbol"
      FROM "QuickPurchase" qp
      INNER JOIN "Country" c ON qp."countryId" = c.id
      WHERE qp."isActive" = true
      AND qp."matchId" IS NOT NULL
      AND qp."matchData" IS NOT NULL
      AND qp."predictionData" IS NOT NULL
      AND qp."confidenceScore" > 0
      AND (qp."matchData"->>'date')::timestamp >= NOW()
      ORDER BY qp."displayOrder" ASC
      LIMIT ${limit}
    `

    // Transform data for timeline
    const timelineData = (predictions as any[]).map(prediction => {
      // Extract match data from JSON
      const matchData = prediction.matchData as any
      const predictionData = prediction.predictionData as any
      
      // Determine timeline status
      let timelineStatus = 'upcoming'
      const matchDate = new Date(matchData.date)
      if (matchDate < new Date()) {
        timelineStatus = 'pending'
      }

      return {
        id: prediction.id,
        match: {
          id: prediction.matchId,
          homeTeam: { name: matchData.home_team || matchData.homeTeam },
          awayTeam: { name: matchData.away_team || matchData.awayTeam },
          league: { name: matchData.league },
          matchDate: matchDate,
          status: matchData.status || 'scheduled',
          homeScore: matchData.home_score || null,
          awayScore: matchData.away_score || null
        },
        prediction: {
          type: prediction.predictionType,
          odds: prediction.odds,
          confidence: prediction.confidenceScore,
          valueRating: prediction.valueRating,
          explanation: predictionData?.explanation || prediction.analysisSummary,
          isFree: predictionData?.isFree || false,
          status: predictionData?.status || 'pending',
          resultUpdatedAt: predictionData?.resultUpdatedAt || null
        },
        timelineStatus,
        createdAt: prediction.createdAt
      }
    })

    const responseData = {
      predictions: timelineData,
      count: timelineData.length,
      filters: { status, dateFrom, dateTo, limit }
    }

    // Cache the response
    await cacheManager.set(cacheKey, responseData, CACHE_CONFIG)

    logger.info('GET /api/predictions/timeline - Success (Database)', {
      tags: ['api', 'predictions', 'timeline'],
      data: { 
        count: timelineData.length,
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