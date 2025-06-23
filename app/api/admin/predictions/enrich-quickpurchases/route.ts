import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { Redis } from '@upstash/redis'
import { BullMQ } from 'bullmq'

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
        tags: ['api', 'admin', 'predictions', 'enrich'],
        data: { matchId, source: 'cache' }
      })
      return {
        match_id: matchId,
        prediction: cachedPrediction,
        source: 'cache'
      }
    }

    logger.debug('Fetching prediction from backend', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
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
        tags: ['api', 'admin', 'predictions', 'enrich'],
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
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { 
        matchId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    })
    throw new Error(`Failed to fetch prediction: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// POST /api/admin/predictions/enrich-quickpurchases - Enrich QuickPurchase records with prediction data
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { limit = 10, leagueId } = await req.json()

    logger.info('Starting QuickPurchase prediction enrichment', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { limit, leagueId, startTime: new Date(startTime).toISOString() }
    })

    // Find QuickPurchase records that need prediction data
    const whereClause: Prisma.QuickPurchaseWhereInput = {
      matchId: { not: null },
      predictionData: { equals: Prisma.JsonNull },
      isPredictionActive: true
    }

    let quickPurchases: any[] = []

    if (leagueId) {
      // If leagueId is provided, we need to join with matches to filter by league
      quickPurchases = await prisma.quickPurchase.findMany({
        where: whereClause,
        include: {
          // We'll need to join with matches to filter by league
        },
        take: limit
      })
    } else {
      // Get all QuickPurchase records without prediction data
      quickPurchases = await prisma.quickPurchase.findMany({
        where: {
          matchId: { not: null },
          OR: [
            { predictionData: { equals: Prisma.JsonNull } },
            { predictionData: { equals: {} } }
          ],
          isPredictionActive: true
        },
        take: limit
      })
    }

    const dbQueryTime = Date.now() - startTime

    // Debug: Let's also check what QuickPurchase records exist
    const allQuickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: { not: null },
        isPredictionActive: true
      },
      select: {
        id: true,
        matchId: true,
        predictionData: true,
        name: true
      }
    })

    // Debug: Check specific records that should be enriched
    const recordsToEnrich = await prisma.quickPurchase.findMany({
      where: {
        matchId: { not: null },
        OR: [
          { predictionData: { equals: Prisma.JsonNull } },
          { predictionData: { equals: {} } }
        ],
        isPredictionActive: true
      },
      select: {
        id: true,
        matchId: true,
        predictionData: true,
        name: true
      }
    })

    logger.info('Debug: All QuickPurchase records with matchId', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { 
        totalQuickPurchases: allQuickPurchases.length,
        sampleRecords: allQuickPurchases.slice(0, 3).map(qp => ({
          id: qp.id,
          matchId: qp.matchId,
          hasPredictionData: qp.predictionData !== null,
          predictionDataType: typeof qp.predictionData,
          predictionDataValue: qp.predictionData,
          name: qp.name
        })),
        dbQueryTime: `${dbQueryTime}ms`
      }
    })

    logger.info('Debug: Records that should be enriched', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { 
        recordsToEnrich: recordsToEnrich.length,
        sampleRecordsToEnrich: recordsToEnrich.slice(0, 3).map(qp => ({
          id: qp.id,
          matchId: qp.matchId,
          predictionDataType: typeof qp.predictionData,
          predictionDataValue: qp.predictionData,
          name: qp.name
        }))
      }
    })

    logger.info('Found QuickPurchase records to enrich', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { 
        totalFound: quickPurchases.length,
        sampleMatchIds: quickPurchases.slice(0, 3).map((qp: any) => qp.matchId),
        estimatedTime: `${quickPurchases.length * 2.5} seconds (${quickPurchases.length} requests × 2.5s each)`
      }
    })

    let enrichedCount = 0
    let failedCount = 0
    const errors: string[] = []

    // Process each QuickPurchase record
    for (const quickPurchase of quickPurchases) {
      const requestStartTime = Date.now()
      
      try {
        if (!quickPurchase.matchId) {
          logger.warn('QuickPurchase has no matchId', {
            tags: ['api', 'admin', 'predictions', 'enrich'],
            data: { quickPurchaseId: quickPurchase.id }
          })
          continue
        }

        logger.debug('Fetching prediction data for match', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: { 
            quickPurchaseId: quickPurchase.id,
            matchId: quickPurchase.matchId,
            requestStartTime: new Date(requestStartTime).toISOString()
          }
        })

        // Fetch prediction data directly (avoiding HTTP middleware)
        const predictionData = await fetchPredictionData(quickPurchase.matchId, true)

        const fetchTime = Date.now() - requestStartTime

        // Extract key prediction information
        const prediction = predictionData.prediction
        if (!prediction) {
          logger.warn('No prediction data in response', {
            tags: ['api', 'admin', 'predictions', 'enrich'],
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
        const matchInfo = prediction.match_info

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

        // Update the QuickPurchase record
        await prisma.quickPurchase.update({
          where: { id: quickPurchase.id },
          data: {
            predictionData: predictionData,
            predictionType: predictionType,
            confidenceScore: confidenceScore,
            odds: odds ? parseFloat(odds) : null,
            valueRating: valueRating,
            analysisSummary: analysisSummary,
            isPredictionActive: true
          }
        })

        const totalRequestTime = Date.now() - requestStartTime

        logger.debug('Successfully enriched QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: {
            quickPurchaseId: quickPurchase.id,
            matchId: quickPurchase.matchId,
            predictionType,
            confidenceScore,
            valueRating,
            fetchTime: `${fetchTime}ms`,
            totalRequestTime: `${totalRequestTime}ms`,
            source: predictionData.source
          }
        })

        enrichedCount++

        // Add a longer delay to avoid overwhelming the API and give it time to process
        // The backend API might need more time between requests
        const delay = 2000 // 2 seconds delay between requests
        logger.debug(`Waiting ${delay}ms before next request`, {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: { 
            matchId: quickPurchase.matchId,
            delay,
            progress: `${enrichedCount + failedCount}/${quickPurchases.length}`,
            elapsedTime: `${Date.now() - startTime}ms`
          }
        })
        await new Promise(resolve => setTimeout(resolve, delay))

      } catch (error) {
        const errorTime = Date.now() - requestStartTime
        logger.error('Error enriching QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
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

    logger.info('QuickPurchase enrichment completed', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: {
        totalProcessed: quickPurchases.length,
        enrichedCount,
        failedCount,
        totalTime: `${totalTime}ms`,
        averageTimePerRequest: quickPurchases.length > 0 ? `${Math.round(totalTime / quickPurchases.length)}ms` : 'N/A',
        errors: errors.slice(0, 5) // Log first 5 errors
      }
    })

    return NextResponse.json({
      success: true,
      message: `Enriched ${enrichedCount} QuickPurchase records`,
      data: {
        totalProcessed: quickPurchases.length,
        enrichedCount,
        failedCount,
        totalTime: `${totalTime}ms`,
        averageTimePerRequest: quickPurchases.length > 0 ? `${Math.round(totalTime / quickPurchases.length)}ms` : 'N/A',
        errors: errors.slice(0, 10) // Return first 10 errors
      }
    })

  } catch (error) {
    const totalTime = Date.now() - startTime
    logger.error('QuickPurchase enrichment failed', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime: `${totalTime}ms`
      }
    })
    return NextResponse.json({ 
      error: 'Enrichment failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      totalTime: `${totalTime}ms`
    }, { status: 500 })
  }
}

// GET /api/admin/predictions/enrich-quickpurchases - Get enrichment status
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get statistics about QuickPurchase enrichment status
    const totalQuickPurchases = await prisma.quickPurchase.count({
      where: { matchId: { not: null } }
    })

    const enrichedQuickPurchases = await prisma.quickPurchase.count({
      where: { 
        matchId: { not: null },
        predictionData: { not: Prisma.JsonNull }
      }
    })

    const pendingEnrichment = await prisma.quickPurchase.count({
      where: {
        matchId: { not: null },
        predictionData: { equals: Prisma.JsonNull },
        isPredictionActive: true
      }
    })

    const inactivePredictions = await prisma.quickPurchase.count({
      where: {
        matchId: { not: null },
        isPredictionActive: false
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        totalQuickPurchases,
        enrichedQuickPurchases,
        pendingEnrichment,
        inactivePredictions,
        enrichmentRate: totalQuickPurchases > 0 ? Math.round((enrichedQuickPurchases / totalQuickPurchases) * 100) : 0
      }
    })

  } catch (error) {
    logger.error('Failed to get enrichment status', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
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