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

// Rate limiting utility
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
  predictions?: {
    recommended_bet: string
    confidence: number
    home_win?: number
    draw?: number
    away_win?: number
  }
  comprehensive_analysis?: {
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
  analysis?: {
    explanation: string
  }
  model_info?: {
    bookmaker_count: number
  }
  processing_time?: number
}

// Helper function to convert probability to implied odds
function probToImpliedOdds(predictions?: { home_win?: number; draw?: number; away_win?: number }): { home?: number; draw?: number; away?: number } | null {
  if (!predictions) return null
  
  const odds: { home?: number; draw?: number; away?: number } = {}
  
  if (predictions.home_win) {
    odds.home = 1 / predictions.home_win
  }
  if (predictions.draw) {
    odds.draw = 1 / predictions.draw
  }
  if (predictions.away_win) {
    odds.away = 1 / predictions.away_win
  }
  
  return Object.keys(odds).length > 0 ? odds : null
}

// Helper function to convert confidence to value rating
function toValueRating(confidence: number): string {
  if (confidence >= 0.8) return 'Very High'
  if (confidence >= 0.65) return 'High'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}

/**
 * POST /api/admin/predictions/process-pending-direct
 * 
 * Standalone route that processes pending predictions directly:
 * - Filters upcoming matches (current date < kickoff AND kickoff <= current date + 24 hours)
 * - Directly calls /predict for each match
 * - Updates QuickPurchase table with predictionData
 * 
 * This is separate from enrich-quickpurchases and doesn't use availability checking.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting direct pending prediction processing', {
      tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
      data: { 
        startTime: new Date(startTime).toISOString(),
        approach: 'direct_predict_calls'
      }
    })

    // Calculate date range: current date < kickoff AND kickoff <= current date + 24 hours
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setHours(tomorrow.getHours() + 24)

    logger.info('Date filtering for upcoming matches', {
      tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
      data: {
        now: now.toISOString(),
        maxKickoff: tomorrow.toISOString(),
        window: '24 hours'
      }
    })

    // Get pending QuickPurchase records within the 24-hour window
    // Using raw query to filter by matchData.date JSON field
    // Note: Using string interpolation for dates (ISO format is safe)
    const nowISO = now.toISOString()
    const tomorrowISO = tomorrow.toISOString()
    
    const rawQuery = `
      SELECT qp.* 
      FROM "QuickPurchase" qp
      WHERE qp."matchId" IS NOT NULL
      AND qp."isPredictionActive" = true
      AND (
        qp."predictionData" IS NULL 
        OR qp."predictionData" = '{}'::jsonb
        OR qp."predictionData" = 'null'::jsonb
      )
      AND qp."matchData" IS NOT NULL
      AND (qp."matchData"->>'date') IS NOT NULL
      AND (qp."matchData"->>'date')::timestamp >= '${nowISO}'::timestamp
      AND (qp."matchData"->>'date')::timestamp <= '${tomorrowISO}'::timestamp
      ORDER BY (qp."matchData"->>'date')::timestamp ASC
    `

    const quickPurchases = await prisma.$queryRawUnsafe<any[]>(rawQuery)

    logger.info('Found pending QuickPurchases within 24-hour window', {
      tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
      data: { 
        totalPending: quickPurchases.length,
        dateRange: {
          from: now.toISOString(),
          to: tomorrow.toISOString()
        }
      }
    })

    if (quickPurchases.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending matches found within 24-hour window',
        data: {
          processedCount: 0,
          enrichedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          processingTime: Date.now() - startTime
        }
      })
    }

    let enrichedCount = 0
    let failedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    // Process each match with rate limiting
    for (let i = 0; i < quickPurchases.length; i++) {
      const quickPurchase = quickPurchases[i]
      const matchId = parseInt(quickPurchase.matchId)
      
      if (isNaN(matchId)) {
        logger.warn('Invalid matchId in QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
          data: { quickPurchaseId: quickPurchase.id, matchId: quickPurchase.matchId }
        })
        skippedCount++
        continue
      }

      // Rate limiting: 300ms delay between calls
      if (i > 0) {
        await delay(300)
      }

      logger.info(`Processing match ${i + 1}/${quickPurchases.length}`, {
        tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
        data: { 
          matchId, 
          progress: `${i + 1}/${quickPurchases.length}`,
          quickPurchaseId: quickPurchase.id
        }
      })

      try {
        // Check cache first
        const cacheKey = `prediction:${matchId}:true`
        let prediction: PredictionResponse | null = await redis.get<PredictionResponse>(cacheKey)

        if (!prediction) {
          // Fetch from backend
          logger.debug('Fetching prediction from backend', {
            tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
            data: { matchId, backendUrl: `${process.env.BACKEND_URL}/predict` }
          })

          const response = await fetch(`${process.env.BACKEND_URL}/predict`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
            },
            body: JSON.stringify({
              match_id: matchId,
              include_analysis: true
            }),
            signal: AbortSignal.timeout(30000) // 30 second timeout
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Backend responded with status ${response.status}: ${errorText}`)
          }

          prediction = await response.json() as PredictionResponse
          
          // Cache the prediction
          await redis.set(cacheKey, prediction, { ex: CACHE_TTL })
        } else {
          logger.debug('Using cached prediction', {
            tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
            data: { matchId, source: 'cache' }
          })
        }

        if (!prediction) {
          logger.warn('No prediction data received', {
            tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
            data: { matchId }
          })
          failedCount++
          errors.push(`Match ${matchId}: No prediction data`)
          continue
        }

        // Skip if confidence is 0 (not ready)
        const confidence = prediction.predictions?.confidence ?? 0
        if (confidence === 0) {
          logger.info('Skipping prediction with 0 confidence', {
            tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
            data: { matchId, confidence }
          })
          skippedCount++
          continue
        }

        // Extract prediction details
        const predictionType = prediction.predictions?.recommended_bet ?? 
                              prediction.comprehensive_analysis?.ai_verdict?.recommended_outcome?.toLowerCase().replace(' ', '_') ?? 
                              'no_prediction'
        
        const confidenceScore = Math.round(confidence * 100)
        const valueRating = toValueRating(confidence)
        const odds = probToImpliedOdds(prediction.predictions)
        const analysisSummary = prediction.analysis?.explanation ?? 
                               prediction.comprehensive_analysis?.ai_verdict?.confidence_level ?? 
                               'AI prediction available'

        // Update the QuickPurchase record
        await prisma.quickPurchase.update({
          where: { id: quickPurchase.id },
          data: {
            predictionData: prediction as any,
            predictionType: predictionType,
            confidenceScore: confidenceScore,
            odds: odds?.home || null,
            valueRating: valueRating,
            analysisSummary: analysisSummary,
            isPredictionActive: true,
            updatedAt: new Date()
          }
        })

        enrichedCount++
        logger.info('Successfully enriched QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
          data: {
            matchId,
            quickPurchaseId: quickPurchase.id,
            confidenceScore,
            predictionType
          }
        })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error('Failed to process match', {
          tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
          data: { 
            matchId, 
            quickPurchaseId: quickPurchase.id,
            error: errorMessage 
          }
        })
        failedCount++
        errors.push(`Match ${matchId}: ${errorMessage}`)
      }
    }

    const processingTime = Date.now() - startTime

    logger.info('Direct pending prediction processing completed', {
      tags: ['api', 'admin', 'predictions', 'process-pending-direct'],
      data: {
        totalProcessed: quickPurchases.length,
        enrichedCount,
        failedCount,
        skippedCount,
        processingTime: `${processingTime}ms`
      }
    })

    return NextResponse.json({
      success: true,
      message: `Processed ${quickPurchases.length} matches: ${enrichedCount} enriched, ${failedCount} failed, ${skippedCount} skipped`,
      data: {
        processedCount: quickPurchases.length,
        enrichedCount,
        failedCount,
        skippedCount,
        errors: errors.slice(0, 10), // Return first 10 errors
        processingTime
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to process pending predictions', {
      tags: ['api', 'admin', 'predictions', 'process-pending-direct', 'error'],
      data: { error: errorMessage }
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to process pending predictions',
      details: errorMessage
    }, { status: 500 })
  }
}

/**
 * GET /api/admin/predictions/process-pending-direct
 * 
 * Get statistics about pending matches within 24-hour window
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate date range: current date < kickoff AND kickoff <= current date + 24 hours
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setHours(tomorrow.getHours() + 24)

    // Get pending QuickPurchase records within the 24-hour window
    // Note: Using string interpolation for dates (ISO format is safe)
    const nowISO = now.toISOString()
    const tomorrowISO = tomorrow.toISOString()
    
    const rawQuery = `
      SELECT COUNT(*) as count
      FROM "QuickPurchase" qp
      WHERE qp."matchId" IS NOT NULL
      AND qp."isPredictionActive" = true
      AND (
        qp."predictionData" IS NULL 
        OR qp."predictionData" = '{}'::jsonb
        OR qp."predictionData" = 'null'::jsonb
      )
      AND qp."matchData" IS NOT NULL
      AND (qp."matchData"->>'date') IS NOT NULL
      AND (qp."matchData"->>'date')::timestamp >= '${nowISO}'::timestamp
      AND (qp."matchData"->>'date')::timestamp <= '${tomorrowISO}'::timestamp
    `

    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(rawQuery)

    const pendingCount = Number(result[0]?.count || 0)

    return NextResponse.json({
      success: true,
      data: {
        pendingCount,
        dateRange: {
          from: now.toISOString(),
          to: tomorrow.toISOString(),
          window: '24 hours'
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to get pending predictions stats', {
      tags: ['api', 'admin', 'predictions', 'process-pending-direct', 'error'],
      data: { error: errorMessage }
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to get pending predictions stats',
      details: errorMessage
    }, { status: 500 })
  }
}

