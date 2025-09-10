import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { cacheManager } from '@/lib/cache-manager'

// Cache configuration for homepage predictions
const CACHE_CONFIG = {
  ttl: 300, // 5 minutes - short TTL for fresh predictions
  prefix: 'homepage-predictions'
}

// GET /api/homepage/predictions
export async function GET() {
  try {
    // Check cache first
    const cacheKey = 'current-predictions'
    const cachedPredictions = await cacheManager.get(cacheKey, CACHE_CONFIG)
    
    if (cachedPredictions) {
      logger.info('GET /api/homepage/predictions - Cache hit', {
        tags: ['api', 'homepage', 'predictions', 'cache'],
        data: { source: 'cache', count: cachedPredictions.length }
      })
      
      return NextResponse.json(cachedPredictions)
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    // OPTIMIZED: Single query with broader date range and better filtering
    const predictions = await prisma.prediction.findMany({
      where: {
        // Upcoming matches (today to next week)
        match: {
          matchDate: {
            gte: today,
            lte: nextWeek,
          },
          status: {
            in: ['upcoming', 'live']
          }
        },
        // High confidence or high value rating
        OR: [
          { confidenceScore: { gte: 70 } },
          { valueRating: { in: ['High', 'Very High'] } },
          { showInDailyTips: true },
          { isFeatured: true }
        ]
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        }
      },
      orderBy: [
        { confidenceScore: 'desc' },
        { valueRating: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 3
    })

    // Cache the results
    await cacheManager.set(cacheKey, predictions, CACHE_CONFIG)

    logger.info('GET /api/homepage/predictions - Success (Database)', {
      tags: ['api', 'homepage', 'predictions'],
      data: { 
        predictionsCount: predictions.length,
        dateRange: { from: today.toISOString(), to: nextWeek.toISOString() },
        source: 'database'
      }
    })

    return NextResponse.json(predictions)
  } catch (error) {
    logger.error('GET /api/homepage/predictions - Error', {
      tags: ['api', 'homepage', 'predictions'],
      error: error instanceof Error ? error : undefined
    })
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
} 