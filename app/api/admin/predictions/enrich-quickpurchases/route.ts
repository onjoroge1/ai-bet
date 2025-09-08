import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { Redis } from '@upstash/redis'
import { fetchAvailability, partitionAvailability, type AvailabilityItem, type AvailabilityResponse } from '@/lib/predictionAvailability'
import { predictionCacheKey, ttlForMatch } from '@/lib/predictionCacheKey'

// Initialize Redis client
const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
})

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600

// Types are now imported from lib/predictionAvailability.ts

// Utility function to chunk arrays
function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

// Rate limiting utility for /predict calls
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
  additional_markets?: {
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
  analysis_metadata?: {
    analysis_type: string
    data_sources: string[]
    analysis_timestamp: string
    ml_model_accuracy: string
    ai_model: string
    processing_time: number
  }
  processing_time?: number
  timestamp?: string
}

// Helper functions are now imported from lib/predictionAvailability.ts

function toValueRating(conf: number): "Very High"|"High"|"Medium"|"Low" {
  if (conf >= 0.6) return "Very High"
  if (conf >= 0.4) return "High"
  if (conf >= 0.25) return "Medium"
  return "Low"
}

function probToImpliedOdds(pred?: {home_win?: number; draw?: number; away_win?: number}) {
  if (!pred) return null
  const safe = (p?: number) => p && p > 0 ? +(1/p).toFixed(2) : null
  return {
    home: safe(pred.home_win),
    draw: safe(pred.draw),
    away: safe(pred.away_win),
  }
}

// Cache key function is now imported from lib/predictionCacheKey.ts

