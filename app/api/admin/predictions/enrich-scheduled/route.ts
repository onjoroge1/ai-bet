import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { fetchAvailability, partitionAvailability } from '@/lib/predictionAvailability'
import { predictionCacheKey, ttlForMatch } from '@/lib/predictionCacheKey'
import { createClient } from 'redis'

// Utility function to chunk arrays
function chunk<T>(arr: T[], size = 100): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// Utility function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Function to convert confidence to value rating
function toValueRating(confidence: number): string {
  if (confidence >= 0.8) return 'Very High'
  if (confidence >= 0.7) return 'High'
  if (confidence >= 0.6) return 'Medium'
  if (confidence >= 0.5) return 'Low'
  return 'Very Low'
}

// Function to convert probabilities to implied odds
function probToImpliedOdds(pred?: {home_win?: number; draw?: number; away_win?: number}) {
  if (!pred) return null
  const safe = (p?: number) => p && p > 0 ? +(1/p).toFixed(2) : null
  return {
    home: safe(pred.home_win),
    draw: safe(pred.draw),
    away: safe(pred.away_win),
  }
}

// CRON-SPECIFIC: Smart processing based on time and match proximity
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Determine processing frequency based on current time
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    const isWeekend = day === 0 || day === 6
    const isPeakHours = hour >= 6 && hour <= 22
    
    let processingFrequency = 'low'
    let timeFilter = '24h' // Default: only matches within 24 hours
    
    if (isWeekend && isPeakHours) {
      processingFrequency = 'high'
      timeFilter = 'all' // Process all upcoming matches
    } else if (isPeakHours) {
      processingFrequency = 'medium'
      timeFilter = '72h' // Process matches within 72 hours
    } else {
      processingFrequency = 'low'
      timeFilter = '24h' // Process matches within 24 hours
    }

    logger.info('🕐 CRON: Starting smart scheduled enrichment', {
      tags: ['cron', 'enrichment', 'smart-schedule'],
      data: { 
        timestamp: now.toISOString(),
        trigger: 'scheduled-cron',
        processingFrequency,
        timeFilter,
        isWeekend,
        isPeakHours,
        hour,
        day
      }
    })

    // 1) Get upcoming matches based on smart time filtering
    const timeFilterDate = new Date()
    if (timeFilter === '24h') {
      timeFilterDate.setHours(timeFilterDate.getHours() + 24)
    } else if (timeFilter === '72h') {
      timeFilterDate.setHours(timeFilterDate.getHours() + 72)
    }
    // For 'all', we don't set an upper limit

    const whereClause: any = {
      matchId: { not: null },
      isPredictionActive: true,
      // Only upcoming matches (not past matches)
      matchData: {
        path: ['date'],
        gte: new Date().toISOString() // Only future matches
      }
    }

    // Add upper time limit based on processing frequency
    if (timeFilter !== 'all') {
      whereClause.matchData = {
        ...whereClause.matchData,
        lte: timeFilterDate.toISOString()
      }
    }

    const upcomingMatches = await prisma.quickPurchase.findMany({
      where: whereClause,
      select: {
        id: true,
        matchId: true,
        name: true,
        predictionData: true,
        lastEnrichmentAt: true,
        enrichmentCount: true,
        matchData: true
      },
      orderBy: { 
        lastEnrichmentAt: 'asc' // Process oldest first for freshness
      }
    })

    logger.info('📊 CRON: Found upcoming matches to process', {
      tags: ['cron', 'enrichment'],
      data: {
        processingFrequency,
        timeFilter,
        totalUpcomingMatches: upcomingMatches.length,
        withPredictions: upcomingMatches.filter(m => m.predictionData).length,
        withoutPredictions: upcomingMatches.filter(m => !m.predictionData).length,
        timeFilterDate: timeFilter !== 'all' ? timeFilterDate.toISOString() : 'all matches'
      }
    })

    if (upcomingMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches found for enrichment',
        data: {
          totalProcessed: 0,
          enrichedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          totalTime: '0ms'
        }
      })
    }

    // 2) Initialize Redis client
    let redis: any = null
    try {
      redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      })
    } catch (error) {
      logger.warn('CRON: Redis client creation failed, continuing without cache', {
        tags: ['cron', 'enrichment'],
        data: { error: error.message }
      })
    }
    
    if (redis) {
      try {
        await redis.connect()
      } catch (error) {
        logger.warn('CRON: Redis connection failed, continuing without cache', {
          tags: ['cron', 'enrichment'],
          data: { error: error.message }
        })
      }
    }

    // 3) Extract all unique match IDs from upcoming matches
    const uniqueMatchIds = [...new Set(upcomingMatches.map(qp => qp.matchId).filter(Boolean))]
    
    logger.info('🔄 CRON: Processing upcoming match IDs', {
      tags: ['cron', 'enrichment'],
      data: {
        uniqueMatchIds: uniqueMatchIds.length,
        totalUpcomingMatches: upcomingMatches.length
      }
    })

    // 3) Process in chunks of 100
    const chunks = chunk(uniqueMatchIds, 100)
    let totalEnrichTrue = 0
    let totalEnrichFalse = 0
    let totalRequested = 0
    let totalDeduped = 0
    let enrichedCount = 0
    let skippedCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (let batchIndex = 0; batchIndex < chunks.length; batchIndex++) {
      const batch = chunks[batchIndex]
      
      logger.info(`🔄 CRON: Processing batch ${batchIndex + 1}/${chunks.length}`, {
        tags: ['cron', 'enrichment'],
        data: {
          batchIndex: batchIndex + 1,
          totalBatches: chunks.length,
          batchSize: batch.length,
          matchIds: batch.slice(0, 5) // Log first 5 for debugging
        }
      })

      try {
        // Call availability API for this batch
        const availability = await fetchAvailability(batch, true)
        
        totalEnrichTrue += availability.meta.enrich_true
        totalEnrichFalse += availability.meta.enrich_false
        totalRequested += availability.meta.requested
        totalDeduped += availability.meta.deduped

        // Partition results
        const { ready, waiting, noOdds } = partitionAvailability(availability.availability)
        
        logger.info(`✅ CRON: Batch ${batchIndex + 1} availability check completed`, {
          tags: ['cron', 'enrichment'],
          data: {
            batchIndex: batchIndex + 1,
            enrichTrue: availability.meta.enrich_true,
            enrichFalse: availability.meta.enrich_false,
            ready: ready.length,
            waiting: waiting.length,
            noOdds: noOdds.length
          }
        })

        // Create lookup map for availability data
        const availabilityLookup = new Map(
          availability.availability.map(item => [item.match_id.toString(), item])
        )

        // Process only ready matches
        for (const matchId of ready.map(r => r.match_id)) {
          try {
            const quickPurchases = upcomingMatches.filter(qp => qp.matchId === matchId.toString())
            
            for (const quickPurchase of quickPurchases) {
              const availabilityItem = availabilityLookup.get(matchId.toString())
              const cacheKey = predictionCacheKey(matchId, availabilityItem?.last_updated)
              
              // Check cache first
              const cachedPrediction = redis ? await redis.get(cacheKey) : null
              let prediction: any = null

              if (cachedPrediction) {
                logger.debug('CRON: Using cached prediction', {
                  tags: ['cron', 'enrichment'],
                  data: { matchId, source: 'cache' }
                })
                prediction = cachedPrediction
              } else {
                // Fetch from backend
                logger.debug('CRON: Fetching prediction from backend', {
                  tags: ['cron', 'enrichment'],
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

                prediction = await response.json()
                
                // Cache the prediction with dynamic TTL
                const ttl = ttlForMatch(availabilityItem)
                if (redis) {
                  await redis.set(cacheKey, prediction, { ex: ttl })
                }
              }

              if (!prediction) {
                logger.warn('CRON: No prediction data received', {
                  tags: ['cron', 'enrichment'],
                  data: { matchId }
                })
                failedCount++
                errors.push(`Match ${matchId}: No prediction data`)
                continue
              }

              // Skip if confidence is 0 (not ready)
              const confidence = prediction.predictions?.confidence ?? 0
              if (confidence === 0) {
                logger.debug('CRON: Skipping match with 0 confidence', {
                  tags: ['cron', 'enrichment'],
                  data: { matchId, confidence }
                })
                skippedCount++
                continue
              }

              // Extract prediction data
              const predictionType = prediction.predictions?.recommended_bet ?? 'no_prediction'
              const confidenceScore = Math.round(confidence * 100)
              const valueRating = toValueRating(confidence)
              const odds = probToImpliedOdds(prediction.predictions)
              const analysisSummary = prediction.analysis?.explanation ?? 
                                     prediction.comprehensive_analysis?.ai_verdict?.confidence_level ?? 
                                     'AI prediction available'

              // Log the full prediction data before storing
              logger.info('CRON: Full prediction data received from backend', {
                tags: ['cron', 'enrichment'],
                data: {
                  matchId,
                  predictionDataSize: JSON.stringify(prediction).length,
                  predictionDataKeys: Object.keys(prediction),
                  hasAnalysis: !!prediction.analysis,
                  hasComprehensiveAnalysis: !!prediction.comprehensive_analysis,
                  isUpdate: !!quickPurchase.predictionData // Track if this is an update
                }
              })

              // Update the QuickPurchase record (whether new or existing)
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
                  lastEnrichmentAt: new Date(),
                  enrichmentCount: { increment: 1 }
                }
              })

              // Verify what was actually stored in the database
              const storedRecord = await prisma.quickPurchase.findUnique({
                where: { id: quickPurchase.id },
                select: { predictionData: true }
              })

              logger.info('CRON: Verification: Data stored in database', {
                tags: ['cron', 'enrichment'],
                data: {
                  matchId,
                  storedDataSize: storedRecord?.predictionData ? JSON.stringify(storedRecord.predictionData).length : 0,
                  storedDataKeys: storedRecord?.predictionData ? Object.keys(storedRecord.predictionData as any) : 'no data',
                  hasStoredAnalysis: !!(storedRecord?.predictionData as any)?.analysis,
                  isUpdate: !!quickPurchase.predictionData
                }
              })

              enrichedCount++

              // Rate limiting: delay between requests
              await delay(300)
            }
          } catch (error) {
            logger.error('CRON: Failed to process match', {
              tags: ['cron', 'enrichment', 'error'],
              data: { 
                matchId, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              }
            })
            failedCount++
            errors.push(`Match ${matchId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        // Update waiting and no_odds matches with status (but don't disable them)
        for (const item of [...waiting, ...noOdds]) {
          const quickPurchases = upcomingMatches.filter(qp => qp.matchId === item.match_id.toString())
          
          for (const quickPurchase of quickPurchases) {
            await prisma.quickPurchase.update({
              where: { id: quickPurchase.id },
              data: {
                analysisSummary: `Status: ${item.reason} (${item.bookmakers || 0} books, ${item.time_bucket || 'unknown'})`,
                isPredictionActive: true, // Keep active for retry
                lastEnrichmentAt: new Date()
              }
            })
          }
        }

      } catch (batchError) {
        logger.error(`CRON: Batch ${batchIndex + 1} failed`, {
          tags: ['cron', 'enrichment', 'error'],
          data: { 
            batchIndex: batchIndex + 1,
            error: batchError instanceof Error ? batchError.message : 'Unknown error' 
          }
        })
        failedCount += batch.length
        errors.push(`Batch ${batchIndex + 1}: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`)
      }
    }

    const totalTime = Date.now() - startTime
    const aggregateMeta = {
      enrich_true: totalEnrichTrue,
      enrich_false: totalEnrichFalse,
      requested: totalRequested,
      deduped: totalDeduped,
      failure_breakdown: {}
    }

    logger.info('✅ CRON: Smart scheduled enrichment completed', {
      tags: ['cron', 'enrichment'],
      data: {
        processingFrequency,
        timeFilter,
        totalProcessed: upcomingMatches.length,
        enrichedCount,
        skippedCount,
        failedCount,
        ready_count: totalEnrichTrue,
        waiting_count: 0, // We don't count waiting as processed
        no_odds_count: totalEnrichFalse,
        availability_meta: aggregateMeta,
        totalTime: `${totalTime}ms`,
        averageTimePerRequest: `${Math.round(totalTime / Math.max(enrichedCount, 1))}ms`,
        errors: errors.slice(0, 10) // Log first 10 errors
      }
    })

    return NextResponse.json({
      success: true,
      message: 'CRON: Scheduled enrichment completed successfully',
      data: {
        totalProcessed: upcomingMatches.length,
        enrichedCount,
        skippedCount,
        failedCount,
        ready_count: totalEnrichTrue,
        waiting_count: 0,
        no_odds_count: totalEnrichFalse,
        availability_meta: aggregateMeta,
        totalTime: `${totalTime}ms`,
        averageTimePerRequest: `${Math.round(totalTime / Math.max(enrichedCount, 1))}ms`,
        errors: errors.slice(0, 10)
      }
    })

    // Cleanup Redis connection
    if (redis) {
      try {
        await redis.quit()
      } catch (error) {
        logger.warn('CRON: Redis cleanup failed', {
          tags: ['cron', 'enrichment'],
          data: { error: error.message }
        })
      }
    }

  } catch (error) {
    const totalTime = Date.now() - startTime
    
    // Cleanup Redis connection in error case
    if (redis) {
      try {
        await redis.quit()
      } catch (cleanupError) {
        logger.warn('CRON: Redis cleanup failed in error handler', {
          tags: ['cron', 'enrichment'],
          data: { error: cleanupError.message }
        })
      }
    }
    
    logger.error('❌ CRON: Scheduled enrichment failed', {
      tags: ['cron', 'enrichment', 'error'],
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime: `${totalTime}ms`
      }
    })
    
    return NextResponse.json({ 
      error: 'CRON: Scheduled enrichment failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      totalTime: `${totalTime}ms`
    }, { status: 500 })
  }
}