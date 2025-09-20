import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { fetchAvailability, partitionAvailability } from '@/lib/predictionAvailability'

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

// Helper function to find matches that have prediction data (ready for updates)
async function findMatchesWithPredictionData(leagueId?: string) {
  const now = new Date()
  const cutoffDate = new Date(now.getTime() + (72 * 60 * 60 * 1000)) // 72 hours from now

  if (leagueId && leagueId !== 'all') {
    // Find matches that already have prediction data
    const rawQuery = `
      SELECT * FROM "QuickPurchase" 
      WHERE "matchId" IS NOT NULL 
        AND "isPredictionActive" = true
        AND "predictionData" IS NOT NULL
        AND ("matchData"->>'date')::timestamp >= '${now.toISOString()}'::timestamp
        AND ("matchData"->>'date')::timestamp <= '${cutoffDate.toISOString()}'::timestamp
        AND ("matchData"->>'league') = '${leagueId}'
      ORDER BY "createdAt" ASC 
      LIMIT 100
    `
    
    return await prisma.$queryRawUnsafe(rawQuery)
  } else {
    // Find matches that already have prediction data
    const rawQuery = `
      SELECT * FROM "QuickPurchase" 
      WHERE "matchId" IS NOT NULL 
        AND "isPredictionActive" = true
        AND "predictionData" IS NOT NULL
        AND ("matchData"->>'date')::timestamp >= '${now.toISOString()}'::timestamp
        AND ("matchData"->>'date')::timestamp <= '${cutoffDate.toISOString()}'::timestamp
      ORDER BY "createdAt" ASC 
      LIMIT 100
    `
    
    return await prisma.$queryRawUnsafe(rawQuery)
  }
}

// Helper function to find matches by time window
async function findMatchesByTimeWindow(timeWindow: string, leagueId?: string, limit: number = 50) {
  const now = new Date()
  let startTime: Date

  switch (timeWindow) {
    case '72h':
      startTime = new Date(now.getTime() + 72 * 60 * 60 * 1000)
      break
    case '48h':
      startTime = new Date(now.getTime() + 48 * 60 * 60 * 1000)
      break
    case '24h':
      startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      break
    case 'urgent':
      startTime = new Date(now.getTime() + 6 * 60 * 60 * 1000)
      break
    default:
      startTime = new Date(now.getTime() + 72 * 60 * 60 * 1000)
  }

  const whereClause: Prisma.QuickPurchaseWhereInput = {
    matchId: { not: null },
    isPredictionActive: true,
    matchData: {
      path: ['date'],
      gte: startTime.toISOString()
    }
  }

  if (leagueId) {
    // Use raw query for league filtering
    const leagueFilter = `AND (qp."matchData"->>'league_id') = '${leagueId}'`
    
    const rawQuery = `
      SELECT qp.* FROM "QuickPurchase" qp
      WHERE qp."matchId" IS NOT NULL 
      AND qp."isPredictionActive" = true
      AND (qp."matchData"->>'date') >= '${startTime.toISOString()}'
      ${leagueFilter}
      ORDER BY qp."createdAt" DESC
      LIMIT ${limit}
    `
    
    return await prisma.$queryRawUnsafe(rawQuery)
  } else {
    return await prisma.quickPurchase.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }
}

// Helper function to clear prediction data
async function clearPredictionData(matches: any[]) {
  const matchIds = matches.map(m => m.id)
  
  const result = await prisma.quickPurchase.updateMany({
    where: {
      id: { in: matchIds }
    },
    data: {
      predictionData: Prisma.JsonNull,
      predictionType: null,
      confidenceScore: null,
      odds: null,
      valueRating: null,
      analysisSummary: null,
      lastEnrichmentAt: new Date()
    }
  })

  logger.info('Cleared prediction data for matches', {
    tags: ['api', 'admin', 'predictions', 'sync'],
    data: {
      clearedCount: result.count,
      expectedCount: matchIds.length
    }
  })

  return result.count
}

