import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

// Helper function to find all upcoming matches (for syncAll)
async function findAllUpcomingMatches(leagueId?: string, limit: number = 100) {
  logger.info('Finding all upcoming matches', {
    tags: ['api', 'admin', 'predictions', 'sync'],
    data: { leagueId, limit }
  })

  const now = new Date()
  
  // Query for all upcoming matches (future matches)
  const leagueFilter = leagueId ? `AND (qp."matchData"->>'league_id') = '${leagueId}'` : ''
  
  const rawQuery = `
    SELECT qp.* FROM "QuickPurchase" qp
    WHERE qp."matchId" IS NOT NULL
    AND qp."isPredictionActive" = true
    AND qp."name" NOT LIKE '%Team A%'
    AND qp."name" NOT LIKE '%Team B%'
    AND qp."name" NOT LIKE '%Test League%'
    AND (qp."matchData"->>'date')::timestamp > '${now.toISOString()}'
    ${leagueFilter}
    ORDER BY qp."createdAt" DESC
    LIMIT ${limit}
  `

  const matches = await prisma.$queryRawUnsafe(rawQuery)
  
  logger.info('Found all upcoming matches', {
    tags: ['api', 'admin', 'predictions', 'sync'],
    data: { 
      foundCount: Array.isArray(matches) ? matches.length : 0,
      sampleMatchIds: Array.isArray(matches) ? matches.slice(0, 3).map((m: any) => m.matchId) : []
    }
  })

  return matches
}

// Helper function to find matches in time window
async function findMatchesInTimeWindow(timeWindow: string, leagueId?: string, limit: number = 50) {
  const now = new Date()
  let cutoffDate: Date
  
  switch (timeWindow) {
    case '72h':
      cutoffDate = new Date(now.getTime() + 72 * 60 * 60 * 1000)
      break
    case '48h':
      cutoffDate = new Date(now.getTime() + 48 * 60 * 60 * 1000)
      break
    case '24h':
      cutoffDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      break
    case 'urgent':
      cutoffDate = new Date(now.getTime() + 6 * 60 * 60 * 1000)
      break
    default:
      cutoffDate = new Date(now.getTime() + 72 * 60 * 60 * 1000)
  }

  logger.info('Finding matches in time window', {
    tags: ['api', 'admin', 'predictions', 'sync'],
    data: { 
      timeWindow, 
      now: now.toISOString(), 
      cutoffDate: cutoffDate.toISOString(),
      leagueId,
      limit
    }
  })

  // Query for matches in time window using raw SQL for better performance
  const timeFilter = `
    AND (qp."matchData"->>'date')::timestamp <= '${cutoffDate.toISOString()}'
    AND (qp."matchData"->>'date')::timestamp >= '${now.toISOString()}'
  `
  
  const leagueFilter = leagueId ? `AND (qp."matchData"->>'league_id') = '${leagueId}'` : ''
  
  const rawQuery = `
    SELECT qp.* FROM "QuickPurchase" qp
    WHERE qp."matchId" IS NOT NULL
    AND qp."isPredictionActive" = true
    AND qp."name" NOT LIKE '%Team A%'
    AND qp."name" NOT LIKE '%Team B%'
    AND qp."name" NOT LIKE '%Test League%'
    ${timeFilter}
    ${leagueFilter}
    ORDER BY qp."createdAt" DESC
    LIMIT ${limit}
  `

  const matches = await prisma.$queryRawUnsafe(rawQuery)
  
  logger.info('Found matches in time window', {
    tags: ['api', 'admin', 'predictions', 'sync'],
    data: { 
      timeWindow, 
      foundCount: Array.isArray(matches) ? matches.length : 0,
      sampleMatchIds: Array.isArray(matches) ? matches.slice(0, 3).map((m: any) => m.matchId) : []
    }
  })

  return matches
}

