import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { Redis } from '@upstash/redis'

// Initialize Redis client
const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
})

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600

// Define the prediction response type
interface PredictionResponse {
  match_info: {
    match_id: number
    home_team: string
    away_team: string
    venue: string
    date: string
    league: string
    match_importance: string
  }
  comprehensive_analysis: {
    ml_prediction: {
      home_win: number
      draw: number
      away_win: number
      confidence: number
      model_type: string
    }
    ai_verdict: {
      recommended_outcome: string
      confidence_level: string
      probability_assessment: {
        home: number
        draw: number
        away: number
      }
    }
    detailed_reasoning: {
      ml_model_weight: string
      injury_impact: string
      form_analysis: string
      tactical_factors: string
      historical_context: string
    }
    betting_intelligence: {
      primary_bet: string
      value_bets: string[]
      avoid_bets: string[]
    }
    risk_analysis: {
      overall_risk: string
      key_risks: string[]
      upset_potential: string
    }
    confidence_breakdown: string
  }
  additional_markets: {
    total_goals: {
      over_2_5: number
      under_2_5: number
    }
    both_teams_score: {
      yes: number
      no: number
    }
    asian_handicap: {
      home_handicap: number
      away_handicap: number
    }
  }
  analysis_metadata: {
    analysis_type: string
    data_sources: string[]
    analysis_timestamp: string
    ml_model_accuracy: string
    ai_model: string
    processing_time: number
  }
  processing_time: number
  timestamp: string
}

