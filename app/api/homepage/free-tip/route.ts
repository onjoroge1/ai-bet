import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { cacheManager } from '@/lib/cache-manager'

// Cache configuration for homepage free tip
const CACHE_CONFIG = {
  ttl: 300, // 5 minutes - short TTL for fresh predictions
  prefix: 'homepage-free-tip'
}

// GET /api/homepage/free-tip
export async function GET() {
  try {
    // Check cache first
    const cacheKey = 'current-free-tip'
    const cachedTip = await cacheManager.get(cacheKey, CACHE_CONFIG)
    
    if (cachedTip) {
      logger.info('GET /api/homepage/free-tip - Cache hit', {
        tags: ['api', 'homepage', 'free-tip', 'cache'],
        data: { source: 'cache' }
      })
      
      return NextResponse.json({
        success: true,
        data: cachedTip,
        source: 'cache'
      })
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    // Get the best free tip for today
    let freeTip = await prisma.prediction.findFirst({
      where: {
        isFree: true,
        showInDailyTips: true,
        match: {
          matchDate: {
            gte: today,
            lte: tomorrow,
          },
          status: {
            in: ['upcoming', 'live']
          }
        },
        // Prioritize high confidence and high value
        OR: [
          { confidenceScore: { gte: 80 } },
          { valueRating: { in: ['High', 'Very High'] } }
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
      ]
    })

    // If no today/tomorrow free tip, get the best available free tip
    if (!freeTip) {
      freeTip = await prisma.prediction.findFirst({
        where: {
          isFree: true,
          showInDailyTips: true,
          match: {
            status: {
              in: ['upcoming', 'live']
            }
          }
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
        ]
      })
    }

    if (!freeTip) {
      logger.warn('GET /api/homepage/free-tip - No free tip available', {
        tags: ['api', 'homepage', 'free-tip']
      })
      
      return NextResponse.json({
        success: false,
        message: 'No free tip available today',
        data: null
      })
    }

    // Format the response
    const formattedTip = {
      id: freeTip.id,
      match: {
        homeTeam: freeTip.match.homeTeam.name,
        awayTeam: freeTip.match.awayTeam.name,
        league: freeTip.match.league.name,
        matchDate: freeTip.match.matchDate,
        status: freeTip.match.status,
        time: new Date(freeTip.match.matchDate).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      },
      prediction: freeTip.predictionType,
      confidence: freeTip.confidenceScore,
      odds: freeTip.odds.toString(),
      valueRating: freeTip.valueRating,
      analysis: freeTip.explanation || 'AI-powered prediction based on comprehensive analysis',
      isLive: freeTip.match.status === 'live',
      updatedAt: freeTip.createdAt
    }

    // Cache the formatted tip
    await cacheManager.set(cacheKey, formattedTip, CACHE_CONFIG)

    logger.info('GET /api/homepage/free-tip - Success (Database)', {
      tags: ['api', 'homepage', 'free-tip'],
      data: {
        tipId: freeTip.id,
        match: `${formattedTip.match.homeTeam} vs ${formattedTip.match.awayTeam}`,
        confidence: freeTip.confidenceScore,
        isLive: formattedTip.isLive,
        source: 'database'
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedTip,
      source: 'database'
    })
  } catch (error) {
    logger.error('GET /api/homepage/free-tip - Error', {
      tags: ['api', 'homepage', 'free-tip'],
      error: error instanceof Error ? error : undefined
    })
    
    return new NextResponse(
      JSON.stringify({ 
        success: false,
        error: 'Failed to fetch free tip',
        data: null
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
} 