// Simplified enrichment function - call /predict directly on matches with prediction data
async function performDirectEnrichment(matches: any[], timeWindow: string, leagueId?: string) {
  const startTime = Date.now()
  
  try {
    logger.info('🔄 Starting direct enrichment process', {
      tags: ['api', 'admin', 'predictions', 'enrichment'],
      data: { 
        totalMatches: matches.length,
        timeWindow,
        leagueId: leagueId || 'all'
      }
    })

    // Extract unique match IDs and convert to numbers
    const uniqueMatchIds = [...new Set(matches.map(m => parseInt(m.matchId)).filter(id => !isNaN(id)))]
    
    logger.info('🔍 Processing matches that already have prediction data', {
      tags: ['api', 'admin', 'predictions', 'enrichment'],
      data: {
        totalMatches: matches.length,
        uniqueMatchIds: uniqueMatchIds.length,
        sampleMatchIds: uniqueMatchIds.slice(0, 5),
        sampleMatches: matches.slice(0, 3).map(m => ({
          id: m.id,
          matchId: m.matchId,
          name: m.name,
          hasPredictionData: !!m.predictionData
        }))
      }
    })
    
    if (uniqueMatchIds.length === 0) {
      logger.warn('No valid match IDs found for enrichment', {
        tags: ['api', 'admin', 'predictions', 'enrichment'],
        data: {
          totalMatches: matches.length,
          sampleMatches: matches.slice(0, 3).map(m => ({
            id: m.id,
            matchId: m.matchId,
            name: m.name
          }))
        }
      })
      
      return {
        success: true,
        data: {
          enrichedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          totalProcessed: 0,
          totalTime: '0ms'
        }
      }
    }

    let enrichedCount = 0
    let skippedCount = 0
    let failedCount = 0
    const errors: string[] = []

    // Process each match directly
    for (const matchId of uniqueMatchIds) {
      try {
        logger.info(`🔍 Processing match ${matchId}`, {
          tags: ['api', 'admin', 'predictions', 'enrichment'],
          data: { matchId }
        })

        const quickPurchase = matches.find(m => parseInt(m.matchId) === matchId)
        if (!quickPurchase) {
          logger.warn('QuickPurchase not found for match', {
            tags: ['api', 'admin', 'predictions', 'enrichment'],
            data: { matchId, availableMatchIds: matches.map(m => m.matchId).slice(0, 5) }
          })
          continue
        }

        logger.info(`📡 Calling /predict for match ${matchId}`, {
          tags: ['api', 'admin', 'predictions', 'enrichment'],
          data: { 
            matchId, 
            backendUrl: process.env.BACKEND_URL,
            hasApiKey: !!process.env.BACKEND_API_KEY
          }
        })

        // Fetch prediction from backend
        const response = await fetch(`${process.env.BACKEND_URL}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
          },
          body: JSON.stringify({
            match_id: matchId,
            include_analysis: true
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          logger.error(`❌ /predict failed for match ${matchId}`, {
            tags: ['api', 'admin', 'predictions', 'enrichment'],
            data: { 
              matchId, 
              status: response.status, 
              errorText: errorText.substring(0, 200)
            }
          })
          throw new Error(`Backend responded with status ${response.status}: ${errorText}`)
        }

        const prediction = await response.json()
        
        logger.info(`✅ /predict success for match ${matchId}`, {
          tags: ['api', 'admin', 'predictions', 'enrichment'],
          data: { 
            matchId, 
            hasPrediction: !!prediction,
            confidence: prediction?.predictions?.confidence ?? 0
          }
        })
        
        if (!prediction) {
          failedCount++
          errors.push(`Match ${matchId}: No prediction data`)
          continue
        }

        // Get confidence score
        const confidence = prediction.predictions?.confidence ?? 0
        
        // Only skip if there's no prediction data at all
        if (!prediction || !prediction.predictions) {
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
            lastEnrichmentAt: new Date(),
            enrichmentCount: { increment: 1 }
          }
        })

        enrichedCount++

        // Rate limiting: delay between requests
        await delay(300)

      } catch (error) {
        logger.error('Error enriching QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'enrichment', 'error'],
          data: {
            matchId: matchId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
        failedCount++
        errors.push(`Match ${matchId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    const totalTime = Date.now() - startTime

    logger.info('✅ Direct enrichment completed', {
      tags: ['api', 'admin', 'predictions', 'enrichment'],
      data: {
        totalProcessed: matches.length,
        enrichedCount,
        skippedCount,
        failedCount,
        totalTime: `${totalTime}ms`,
        errors: errors.slice(0, 10),
        // Summary of what happened
        summary: {
          totalMatches: matches.length,
          enriched: enrichedCount,
          skipped: skippedCount,
          failed: failedCount,
          successRate: matches.length > 0 ? Math.round((enrichedCount / matches.length) * 100) : 0
        }
      }
    })

    return {
      success: true,
      data: {
        enrichedCount,
        skippedCount,
        failedCount,
        totalProcessed: matches.length,
        totalTime: `${totalTime}ms`,
        errors: errors.slice(0, 10)
      }
    }

  } catch (error) {
    const totalTime = Date.now() - startTime
    
    logger.error('❌ Direct enrichment failed', {
      tags: ['api', 'admin', 'predictions', 'enrichment', 'error'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime: `${totalTime}ms`
      }
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        enrichedCount: 0,
        skippedCount: 0,
        failedCount: matches.length,
        totalProcessed: matches.length,
        totalTime: `${totalTime}ms`,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
}

// POST /api/admin/predictions/sync-quickpurchases - Sync and refresh predictions
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { timeWindow, leagueId, limit = 50, syncAll = false } = await req.json()

    logger.info('Starting QuickPurchase sync and enrichment', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: { 
        timeWindow, 
        leagueId, 
        limit, 
        syncAll,
        startTime: new Date(startTime).toISOString()
      }
    })

    // Step 1: Get matches to sync
    let matchesToSync: any[] = []
    
    if (syncAll) {
    logger.info('🔍 Fetching matches that already have prediction data', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: { leagueId: leagueId || 'all' }
    })
    matchesToSync = await findMatchesWithPredictionData(leagueId)
    } else {
      matchesToSync = await findMatchesByTimeWindow(timeWindow, leagueId, limit)
    }

    logger.info('Found matches to sync', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: {
        totalMatches: matchesToSync.length,
        timeWindow: syncAll ? 'all' : timeWindow,
        leagueId: leagueId || 'all',
        sampleMatchIds: matchesToSync.slice(0, 3).map((m: any) => m.matchId)
      }
    })

    // Step 2: Clear predictionData for those matches
    const clearedCount = await clearPredictionData(matchesToSync)
    
    // Step 3: Perform smart enrichment
    const enrichmentResult = await performDirectEnrichment(matchesToSync, timeWindow, leagueId)
    
    const totalTime = Date.now() - startTime

    logger.info('QuickPurchase sync completed', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: {
        timeWindow: syncAll ? 'all' : timeWindow,
        leagueId,
        clearedCount,
        enrichedCount: enrichmentResult.data?.enrichedCount || 0,
        skippedCount: enrichmentResult.data?.skippedCount || 0,
        failedCount: enrichmentResult.data?.failedCount || 0,
        totalProcessed: enrichmentResult.data?.totalProcessed || 0,
        totalTime: `${totalTime}ms`
      }
    })
    
    const syncType = syncAll ? 'all upcoming matches' : `${timeWindow} time window`
    
    return NextResponse.json({
      success: true,
      message: `Synced ${clearedCount} matches (${syncType}) and enriched ${enrichmentResult.data?.enrichedCount || 0} records`,
      data: {
        syncType,
        timeWindow: syncAll ? 'all' : timeWindow,
        leagueId,
        clearedCount,
        summary: {
          totalMatches: enrichmentResult.data?.totalProcessed || 0,
          enriched: enrichmentResult.data?.enrichedCount || 0,
          skipped: enrichmentResult.data?.skippedCount || 0,
          failed: enrichmentResult.data?.failedCount || 0
        },
        totalTime: `${totalTime}ms`
      }
    })

  } catch (error) {
    const totalTime = Date.now() - startTime
    logger.error('QuickPurchase sync failed', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime: `${totalTime}ms`
      }
    })
    return NextResponse.json({ 
      error: 'Sync failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      totalTime: `${totalTime}ms`
    }, { status: 500 })
  }
}

// GET /api/admin/predictions/sync-quickpurchases - Get sync status
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get statistics about QuickPurchase sync status
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
    logger.error('Failed to get sync status', {
      tags: ['api', 'admin', 'predictions', 'sync'],
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