// Helper function to clear predictionData
async function clearPredictionData(matches: any[]) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return 0
  }

  const matchIds = matches.map(match => match.id)
  
  logger.info('Clearing prediction data for matches', {
    tags: ['api', 'admin', 'predictions', 'sync'],
    data: { 
      matchCount: matchIds.length,
      sampleIds: matchIds.slice(0, 3)
    }
  })

  const result = await prisma.quickPurchase.updateMany({
    where: {
      id: { in: matchIds }
    },
    data: {
      predictionData: Prisma.JsonNull,
      confidenceScore: 0,
      predictionType: null,
      odds: null,
      valueRating: null,
      analysisSummary: null
    }
  })

  logger.info('Cleared prediction data', {
    tags: ['api', 'admin', 'predictions', 'sync'],
    data: { 
      clearedCount: result.count,
      expectedCount: matchIds.length
    }
  })

  return result.count
}

// Helper function to call existing enrichment API
async function callEnrichmentAPI(timeWindow: string, leagueId?: string, limit: number = 50) {
  try {
    logger.info('Calling enrichment API', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: { timeWindow, leagueId, limit }
    })

    // Use a simple HTTP call to the enrichment endpoint
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    // Get the session to pass authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      throw new Error('Unauthorized: Admin access required')
    }
    
    const response = await fetch(`${baseUrl}/api/admin/predictions/enrich-quickpurchases`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken || 'internal-call'}`
      },
      body: JSON.stringify({ timeWindow, leagueId, limit })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Enrichment API failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    logger.info('Enrichment API completed', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: { 
        success: result.success,
        enrichedCount: result.data?.enrichedCount || 0,
        totalProcessed: result.data?.totalProcessed || 0
      }
    })

    return result
  } catch (error) {
    logger.error('Failed to call enrichment API', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timeWindow,
        leagueId
      }
    })
    throw error
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

    logger.info('Starting QuickPurchase sync process', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: { 
        timeWindow, 
        leagueId, 
        limit, 
        syncAll,
        startTime: new Date(startTime).toISOString() 
      }
    })

    // Step 1: Find matches to sync
    let matchesToSync: any[]
    
    if (syncAll) {
      // Find all upcoming matches
      matchesToSync = await findAllUpcomingMatches(leagueId, limit)
    } else {
      // Find matches in specific time window
      matchesToSync = await findMatchesInTimeWindow(timeWindow, leagueId, limit)
    }
    
    if (!Array.isArray(matchesToSync) || matchesToSync.length === 0) {
      logger.info('No matches found in time window', {
        tags: ['api', 'admin', 'predictions', 'sync'],
        data: { timeWindow, leagueId }
      })
      
      return NextResponse.json({
        success: true,
        message: `No matches found in ${timeWindow} time window`,
        data: {
          clearedCount: 0,
          enrichmentResult: {
            enrichedCount: 0,
            totalProcessed: 0
          }
        }
      })
    }
    
    // Step 2: Clear predictionData for those matches
    const clearedCount = await clearPredictionData(matchesToSync)
    
    // Step 3: Call existing enrichment API
    const enrichmentResult = await callEnrichmentAPI(timeWindow, leagueId, limit)
    
    const totalTime = Date.now() - startTime

    logger.info('QuickPurchase sync completed', {
      tags: ['api', 'admin', 'predictions', 'sync'],
      data: {
        timeWindow,
        leagueId,
        clearedCount,
        enrichedCount: enrichmentResult.data?.enrichedCount || 0,
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
        enrichmentResult: enrichmentResult.data || {},
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
      where: { 
        matchId: { not: null },
        isPredictionActive: true
      }
    })

    const enrichedQuickPurchases = await prisma.quickPurchase.count({
      where: { 
        matchId: { not: null },
        predictionData: { not: Prisma.JsonNull },
        isPredictionActive: true
      }
    })

    const pendingEnrichment = await prisma.quickPurchase.count({
      where: {
        matchId: { not: null },
        predictionData: Prisma.JsonNull,
        isPredictionActive: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        totalQuickPurchases,
        enrichedQuickPurchases,
        pendingEnrichment,
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
