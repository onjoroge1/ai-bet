import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// Cache for 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
let cache: {
  data: any[]
  timestamp: number
} | null = null

export async function GET() {
  try {
    const now = Date.now()
    
    // Check if we have valid cached data
    if (cache && (now - cache.timestamp) < CACHE_DURATION) {
      logger.info('GET /api/predictions/live-ticker - Returning cached data', {
        tags: ['api', 'predictions', 'live-ticker', 'cache'],
        data: { 
          cacheAge: Math.round((now - cache.timestamp) / 1000 / 60), // minutes
          count: cache.data.length 
        }
      })
      
      return NextResponse.json({
        success: true,
        data: cache.data,
        cached: true,
        cacheAge: Math.round((now - cache.timestamp) / 1000 / 60)
      })
    }

    // Calculate 48-hour window
    const cutoffDate = new Date(now - (48 * 60 * 60 * 1000))
    
    logger.info('GET /api/predictions/live-ticker - Fetching fresh data', {
      tags: ['api', 'predictions', 'live-ticker'],
      data: { cutoffDate: cutoffDate.toISOString() }
    })

    // Query QuickPurchase table for active predictions within 48 hours
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        predictionData: {
          not: null
        },
        // Filter by match date within last 48 hours
        // We'll need to parse the JSON to filter by date
      },
      select: {
        id: true,
        predictionData: true,
        matchData: true,
        predictionType: true,
        confidenceScore: true,
        odds: true,
        valueRating: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Process and filter the data
    const livePredictions = quickPurchases
      .map(qp => {
        try {
          const predictionData = qp.predictionData as any
          const matchData = qp.matchData as any
          
          if (!predictionData?.prediction?.match_info?.date) {
            return null
          }

          const matchDate = new Date(predictionData.prediction.match_info.date)
          
          // Filter for matches within last 48 hours
          if (matchDate < cutoffDate) {
            return null
          }

          const now = new Date()
          const timeDiff = matchDate.getTime() - now.getTime()
          
          // Determine status based on time
          let status: 'upcoming' | 'live' | 'completed' = 'upcoming'
          
          if (timeDiff < 0 && Math.abs(timeDiff) < 7200000) { // Within 2 hours of start
            status = 'live'
          } else if (timeDiff < 0) {
            status = 'completed'
          }

          // Only return upcoming and live matches
          if (status === 'completed') {
            return null
          }

          return {
            id: qp.id,
            homeTeam: matchData?.home_team?.name || predictionData?.prediction?.match_info?.home_team || 'TBD',
            awayTeam: matchData?.away_team?.name || predictionData?.prediction?.match_info?.away_team || 'TBD',
            league: matchData?.league?.name || predictionData?.prediction?.match_info?.league || 'Unknown League',
            prediction: qp.predictionType || predictionData?.prediction?.type || 'Match Prediction',
            confidence: qp.confidenceScore || predictionData?.prediction?.confidence || 75,
            odds: parseFloat((qp.odds || predictionData?.prediction?.odds || 2.0).toString()),
            matchTime: predictionData.prediction.match_info.date,
            status,
            valueRating: qp.valueRating || predictionData?.prediction?.value_rating || 'Medium'
          }
        } catch (error) {
          logger.warn('Error processing QuickPurchase prediction data', {
            tags: ['api', 'predictions', 'live-ticker'],
            data: { quickPurchaseId: qp.id, error: error instanceof Error ? error.message : 'Unknown error' }
          })
          return null
        }
      })
      .filter(Boolean) // Remove null entries
      .sort((a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime()) // Sort by match time
      .slice(0, 8) // Limit to 8 predictions

    // Update cache
    cache = {
      data: livePredictions,
      timestamp: now
    }

    logger.info('GET /api/predictions/live-ticker - Success', {
      tags: ['api', 'predictions', 'live-ticker'],
      data: { 
        count: livePredictions.length,
        cacheUpdated: true
      }
    })

    return NextResponse.json({
      success: true,
      data: livePredictions,
      cached: false,
      cacheAge: 0
    })

  } catch (error) {
    logger.error('GET /api/predictions/live-ticker - Error', {
      tags: ['api', 'predictions', 'live-ticker'],
      error: error instanceof Error ? error : undefined
    })

    // If there's an error but we have cached data, return it
    if (cache && cache.data.length > 0) {
      logger.warn('GET /api/predictions/live-ticker - Returning stale cache due to error', {
        tags: ['api', 'predictions', 'live-ticker', 'cache'],
        data: { 
          cacheAge: Math.round((Date.now() - cache.timestamp) / 1000 / 60), // minutes
          count: cache.data.length 
        }
      })
      
      return NextResponse.json({
        success: true,
        data: cache.data,
        cached: true,
        cacheAge: Math.round((Date.now() - cache.timestamp) / 1000 / 60),
        error: 'Using cached data due to database error'
      })
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch live predictions',
        data: []
      },
      { status: 500 }
    )
  }
}