// Function to fetch prediction data directly (avoiding HTTP middleware)
async function fetchPredictionData(matchId: string, includeAnalysis: boolean = true): Promise<any> {
  try {
    // Check cache first
    const cacheKey = `prediction:${matchId}:${includeAnalysis}`
    const cachedPrediction = await redis.get<PredictionResponse>(cacheKey)
    
    if (cachedPrediction) {
      logger.debug('Using cached prediction data', {
        tags: ['api', 'admin', 'predictions', 'smart-refetch'],
        data: { matchId, source: 'cache' }
      })
      return {
        match_id: matchId,
        prediction: cachedPrediction,
        source: 'cache'
      }
    }

    logger.debug('Fetching prediction from backend', {
      tags: ['api', 'admin', 'predictions', 'smart-refetch'],
      data: { matchId, backendUrl: `${process.env.BACKEND_URL}/predict` }
    })

    // If not in cache, fetch from backend with timeout
    const backendUrl = `${process.env.BACKEND_URL}/predict`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
        },
        body: JSON.stringify({
          match_id: Number(matchId),
          include_analysis: includeAnalysis
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Backend responded with status ${response.status}: ${errorText}`)
      }

      const prediction = await response.json() as PredictionResponse

      // Cache the prediction
      await redis.set(cacheKey, prediction, { ex: CACHE_TTL })

      logger.debug('Successfully fetched and cached prediction', {
        tags: ['api', 'admin', 'predictions', 'smart-refetch'],
        data: { matchId, source: 'backend', processingTime: prediction.processing_time }
      })

      return {
        match_id: matchId,
        prediction,
        source: 'backend'
      }

    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error(`Backend API timeout after 30 seconds for match ${matchId}`)
      }
      throw fetchError
    }

  } catch (error) {
    logger.error('Failed to fetch prediction data', {
      tags: ['api', 'admin', 'predictions', 'smart-refetch'],
      data: { 
        matchId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    })
    throw new Error(`Failed to fetch prediction: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Function to determine if a prediction needs refetching
function shouldRefetchPrediction(matchDate: Date, lastEnrichment: Date | null): {
  shouldRefetch: boolean
  priority: string | null
  nextRefetchAt: Date | null
} {
  const now = new Date()
  const timeUntilMatch = matchDate.getTime() - now.getTime()
  const hoursUntilMatch = timeUntilMatch / (1000 * 60 * 60)
  
  // If match is in the past, no need to refetch
  if (hoursUntilMatch <= 0) {
    return { shouldRefetch: false, priority: null, nextRefetchAt: null }
  }
  
  // If never enriched, needs enrichment
  if (!lastEnrichment) {
    return { shouldRefetch: true, priority: 'urgent', nextRefetchAt: null }
  }
  
  const hoursSinceEnrichment = (now.getTime() - lastEnrichment.getTime()) / (1000 * 60 * 60)
  
  // Refetch at 48h if last enrichment was more than 12 hours ago
  if (hoursUntilMatch <= 48 && hoursUntilMatch > 24) {
    if (hoursSinceEnrichment >= 12) {
      return { 
        shouldRefetch: true, 
        priority: '48h', 
        nextRefetchAt: new Date(now.getTime() + 12 * 60 * 60 * 1000) 
      }
    }
  }
  
  // Refetch at 24h if last enrichment was more than 6 hours ago
  if (hoursUntilMatch <= 24) {
    if (hoursSinceEnrichment >= 6) {
      return { 
        shouldRefetch: true, 
        priority: '24h', 
        nextRefetchAt: new Date(now.getTime() + 6 * 60 * 60 * 1000) 
      }
    }
  }
  
  return { shouldRefetch: false, priority: null, nextRefetchAt: null }
}

// POST /api/admin/predictions/smart-refetch - Smart refetch based on timing
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { limit = 10, leagueId, forceRefetch = false } = await req.json()

    logger.info('Starting smart prediction refetch', {
      tags: ['api', 'admin', 'predictions', 'smart-refetch'],
      data: { limit, leagueId, forceRefetch, startTime: new Date(startTime).toISOString() }
    })

    // Calculate 72-hour cutoff (matches that will be played within next 72 hours)
    const now = new Date()
    const cutoffDate = new Date(now.getTime() + 72 * 60 * 60 * 1000) // 72 hours from now

    // Find QuickPurchase records that need refetching
    // First, get all QuickPurchase records with prediction data
    const whereClause: Prisma.QuickPurchaseWhereInput = {
      matchId: { not: null },
      isPredictionActive: true,
      predictionData: { not: Prisma.JsonNull } // Must have existing prediction data
    }

    let quickPurchases: any[] = []

    if (leagueId) {
      // If leagueId is provided, we need to filter by league
      // Get QuickPurchase records first, then filter by match data
      const allQuickPurchases = await prisma.quickPurchase.findMany({
        where: whereClause,
        take: limit * 2, // Get more to account for filtering
        orderBy: {
          createdAt: 'asc'
        }
      })

      // Filter by match date and league in a second step
      const matchIds = allQuickPurchases.map(qp => qp.matchId).filter(Boolean)
      if (matchIds.length > 0) {
        const matches = await prisma.match.findMany({
          where: {
            id: { in: matchIds },
            matchDate: {
              gte: now,
              lte: cutoffDate
            },
            leagueId: leagueId
          },
          select: {
            id: true,
            matchDate: true,
            status: true,
            league: {
              select: {
                name: true
              }
            }
          }
        })

        // Filter QuickPurchase records to only include those with valid matches
        const validMatchIds = new Set(matches.map(m => m.id))
        quickPurchases = allQuickPurchases
          .filter(qp => qp.matchId && validMatchIds.has(qp.matchId))
          .slice(0, limit)
          .map(qp => ({
            ...qp,
            match: matches.find(m => m.id === qp.matchId)
          }))
      }
    } else {
      // Get all QuickPurchase records with prediction data
      const allQuickPurchases = await prisma.quickPurchase.findMany({
        where: whereClause,
        take: limit * 2, // Get more to account for filtering
        orderBy: {
          createdAt: 'asc'
        }
      })

      // Filter by match date in a second step
      const matchIds = allQuickPurchases.map(qp => qp.matchId).filter(Boolean)
      if (matchIds.length > 0) {
        const matches = await prisma.match.findMany({
          where: {
            id: { in: matchIds },
            matchDate: {
              gte: now,
              lte: cutoffDate
            }
          },
          select: {
            id: true,
            matchDate: true,
            status: true,
            league: {
              select: {
                name: true
              }
            }
          }
        })

        // Filter QuickPurchase records to only include those with valid matches
        const validMatchIds = new Set(matches.map(m => m.id))
        quickPurchases = allQuickPurchases
          .filter(qp => qp.matchId && validMatchIds.has(qp.matchId))
          .slice(0, limit)
          .map(qp => ({
            ...qp,
            match: matches.find(m => m.id === qp.matchId)
          }))
      }
    }

    // Filter records that actually need refetching
    const recordsToRefetch = quickPurchases.filter(qp => {
      if (forceRefetch) return true
      
      const refetchInfo = shouldRefetchPrediction(
        qp.match.matchDate, 
        qp.lastEnrichmentAt
      )
      
      return refetchInfo.shouldRefetch
    })

    logger.info('Smart refetch analysis completed', {
      tags: ['api', 'admin', 'predictions', 'smart-refetch'],
      data: { 
        totalRecords: quickPurchases.length,
        recordsToRefetch: recordsToRefetch.length,
        timeWindow: '72 hours',
        forceRefetch
      }
    })

    if (recordsToRefetch.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No predictions need refetching at this time',
        data: {
          totalAnalyzed: quickPurchases.length,
          recordsToRefetch: 0,
          totalTime: `${Date.now() - startTime}ms`
        }
      })
    }

    let refetchedCount = 0
    let failedCount = 0
    const errors: string[] = []

    // Process each record that needs refetching
    for (const quickPurchase of recordsToRefetch) {
      const requestStartTime = Date.now()
      
      try {
        if (!quickPurchase.matchId) {
          logger.warn('QuickPurchase has no matchId', {
            tags: ['api', 'admin', 'predictions', 'smart-refetch'],
            data: { quickPurchaseId: quickPurchase.id }
          })
          continue
        }

        const refetchInfo = shouldRefetchPrediction(
          quickPurchase.match.matchDate, 
          quickPurchase.lastEnrichmentAt
        )

        logger.debug('Refetching prediction data for match', {
          tags: ['api', 'admin', 'predictions', 'smart-refetch'],
          data: { 
            quickPurchaseId: quickPurchase.id,
            matchId: quickPurchase.matchId,
            priority: refetchInfo.priority,
            hoursUntilMatch: (quickPurchase.match.matchDate.getTime() - now.getTime()) / (1000 * 60 * 60),
            requestStartTime: new Date(requestStartTime).toISOString()
          }
        })

        // Fetch fresh prediction data
        const predictionData = await fetchPredictionData(quickPurchase.matchId, true)

        const fetchTime = Date.now() - requestStartTime

        // Extract key prediction information
        const prediction = predictionData.prediction
        if (!prediction) {
          logger.warn('No prediction data in response', {
            tags: ['api', 'admin', 'predictions', 'smart-refetch'],
            data: { 
              quickPurchaseId: quickPurchase.id,
              matchId: quickPurchase.matchId,
              responseKeys: Object.keys(predictionData),
              fetchTime: `${fetchTime}ms`
            }
          })
          failedCount++
          errors.push(`Match ${quickPurchase.matchId}: No prediction data`)
          continue
        }

        // Extract prediction details
        const aiVerdict = prediction.comprehensive_analysis?.ai_verdict
        const mlPrediction = prediction.comprehensive_analysis?.ml_prediction

        // Determine prediction type and confidence
        let predictionType = 'unknown'
        let confidenceScore = 0
        let odds = null
        let valueRating = 'Low'

        if (aiVerdict) {
          predictionType = aiVerdict.recommended_outcome?.toLowerCase().replace(' ', '_') || 'unknown'
          confidenceScore = aiVerdict.confidence_level === 'High' ? 85 : 
                           aiVerdict.confidence_level === 'Medium' ? 65 : 45
        }

        if (mlPrediction) {
          // Use ML confidence if available
          confidenceScore = Math.round(mlPrediction.confidence * 100)
          
          // Calculate implied odds from ML probabilities
          const maxProb = Math.max(mlPrediction.home_win, mlPrediction.draw, mlPrediction.away_win)
          odds = maxProb > 0 ? (1 / maxProb).toFixed(2) : null
        }

        // Determine value rating based on confidence
        if (confidenceScore >= 80) valueRating = 'Very High'
        else if (confidenceScore >= 65) valueRating = 'High'
        else if (confidenceScore >= 50) valueRating = 'Medium'
        else valueRating = 'Low'

        // Create analysis summary
        const analysisSummary = aiVerdict?.confidence_level 
          ? `${aiVerdict.recommended_outcome} (${aiVerdict.confidence_level} confidence)`
          : 'AI prediction available'

        // Calculate next refetch time
        const matchDate = quickPurchase.match.matchDate
        const hoursUntilMatch = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        let nextRefetchAt: Date | null = null
        let refetchPriority: string | null = null

        if (hoursUntilMatch > 24) {
          // If more than 24h until match, next refetch at 48h
          nextRefetchAt = new Date(matchDate.getTime() - 48 * 60 * 60 * 1000)
          refetchPriority = '48h'
        } else if (hoursUntilMatch > 0) {
          // If less than 24h until match, next refetch at 24h
          nextRefetchAt = new Date(matchDate.getTime() - 24 * 60 * 60 * 1000)
          refetchPriority = '24h'
        }

        // Update the QuickPurchase record with fresh data and refetch tracking
        await prisma.quickPurchase.update({
          where: { id: quickPurchase.id },
          data: {
            predictionData: predictionData,
            predictionType: predictionType,
            confidenceScore: confidenceScore,
            odds: odds ? parseFloat(odds) : null,
            valueRating: valueRating,
            analysisSummary: analysisSummary,
            isPredictionActive: true,
            // NEW: Update refetch tracking
            lastEnrichmentAt: now,
            enrichmentCount: { increment: 1 },
            nextRefetchAt: nextRefetchAt,
            refetchPriority: refetchPriority
          }
        })

        const totalRequestTime = Date.now() - requestStartTime

        logger.debug('Successfully refetched QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'smart-refetch'],
          data: {
            quickPurchaseId: quickPurchase.id,
            matchId: quickPurchase.matchId,
            predictionType,
            confidenceScore,
            valueRating,
            fetchTime: `${fetchTime}ms`,
            totalRequestTime: `${totalRequestTime}ms`,
            source: predictionData.source,
            refetchPriority,
            nextRefetchAt: nextRefetchAt?.toISOString()
          }
        })

        refetchedCount++

        // Add delay between requests
        const delay = 2000 // 2 seconds delay between requests
        logger.debug(`Waiting ${delay}ms before next request`, {
          tags: ['api', 'admin', 'predictions', 'smart-refetch'],
          data: { 
            matchId: quickPurchase.matchId,
            delay,
            progress: `${refetchedCount + failedCount}/${recordsToRefetch.length}`,
            elapsedTime: `${Date.now() - startTime}ms`
          }
        })
        await new Promise(resolve => setTimeout(resolve, delay))

      } catch (error) {
        const errorTime = Date.now() - requestStartTime
        logger.error('Error refetching QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'smart-refetch'],
          data: {
            quickPurchaseId: quickPurchase.id,
            matchId: quickPurchase.matchId,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestTime: `${errorTime}ms`
          }
        })
        failedCount++
        errors.push(`Match ${quickPurchase.matchId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    const totalTime = Date.now() - startTime

    logger.info('Smart refetch completed', {
      tags: ['api', 'admin', 'predictions', 'smart-refetch'],
      data: {
        totalAnalyzed: quickPurchases.length,
        totalProcessed: recordsToRefetch.length,
        refetchedCount,
        failedCount,
        totalTime: `${totalTime}ms`,
        averageTimePerRequest: recordsToRefetch.length > 0 ? `${Math.round(totalTime / recordsToRefetch.length)}ms` : 'N/A',
        errors: errors.slice(0, 5) // Log first 5 errors
      }
    })

    return NextResponse.json({
      success: true,
      message: `Refetched ${refetchedCount} predictions using smart timing`,
      data: {
        totalAnalyzed: quickPurchases.length,
        totalProcessed: recordsToRefetch.length,
        refetchedCount,
        failedCount,
        totalTime: `${totalTime}ms`,
        averageTimePerRequest: recordsToRefetch.length > 0 ? `${Math.round(totalTime / recordsToRefetch.length)}ms` : 'N/A',
        errors: errors.slice(0, 10) // Return first 10 errors
      }
    })

  } catch (error) {
    const totalTime = Date.now() - startTime
    logger.error('Smart refetch failed', {
      tags: ['api', 'admin', 'predictions', 'smart-refetch'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime: `${totalTime}ms`
      }
    })
    return NextResponse.json({ 
      error: 'Smart refetch failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      totalTime: `${totalTime}ms`
    }, { status: 500 })
  }
}

// GET /api/admin/predictions/smart-refetch - Get smart refetch status
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate 72-hour cutoff for consistent filtering
    const now = new Date()
    const cutoffDate = new Date(now.getTime() + 72 * 60 * 60 * 1000) // 72 hours from now

    // Get statistics about smart refetch status
    // Since we can't use the match relationship, we'll get basic counts first
    const stats = await prisma.$transaction([
      // Total QuickPurchase records with match data
      prisma.quickPurchase.count({
        where: { 
          matchId: { not: null },
          isPredictionActive: true
        }
      }),
      // Records that need 48h refetch
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
          refetchPriority: '48h'
        }
      }),
      // Records that need 24h refetch
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
          refetchPriority: '24h'
        }
      }),
      // Records that need urgent refetch
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
          refetchPriority: 'urgent'
        }
      }),
      // Records with no refetch priority (up to date)
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
          refetchPriority: null
        }
      })
    ])

    // Note: The 72-hour filtering will be applied when actually processing refetches
    // For now, we show the total counts and indicate the filtering happens during processing

    return NextResponse.json({
      success: true,
      data: {
        totalQuickPurchases: stats[0],
        need48hRefetch: stats[1],
        need24hRefetch: stats[2],
        needUrgentRefetch: stats[3],
        upToDate: stats[4],
        totalNeedingRefetch: stats[1] + stats[2] + stats[3],
        timeWindow: '72 hours (applied during processing)',
        cutoffDate: cutoffDate.toISOString(),
        currentTime: now.toISOString(),
        note: '72-hour filtering is applied when processing refetches, not when counting status'
      }
    })

  } catch (error) {
    logger.error('Failed to get smart refetch status', {
      tags: ['api', 'admin', 'predictions', 'smart-refetch'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    return NextResponse.json({ 
      error: 'Failed to get status', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