// Availability function is now imported from lib/predictionAvailability.ts

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

    const { leagueId, timeWindow } = await req.json()

    logger.info('Starting QuickPurchase prediction enrichment (ALL PENDING)', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { 
        leagueId, 
        timeWindow, 
        startTime: new Date(startTime).toISOString(),
        approach: 'fetch_all_pending_then_chunk'
      }
    })

    // 1) Get ALL pending QuickPurchase records (no limit)
    const whereClause: Prisma.QuickPurchaseWhereInput = {
      matchId: { not: null },
      OR: [
        { predictionData: { equals: Prisma.JsonNull } },
        { predictionData: null }
      ],
      isPredictionActive: true
    }

    // Note: No timeWindow filtering needed since /predict/availability handles timing logic
    logger.info('Using availability-based filtering (no time window needed)', {
        tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { timeWindow: 'availability-based' }
      })

    let quickPurchases: any[] = []

    if (leagueId) {
      // If leagueId is provided, we need to use the matchData field instead of joining
      // The QuickPurchase table stores match data in the matchData JSON field
      const leagueFilter = leagueId ? `AND (qp."matchData"->>'league_id') = '${leagueId}'` : ''
      
      const rawQuery = `
        SELECT qp.* FROM "QuickPurchase" qp
        WHERE qp."matchId" IS NOT NULL 
        AND (qp."predictionData" IS NULL OR qp."predictionData" = '{}'::jsonb)
        AND qp."isPredictionActive" = true
        AND qp."name" NOT LIKE '%Team A%'
        AND qp."name" NOT LIKE '%Team B%'
        AND qp."name" NOT LIKE '%Team C%'
        AND qp."name" NOT LIKE '%Team D%'
        AND qp."name" NOT LIKE '%Team E%'
        AND qp."name" NOT LIKE '%Team F%'
        AND qp."name" NOT LIKE '%Team G%'
        AND qp."name" NOT LIKE '%Team H%'
        AND qp."name" NOT LIKE '%Test League%'
        ${leagueFilter}
        ORDER BY qp."createdAt" DESC
      `
      
      logger.info('Using raw query with league filtering', {
        tags: ['api', 'admin', 'predictions', 'enrich'],
        data: { leagueId, rawQuery: rawQuery.substring(0, 200) + '...' }
      })
      
      quickPurchases = await prisma.$queryRawUnsafe(rawQuery)
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
        // No limit - fetch all pending records
      })
    }

    const dbQueryTime = Date.now() - startTime

    logger.info('Found all pending QuickPurchases', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { 
        totalPending: quickPurchases.length,
        dbQueryTime: `${dbQueryTime}ms`,
        leagueId: leagueId || 'all'
      }
    })

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
        sampleRecords: quickPurchases.slice(0, 2).map((qp: any) => ({
          id: qp.id,
          matchId: qp.matchId,
          name: qp.name,
          hasMatchData: !!qp.matchData,
          hasPredictionData: !!qp.predictionData,
          isPredictionActive: qp.isPredictionActive
        })),
        estimatedTime: `${quickPurchases.length * 2.5} seconds (${quickPurchases.length} requests × 2.5s each)`
      }
    })

    // Step 1: Collect unique match IDs and dedupe
    const uniqueMatchIds = [...new Set(quickPurchases.map(qp => parseInt(qp.matchId)).filter(id => !isNaN(id)))]
    
    logger.info('Processing all pending matches with chunking', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { 
        totalQuickPurchases: quickPurchases.length,
        uniqueMatchIds: uniqueMatchIds.length,
        sampleMatchIds: uniqueMatchIds.slice(0, 5)
      }
    })

    // Step 2: Chunk match IDs into batches of 100
    const matchIdBatches = chunk(uniqueMatchIds, 100)
    
    logger.info('Chunked match IDs for batch processing', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: { 
        totalMatchIds: uniqueMatchIds.length,
        batchCount: matchIdBatches.length,
        batchSizes: matchIdBatches.map(batch => batch.length)
      }
    })

    // Early return if no matches to process
    if (uniqueMatchIds.length === 0) {
      logger.info('No matches found to enrich', {
        tags: ['api', 'admin', 'predictions', 'enrich'],
        data: { 
          totalQuickPurchases: quickPurchases.length,
          timeWindow,
          leagueId
        }
      })
      
      return NextResponse.json({
        success: true,
        message: `No matches found in ${timeWindow || 'all'} time window to enrich`,
        data: {
          totalProcessed: 0,
          enrichedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          availability: {
            readyCount: 0,
            waitingCount: 0,
            noOddsCount: 0,
            breakdown: {}
          },
          totalTime: `${Date.now() - startTime}ms`,
          averageTimePerRequest: 'N/A',
          errors: []
        }
      })
    }

    // Step 3: Process each batch of match IDs
    let allReady: number[] = []
    let allWaiting: AvailabilityItem[] = []
    let allNoOdds: AvailabilityItem[] = []
    let totalEnrichTrue = 0
    let totalEnrichFalse = 0
    let totalRequested = 0
    let totalDeduped = 0
    let totalFailureBreakdown: Record<string, any> = {}
    for (let batchIndex = 0; batchIndex < matchIdBatches.length; batchIndex++) {
      const batch = matchIdBatches[batchIndex]
      
      logger.info(`Processing batch ${batchIndex + 1}/${matchIdBatches.length}`, {
        tags: ['api', 'admin', 'predictions', 'enrich'],
        data: { 
          batchIndex: batchIndex + 1,
          totalBatches: matchIdBatches.length,
          batchSize: batch.length,
          sampleMatchIds: batch.slice(0, 3)
        }
      })
      
      try {
        // Call /predict/availability for this batch
        const availability = await fetchAvailability(batch, false) // Don't trigger consensus on first pass
        
        logger.info(`Batch ${batchIndex + 1} availability check completed`, {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: {
            batchIndex: batchIndex + 1,
            enrichTrue: availability.meta.enrich_true,
            enrichFalse: availability.meta.enrich_false,
            requested: availability.meta.requested,
            deduped: availability.meta.deduped,
        // Debug: Show specific match IDs and their status
        matchStatuses: availability.availability.map(item => ({
          matchId: item.match_id,
          enrich: item.enrich,
          reason: item.reason,
          bookmakers: item.bookmakers,
          timeBucket: item.time_bucket
        })),
        // Special debug for reset match IDs
        resetMatchIds: availability.availability.filter(item => 
          [1391284, 1396949, 1390858].includes(item.match_id)
        ).map(item => ({
          matchId: item.match_id,
          enrich: item.enrich,
          reason: item.reason,
          bookmakers: item.bookmakers,
          timeBucket: item.time_bucket
        }))
          }
        })
        
        // Partition this batch's results
        const partitioned = partitionAvailability(availability.availability)
        allReady.push(...partitioned.ready)
        allWaiting.push(...partitioned.waiting)
        allNoOdds.push(...partitioned.noOdds)
        
        // Accumulate meta data
        totalEnrichTrue += availability.meta.enrich_true
        totalEnrichFalse += availability.meta.enrich_false
        totalRequested += availability.meta.requested
        totalDeduped += availability.meta.deduped
        Object.assign(totalFailureBreakdown, availability.meta.failure_breakdown)
        
      } catch (error) {
        logger.error(`Batch ${batchIndex + 1} availability check failed`, {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: { 
            batchIndex: batchIndex + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
            batchSize: batch.length
          }
        })
        
        // Fallback: treat this batch as ready if availability API fails
        logger.warn(`Using fallback mode for batch ${batchIndex + 1} - processing as ready`, {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: { batchSize: batch.length }
        })
        
        allReady.push(...batch) // All matches in this batch are "ready"
        
        // Accumulate meta data for fallback case
        totalEnrichTrue += batch.length
        totalRequested += batch.length
        totalDeduped += batch.length
      }
    }
    
    // Set final results
    const ready = allReady
    const waiting = allWaiting
    const noOdds = allNoOdds
    
    // Create aggregate meta data for logging
    const aggregateMeta = {
      enrich_true: totalEnrichTrue,
      enrich_false: totalEnrichFalse,
      requested: totalRequested,
      deduped: totalDeduped,
      failure_breakdown: totalFailureBreakdown
    }
    
    // Create lookup map for availability items
    const availabilityLookup = new Map<number, AvailabilityItem>()
    ;[...allWaiting, ...allNoOdds].forEach(item => {
      availabilityLookup.set(item.match_id, item)
    })

    // Step 4: Log final partitioning results
    
    logger.info('Partitioned matches by availability', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: {
        readyCount: ready.length,
        waitingCount: waiting.length,
        noOddsCount: noOdds.length,
        readyMatchIds: ready, // Show ALL ready match IDs that will call /predict
        waitingReasons: waiting.slice(0, 3).map(w => ({ matchId: w.match_id, reason: w.reason, bucket: w.time_bucket }))
      }
    })

    // Step 4: Optional: Trigger consensus for waiting matches (admin mode)
    if (process.env.ADMIN_MODE === "true" && waiting.length > 0) {
      logger.info('Triggering consensus for waiting matches', {
        tags: ['api', 'admin', 'predictions', 'enrich'],
        data: { waitingCount: waiting.length }
      })
      
      // Fire-and-forget consensus trigger
      fetchAvailability(waiting.map(w => w.match_id), true).catch((error: any) => {
        logger.warn('Failed to trigger consensus', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        })
      })
    }

    let enrichedCount = 0
    let skippedCount = 0
    let failedCount = 0
    const errors: string[] = []

    // Step 5: Process only ready matches with rate limiting
    logger.info('Starting /predict calls for ready matches', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: {
        readyMatchIds: ready,
        totalReady: ready.length
      }
    })
    
    for (let i = 0; i < ready.length; i++) {
      const matchId = ready[i]
      const requestStartTime = Date.now()
      
      logger.info(`Processing match ${i + 1}/${ready.length}`, {
        tags: ['api', 'admin', 'predictions', 'enrich'],
        data: { matchId, progress: `${i + 1}/${ready.length}` }
      })
      
      // Rate limiting: 300ms delay between calls, max 3 concurrent
      if (i > 0) {
        await delay(300) // 300ms delay between calls
      }
      
      try {
        // Find the corresponding QuickPurchase record
        const quickPurchase = quickPurchases.find(qp => parseInt(qp.matchId) === matchId)
        if (!quickPurchase) {
          logger.warn('QuickPurchase not found for ready match', {
            tags: ['api', 'admin', 'predictions', 'enrich'],
            data: { matchId }
          })
          continue
        }

        // Get availability info for cache key
        const availabilityItem = availabilityLookup.get(matchId)
        const cacheKey = predictionCacheKey(matchId, availabilityItem?.last_updated)
        
        // Check cache first
        const cachedPrediction = await redis.get<PredictionResponse>(cacheKey)
        let prediction: PredictionResponse | null = null

        if (cachedPrediction) {
          logger.debug('Using cached prediction', {
            tags: ['api', 'admin', 'predictions', 'enrich'],
            data: { matchId, source: 'cache' }
          })
          prediction = cachedPrediction
        } else {
          // Fetch from backend
          logger.debug('Fetching prediction from backend', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
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
              include_analysis: true // Include full analysis for complete data
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Backend responded with status ${response.status}: ${errorText}`)
          }

          prediction = await response.json() as PredictionResponse
          
          // Cache the prediction with dynamic TTL
          const ttl = ttlForMatch(availabilityItem)
          await redis.set(cacheKey, prediction, { ex: ttl })
        }

        if (!prediction) {
          logger.warn('No prediction data received', {
            tags: ['api', 'admin', 'predictions', 'enrich'],
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
            tags: ['api', 'admin', 'predictions', 'enrich'],
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

        // Log the full prediction data before storing
        logger.info('Full prediction data received from backend', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: {
            matchId,
            predictionDataSize: JSON.stringify(prediction).length,
            predictionDataKeys: Object.keys(prediction),
            hasAnalysis: !!prediction.analysis,
            hasComprehensiveAnalysis: !!prediction.comprehensive_analysis,
            hasAiSummary: !!(prediction as any).analysis?.ai_summary,
            sampleData: {
              match_info: prediction.match_info,
              predictions: prediction.predictions,
              analysis_keys: prediction.analysis ? Object.keys(prediction.analysis) : 'no analysis',
              comprehensive_analysis_keys: prediction.comprehensive_analysis ? Object.keys(prediction.comprehensive_analysis) : 'no comprehensive_analysis'
            }
          }
        })

        // Update the QuickPurchase record
        await prisma.quickPurchase.update({
          where: { id: quickPurchase.id },
          data: {
            predictionData: prediction as any,
            predictionType: predictionType,
            confidenceScore: confidenceScore,
            odds: odds?.home || null, // Use home odds as primary
            valueRating: valueRating,
            analysisSummary: analysisSummary,
            isPredictionActive: true,
            lastEnrichmentAt: new Date(),
            enrichmentCount: { increment: 1 }
          }
        })

        const totalRequestTime = Date.now() - requestStartTime

        // Verify what was actually stored in the database
        const storedRecord = await prisma.quickPurchase.findUnique({
          where: { id: quickPurchase.id },
          select: { predictionData: true }
        })

        logger.info('Verification: Data stored in database', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: {
            matchId,
            storedDataSize: storedRecord?.predictionData ? JSON.stringify(storedRecord.predictionData).length : 0,
            storedDataKeys: storedRecord?.predictionData ? Object.keys(storedRecord.predictionData as any) : 'no data',
            hasStoredAnalysis: !!(storedRecord?.predictionData as any)?.analysis,
            hasStoredComprehensiveAnalysis: !!(storedRecord?.predictionData as any)?.comprehensive_analysis,
            storedAnalysisKeys: storedRecord?.predictionData && (storedRecord.predictionData as any)?.analysis ? Object.keys((storedRecord.predictionData as any).analysis) : 'no analysis'
          }
        })

        logger.debug('Successfully enriched QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: {
            quickPurchaseId: quickPurchase.id,
            matchId: matchId,
            predictionType,
            confidenceScore,
            valueRating,
            totalRequestTime: `${totalRequestTime}ms`,
            source: cachedPrediction ? 'cache' : 'backend'
          }
        })

        enrichedCount++

        logger.info(`✅ SUCCESS: Match ${matchId} enriched`, {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: { 
            matchId, 
            quickPurchaseId: quickPurchase.id,
            predictionType: (prediction as any).prediction_type,
            confidenceScore: (prediction as any).confidence_score,
            processingTime: `${Date.now() - requestStartTime}ms`,
            progress: `${enrichedCount}/${ready.length} completed`
          }
        })

        // Rate limiting: small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        const errorTime = Date.now() - requestStartTime
        logger.error('Error enriching QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'enrich'],
          data: {
            matchId: matchId,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestTime: `${errorTime}ms`
          }
        })
        failedCount++
        errors.push(`Match ${matchId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Step 6: Mark waiting and no-odds matches with status (but keep them active for future processing)
    for (const item of waiting) {
      const quickPurchase = quickPurchases.find(qp => parseInt(qp.matchId) === item.match_id)
      if (quickPurchase) {
        await prisma.quickPurchase.update({
          where: { id: quickPurchase.id },
          data: {
            predictionType: 'waiting_consensus',
            confidenceScore: 0,
            valueRating: 'Low',
            // Store detailed status information as recommended in checklist
            analysisSummary: `Waiting for consensus: ${item.reason || 'collecting odds'} | Books: ${item.bookmakers || 0} | Bucket: ${item.time_bucket || 'unknown'} | Updated: ${item.last_updated || 'unknown'}`,
            // Keep isPredictionActive: true so they remain in pending count
            isPredictionActive: true
          }
        })
      }
    }

    for (const item of noOdds) {
      const quickPurchase = quickPurchases.find(qp => parseInt(qp.matchId) === item.match_id)
      if (quickPurchase) {
        await prisma.quickPurchase.update({
          where: { id: quickPurchase.id },
          data: {
            predictionType: 'no_odds',
            confidenceScore: 0,
            valueRating: 'Low',
            // Store detailed status information as recommended in checklist
            analysisSummary: `No betting markets available: ${item.reason || 'no odds'} | Books: ${item.bookmakers || 0} | Bucket: ${item.time_bucket || 'unknown'} | Updated: ${item.last_updated || 'unknown'}`,
            // Keep isPredictionActive: true so they remain in pending count
            isPredictionActive: true
          }
        })
      }
    }

    const totalTime = Date.now() - startTime

    // Add telemetry as specified in playbook
    logger.info('[ENRICH] availability', { 
      requested: uniqueMatchIds.length, 
      ready: ready.length, 
      waiting: waiting.length, 
      noOdds: noOdds.length 
    })
    
    logger.info('[ENRICH] results', { 
      enrichedCount, 
      skippedCount, 
      failedCount, 
      durationMs: totalTime 
    })

    logger.info('QuickPurchase enrichment completed', {
      tags: ['api', 'admin', 'predictions', 'enrich'],
      data: {
        totalProcessed: quickPurchases.length,
        enrichedCount,
        skippedCount,
        failedCount,
        // Telemetry counts as recommended in checklist
        ready_count: ready.length,
        waiting_count: waiting.length,
        no_odds_count: noOdds.length,
        // Additional telemetry
        readyCount: ready.length,
        waitingCount: waiting.length,
        noOddsCount: noOdds.length,
        availability_meta: aggregateMeta,
        totalTime: `${totalTime}ms`,
        averageTimePerRequest: quickPurchases.length > 0 ? `${Math.round(totalTime / quickPurchases.length)}ms` : 'N/A',
        errors: errors.slice(0, 5) // Log first 5 errors
      }
    })

    return NextResponse.json({
      success: true,
      message: `Enriched ${enrichedCount} QuickPurchase records (${skippedCount} skipped, ${waiting.length} waiting, ${noOdds.length} no odds)`,
      data: {
        totalProcessed: quickPurchases.length,
        enrichedCount,
        skippedCount,
        failedCount,
        availability: {
          readyCount: ready.length,
          waitingCount: waiting.length,
          noOddsCount: noOdds.length,
          breakdown: aggregateMeta.failure_breakdown
        },
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