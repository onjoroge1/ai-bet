import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { Redis } from '@upstash/redis'
import { fetchAvailability, partitionAvailability, type AvailabilityItem } from '@/lib/predictionAvailability'
import { predictionCacheKey, ttlForMatch } from '@/lib/predictionCacheKey'

// Initialize Redis client
const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
})

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

/**
 * Global Sync Endpoint - Syncs all available matches from /consensus/sync API
 * This solves the 94.9% data gap by ensuring all prediction-capable matches are in QuickPurchase table
 * 
 * Timeout Configuration:
 * - maxDuration: 300 seconds (5 minutes) for Vercel Pro/Enterprise
 * - runtime: nodejs (required for long-running operations)
 */
export const maxDuration = 300 // 5 minutes - allows processing ~150-200 matches
export const runtime = 'nodejs' // Use Node.js runtime for long operations

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Check authentication - either admin session OR cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'
    const isCronRequest = authHeader === `Bearer ${cronSecret}` || req.headers.get('x-internal-cron') === 'true'
    
    let isAuthorized = false
    let session: any = null
    
    if (isCronRequest) {
      // Cron job authentication
      isAuthorized = true
      logger.info('Global sync authenticated via CRON_SECRET', {
        tags: ['api', 'admin', 'global-sync', 'auth'],
        data: { source: 'cron' }
      })
    } else {
      // Admin session authentication
      session = await getServerSession(authOptions)
      if (session?.user?.role && session.user.role.toLowerCase() === 'admin') {
        isAuthorized = true
      }
    }
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized - Admin access or CRON_SECRET required' }, { status: 401 })
    }

    // Parse request body for optional date range
    const body = await req.json().catch(() => ({}))
    const { fromDate: requestFromDate, toDate: requestToDate, timeWindow = 'recent' } = body

    logger.info('Starting global availability sync', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        userId: isCronRequest ? 'cron' : session?.user?.id,
        userEmail: isCronRequest ? 'cron@system' : session?.user?.email,
        source: isCronRequest ? 'cron' : 'manual',
        timestamp: new Date().toISOString()
      }
    })

    // Get default country for pricing (try multiple common countries)
    let defaultCountry = await prisma.country.findFirst({
      where: { 
        code: { in: ['US', 'us', 'GB', 'gb', 'CA', 'ca'] }, // Try US, UK, Canada
        isActive: true 
      },
      select: { id: true, code: true, currencyCode: true, currencySymbol: true }
    })

    // If none of the preferred countries found, use any active country as fallback
    if (!defaultCountry) {
      logger.warn('Preferred countries not found, using first available active country', {
        tags: ['api', 'admin', 'global-sync', 'warning']
      })
      
      defaultCountry = await prisma.country.findFirst({
        where: { isActive: true },
        select: { id: true, code: true, currencyCode: true, currencySymbol: true },
        orderBy: { code: 'asc' } // Get consistent fallback
      })
    }

    if (!defaultCountry) {
      logger.error('No active countries found in database', {
        tags: ['api', 'admin', 'global-sync', 'error']
      })
      return NextResponse.json({ 
        error: 'System configuration error: No active countries found' 
      }, { status: 500 })
    }

    logger.info('Using default country for pricing', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        countryCode: defaultCountry.code,
        currencyCode: defaultCountry.currencyCode
      }
    })

    // Step 1: Calculate date range for filtering
    let fromDate: string
    let toDate: string

    if (requestFromDate && requestToDate) {
      // Use provided date range
      fromDate = requestFromDate
      toDate = requestToDate
    } else {
      // Default: broader range (last 5 days) for better coverage of recent matches
      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
      const today = new Date()
      
      fromDate = fiveDaysAgo.toISOString().split('T')[0] // YYYY-MM-DD format
      toDate = today.toISOString().split('T')[0]
    }
    
    logger.info('Attempting to fetch recent consensus predictions', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        backendUrl: process.env.BACKEND_URL,
        fromDate,
        toDate,
        timeWindow: 'current_date - 1'
      }
    })

    let uniqueMatchIds: string[] = []

    try {
      // Try the new consensus endpoint first with date filtering
      const consensusUrl = `${process.env.BACKEND_URL}/consensus/sync?from_date=${fromDate}&to_date=${toDate}&limit=1000`
      
      logger.info('Calling consensus endpoint with date filter', {
        tags: ['api', 'admin', 'global-sync'],
        data: { url: consensusUrl }
      })
      
      const consensusResponse = await fetch(consensusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CONSENSUS_API_KEY || 'betgenius_secure_key_2024'}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (consensusResponse.ok) {
        const consensusData = await consensusResponse.json()
        
        if (consensusData.data && Array.isArray(consensusData.data)) {
          const consensusMatches = consensusData.data
          const matchIds = consensusMatches.map((item: any) => item.match_id.toString())
          uniqueMatchIds = [...new Set(matchIds)]

          logger.info('Successfully fetched from consensus endpoint', {
            tags: ['api', 'admin', 'global-sync'],
            data: { 
              totalConsensusRecords: consensusMatches.length,
              uniqueMatches: uniqueMatchIds.length,
              sampleMatchIds: uniqueMatchIds.slice(0, 5),
              dateRange: `${fromDate} to ${toDate}`,
              source: 'consensus_api'
            }
          })
        } else {
          throw new Error('Invalid consensus response format')
        }
      } else {
        const errorText = await consensusResponse.text()
        throw new Error(`Consensus API error: ${consensusResponse.status} - ${errorText}`)
      }
    } catch (error) {
      logger.error('Consensus endpoint failed - no fallback available', {
        tags: ['api', 'admin', 'global-sync', 'error'],
        data: { 
          error: error instanceof Error ? error.message : String(error),
          dateRange: `${fromDate} to ${toDate}`
        }
      })
      
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch from consensus endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    logger.info('Starting unified sync process for discovered matches', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        totalMatches: uniqueMatchIds.length,
        sampleMatchIds: uniqueMatchIds.slice(0, 5)
      }
    })

    // Step 1.5: Query MarketMatch table for UPCOMING matches (PRIMARY SOURCE - matches we're selling)
    logger.info('Querying MarketMatch table for UPCOMING matches', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        source: 'marketmatch_table',
        status: 'UPCOMING',
        priority: 'PRIMARY'
      }
    })

    const upcomingMarketMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        isActive: true,
        kickoffDate: {
          gte: new Date() // Only future matches
        }
      },
      select: {
        id: true, // MarketMatch internal ID (for marketMatchId link)
        matchId: true, // External API match ID
        homeTeam: true,
        awayTeam: true,
        league: true,
        leagueId: true,
        kickoffDate: true,
        consensusOdds: true,
        v1Model: true,
        v2Model: true,
        homeTeamLogo: true,
        awayTeamLogo: true
      },
      orderBy: {
        kickoffDate: 'asc' // Process earliest matches first
      }
    })

    const marketMatchIds = upcomingMarketMatches
      .map(m => m.matchId)
      .filter(Boolean) as string[]

    // Create lookup map for MarketMatch data (for use in QuickPurchase creation)
    const marketMatchMap = new Map<string, typeof upcomingMarketMatches[0]>()
    upcomingMarketMatches.forEach(match => {
      if (match.matchId) {
        marketMatchMap.set(match.matchId, match)
      }
    })

    logger.info('Found UPCOMING matches in MarketMatch table', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        totalUpcoming: upcomingMarketMatches.length,
        uniqueMatchIds: marketMatchIds.length,
        sampleMatchIds: marketMatchIds.slice(0, 5),
        source: 'marketmatch_table'
      }
    })

    // DIAGNOSTIC: Compare consensus/sync matches with availability API
    // This helps identify if the two APIs return different match sets
    if (uniqueMatchIds.length > 0) {
      try {
        const consensusMatchIdsAsNumbers = uniqueMatchIds.map(id => parseInt(id)).filter(id => !isNaN(id))
        const availabilityBatches = chunk(consensusMatchIdsAsNumbers, 100)
        
        let totalAvailableMatches: number[] = []
        let consensusMatchesInAvailability: number[] = []
        let consensusMatchesNotInAvailability: number[] = []

        for (const batch of availabilityBatches) {
          try {
            const availability = await fetchAvailability(batch, false)
            const readyMatches = partitionAvailability(availability.availability).ready
            
            totalAvailableMatches.push(...readyMatches)
            consensusMatchesInAvailability.push(...readyMatches.filter(id => consensusMatchIdsAsNumbers.includes(id)))
            
            // Find matches in consensus but not ready in availability
            const consensusInBatch = batch.filter(id => consensusMatchIdsAsNumbers.includes(id))
            const notReady = consensusInBatch.filter(id => !readyMatches.includes(id))
            consensusMatchesNotInAvailability.push(...notReady)
          } catch (error) {
            logger.warn('Availability check failed for diagnostic batch', {
              tags: ['api', 'admin', 'global-sync', 'diagnostic'],
              data: { error: error instanceof Error ? error.message : 'Unknown error' }
            })
          }
        }

        logger.info('DIAGNOSTIC: Consensus vs Availability API comparison', {
          tags: ['api', 'admin', 'global-sync', 'diagnostic'],
          data: {
            consensusMatches: uniqueMatchIds.length,
            consensusMatchIds: uniqueMatchIds.slice(0, 10),
            availabilityReadyMatches: totalAvailableMatches.length,
            consensusMatchesInAvailability: consensusMatchesInAvailability.length,
            consensusMatchesNotInAvailability: consensusMatchesNotInAvailability.length,
            sampleConsensusInAvailability: consensusMatchesInAvailability.slice(0, 5),
            sampleConsensusNotInAvailability: consensusMatchesNotInAvailability.slice(0, 5),
            conclusion: consensusMatchesNotInAvailability.length > 0 
              ? 'Some consensus matches are not ready in availability API'
              : 'All consensus matches are ready in availability API'
          }
        })
      } catch (error) {
        logger.warn('Diagnostic comparison failed', {
          tags: ['api', 'admin', 'global-sync', 'diagnostic'],
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        })
      }
    }

    // Step 2: Get all existing QuickPurchase records that need enrichment (SECONDARY SOURCE)
    // This is the same approach as prediction enrichment - use database as source of truth
    logger.info('Checking database for existing matches needing enrichment', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        checkingFromMarketMatch: marketMatchIds.length,
        checkingFromConsensus: uniqueMatchIds.length,
        alsoCheckingDatabase: true,
        approach: 'marketmatch_first_then_database_then_consensus'
      }
    })

    // Get all existing QuickPurchase records that need enrichment (same query as enrichment system)
    const existingNeedingEnrichment = await prisma.quickPurchase.findMany({
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
        name: true,
        predictionData: true
      }
    })

    const databaseMatchIds = existingNeedingEnrichment.map(qp => qp.matchId).filter(Boolean) as string[]

    logger.info('Found existing matches in database needing enrichment', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        totalNeedingEnrichment: existingNeedingEnrichment.length,
        databaseMatchIds: databaseMatchIds.length,
        sampleMatchIds: databaseMatchIds.slice(0, 5)
      }
    })

    // DIAGNOSTIC: Compare all sources
    const marketMatchSet = new Set(marketMatchIds)
    const consensusSet = new Set(uniqueMatchIds)
    const databaseSet = new Set(databaseMatchIds)
    
    const inMarketMatchNotInDb = marketMatchIds.filter(id => !databaseSet.has(id))
    const inDbNotInMarketMatch = databaseMatchIds.filter(id => !marketMatchSet.has(id))
    const inConsensusNotInDb = uniqueMatchIds.filter(id => !databaseSet.has(id))
    const inDbNotInConsensus = databaseMatchIds.filter(id => !consensusSet.has(id))
    const inMarketMatchAndConsensus = marketMatchIds.filter(id => consensusSet.has(id))
    const inMarketMatchAndDb = marketMatchIds.filter(id => databaseSet.has(id))

    logger.info('DIAGNOSTIC: MarketMatch vs Database vs Consensus comparison', {
      tags: ['api', 'admin', 'global-sync', 'diagnostic'],
      data: {
        marketMatchMatches: marketMatchIds.length,
        consensusMatches: uniqueMatchIds.length,
        databaseMatches: databaseMatchIds.length,
        inMarketMatchAndDb: inMarketMatchAndDb.length,
        inMarketMatchAndConsensus: inMarketMatchAndConsensus.length,
        inMarketMatchNotInDb: inMarketMatchNotInDb.length,
        inDbNotInMarketMatch: inDbNotInMarketMatch.length,
        inConsensusNotInDb: inConsensusNotInDb.length,
        inDbNotInConsensus: inDbNotInConsensus.length,
        sampleInMarketMatchNotInDb: inMarketMatchNotInDb.slice(0, 5),
        sampleInDbNotInMarketMatch: inDbNotInMarketMatch.slice(0, 5),
        conclusion: inMarketMatchNotInDb.length > 0
          ? `MarketMatch has ${inMarketMatchNotInDb.length} UPCOMING matches not in QuickPurchase - these will be created`
          : 'All MarketMatch UPCOMING matches are already in QuickPurchase'
      }
    })

    // Combine match IDs from ALL sources with priority order:
    // 1. MarketMatch UPCOMING (PRIMARY - matches we're selling)
    // 2. QuickPurchase needing enrichment (SECONDARY - existing records)
    // 3. Consensus API (TERTIARY - new matches from external API)
    const allMatchIds = new Set<string>([
      ...marketMatchIds,      // PRIMARY: MarketMatch UPCOMING (matches we're selling)
      ...databaseMatchIds,     // SECONDARY: QuickPurchase needing enrichment
      ...uniqueMatchIds        // TERTIARY: Consensus API (for new matches)
    ])

    logger.info('Combined match IDs from all sources (priority: MarketMatch > Database > Consensus)', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        fromMarketMatch: marketMatchIds.length,
        fromDatabase: databaseMatchIds.length,
        fromConsensus: uniqueMatchIds.length,
        totalUnique: allMatchIds.size,
        sampleMatchIds: Array.from(allMatchIds).slice(0, 5)
      }
    })

    // Step 3: Check database state and categorize matches
    const existingQuickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: { in: Array.from(allMatchIds) }
      },
      select: {
        id: true,
        matchId: true,
        name: true,
        predictionData: true
      }
    })

    // Create lookup map for existing records
    const existingMap = new Map<string, { id: string; name: string; hasPredictionData: boolean }>()
    existingQuickPurchases.forEach(qp => {
      if (qp.matchId) {
        const hasPredictionData = qp.predictionData !== null && 
                                 qp.predictionData !== Prisma.JsonNull &&
                                 (qp.predictionData as any) !== {} &&
                                 Object.keys(qp.predictionData as any).length > 0
        existingMap.set(qp.matchId, {
          id: qp.id,
          name: qp.name,
          hasPredictionData
        })
      }
    })

    // Categorize matches from ALL sources
    const matchesToSkip: string[] = [] // Exists with predictionData
    const matchesToEnrich: Array<{ matchId: string; quickPurchaseId: string }> = [] // Exists without predictionData
    const matchesToCreate: string[] = [] // Not exists
    const matchesToCreateFromMarketMatch: Array<{ matchId: string; marketMatchId: string }> = [] // Not exists, from MarketMatch

    // Categorize ALL matches (from all sources)
    for (const matchIdStr of allMatchIds) {
      const existing = existingMap.get(matchIdStr)
      const marketMatch = marketMatchMap.get(matchIdStr)
      
      if (existing) {
        // Exists in QuickPurchase
        if (existing.hasPredictionData) {
          matchesToSkip.push(matchIdStr)
        } else {
          // Exists but no predictionData - enrich it
          const alreadyInList = matchesToEnrich.some(m => m.matchId === matchIdStr)
          if (!alreadyInList) {
            matchesToEnrich.push({ matchId: matchIdStr, quickPurchaseId: existing.id })
          }
        }
      } else {
        // Not in QuickPurchase
        if (marketMatch) {
          // Exists in MarketMatch → Create QuickPurchase record with marketMatchId link
          matchesToCreateFromMarketMatch.push({ 
            matchId: matchIdStr, 
            marketMatchId: marketMatch.id 
          })
        } else {
          // Not in MarketMatch either → Create from consensus API
          matchesToCreate.push(matchIdStr)
        }
      }
    }

    logger.info('Categorized matches from all sources (MarketMatch, Database, Consensus)', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        fromMarketMatch: marketMatchIds.length,
        fromConsensus: uniqueMatchIds.length,
        fromDatabase: existingNeedingEnrichment.length,
        totalUnique: allMatchIds.size,
        toSkip: matchesToSkip.length,
        toEnrich: matchesToEnrich.length,
        toCreateFromMarketMatch: matchesToCreateFromMarketMatch.length,
        toCreateFromConsensus: matchesToCreate.length,
        totalToCreate: matchesToCreateFromMarketMatch.length + matchesToCreate.length,
        sampleToSkip: matchesToSkip.slice(0, 3),
        sampleToEnrich: matchesToEnrich.slice(0, 3).map(m => m.matchId),
        sampleToCreateFromMarketMatch: matchesToCreateFromMarketMatch.slice(0, 3).map(m => m.matchId),
        sampleToCreateFromConsensus: matchesToCreate.slice(0, 3)
      }
    })

    // Step 3: Optional - Check availability for matches needing processing
    const matchesNeedingProcessing = [
      ...matchesToEnrich.map(m => parseInt(m.matchId)),
      ...matchesToCreateFromMarketMatch.map(m => parseInt(m.matchId)).filter(id => !isNaN(id)),
      ...matchesToCreate.map(m => parseInt(m)).filter(id => !isNaN(id))
    ]

    let readyToEnrich: Array<{ matchId: string; quickPurchaseId: string }> = []
    let readyToCreate: string[] = []
    let waitingMatches: number[] = []
    let noOddsMatches: number[] = []
    let availabilityLookup: Map<number, AvailabilityItem> | undefined = undefined

    if (matchesNeedingProcessing.length > 0) {
      logger.info('Checking availability for matches needing processing', {
        tags: ['api', 'admin', 'global-sync'],
        data: {
          totalNeedingProcessing: matchesNeedingProcessing.length,
          toEnrich: matchesToEnrich.length,
          toCreate: matchesToCreate.length
        }
      })

      // Batch check availability
      const availabilityBatches = chunk(matchesNeedingProcessing, 100)
      availabilityLookup = new Map<number, AvailabilityItem>()

      for (let batchIndex = 0; batchIndex < availabilityBatches.length; batchIndex++) {
        const batch = availabilityBatches[batchIndex]
        try {
          const availability = await fetchAvailability(batch, false)
          const partitioned = partitionAvailability(availability.availability)
          
          // Store availability info for cache keys
          availability.availability.forEach(item => {
            availabilityLookup.set(item.match_id, item)
          })

          // Filter matches to enrich
          const readyEnrichIds = new Set(partitioned.ready)
          readyToEnrich = matchesToEnrich.filter(m => readyEnrichIds.has(parseInt(m.matchId)))
          
          // Filter matches to create (from MarketMatch and Consensus)
          const readyCreateFromMarketMatch = matchesToCreateFromMarketMatch
            .filter(m => readyEnrichIds.has(parseInt(m.matchId)))
            .map(m => m.matchId)
          const readyCreateFromConsensus = matchesToCreate.filter(m => readyEnrichIds.has(parseInt(m)))
          readyToCreate = [...readyCreateFromMarketMatch, ...readyCreateFromConsensus]

          waitingMatches.push(...partitioned.waiting.map(w => w.match_id))
          noOddsMatches.push(...partitioned.noOdds.map(n => n.match_id))

          logger.info(`Batch ${batchIndex + 1}/${availabilityBatches.length} availability check completed`, {
            tags: ['api', 'admin', 'global-sync'],
            data: {
              batchIndex: batchIndex + 1,
              ready: partitioned.ready.length,
              waiting: partitioned.waiting.length,
              noOdds: partitioned.noOdds.length
            }
          })
        } catch (error) {
          logger.warn(`Batch ${batchIndex + 1} availability check failed, processing all matches`, {
            tags: ['api', 'admin', 'global-sync', 'warning'],
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              batchSize: batch.length
            }
          })
          // Fallback: process all matches if availability check fails
          readyToEnrich = matchesToEnrich
          readyToCreate = [
            ...matchesToCreateFromMarketMatch.map(m => m.matchId),
            ...matchesToCreate
          ]
        }
      }

      logger.info('Availability check completed', {
        tags: ['api', 'admin', 'global-sync'],
        data: {
          readyToEnrich: readyToEnrich.length,
          readyToCreate: readyToCreate.length,
          waiting: waitingMatches.length,
          noOdds: noOddsMatches.length
        }
      })
    } else {
      // No matches need processing, all are ready to skip
      logger.info('No matches need processing, all already have prediction data', {
        tags: ['api', 'admin', 'global-sync']
      })
      // Set empty arrays to ensure processing loop doesn't run
      readyToEnrich = []
      readyToCreate = []
    }

    // Step 4: Process matches (enrichment and creation)
    let created = 0
    let enriched = 0
    let skipped = 0
    let errors = 0
    const errorDetails: string[] = []
    
    // Timeout protection: Stop processing before route timeout
    const MAX_PROCESSING_TIME = 240000 // 4 minutes (240 seconds)
    let timeoutReached = false

    // Helper functions (same as enrichment)
    const toValueRating = (conf: number): "Very High"|"High"|"Medium"|"Low" => {
      if (conf >= 0.6) return "Very High"
      if (conf >= 0.4) return "High"
      if (conf >= 0.25) return "Medium"
      return "Low"
    }

    const probToImpliedOdds = (pred?: {home_win?: number; draw?: number; away_win?: number}) => {
      if (!pred) return null
      const safe = (p?: number) => p && p > 0 ? +(1/p).toFixed(2) : null
      return {
        home: safe(pred.home_win),
        draw: safe(pred.draw),
        away: safe(pred.away_win),
      }
    }

    // Define prediction response type (same as enrichment)
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
      }
      analysis?: {
        explanation: string
      }
    }

    // Function to fetch prediction data with caching (same as enrichment)
    async function fetchPredictionDataWithCache(matchId: number, availabilityItem?: AvailabilityItem): Promise<PredictionResponse | null> {
      const cacheKey = predictionCacheKey(matchId, availabilityItem?.last_updated)
      
      // Check cache first
      const cachedPrediction = await redis.get<PredictionResponse>(cacheKey)
      if (cachedPrediction) {
        logger.debug('Using cached prediction', {
          tags: ['api', 'admin', 'global-sync'],
          data: { matchId, source: 'cache' }
        })
        return cachedPrediction
      }

      // Fetch from backend
      logger.debug('Fetching prediction from backend', {
        tags: ['api', 'admin', 'global-sync'],
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

      const prediction = await response.json() as PredictionResponse
      
      // Cache the prediction with dynamic TTL
      const ttl = ttlForMatch(availabilityItem)
      await redis.set(cacheKey, prediction, { ex: ttl })

      return prediction
    }

    // Combine all matches to process
    // Track which matches are from MarketMatch for proper linking
    const marketMatchCreateMap = new Map<string, string>() // matchId -> marketMatchId
    matchesToCreateFromMarketMatch.forEach(m => {
      marketMatchCreateMap.set(m.matchId, m.marketMatchId)
    })

    const allMatchesToProcess = [
      ...readyToEnrich.map(m => ({ 
        type: 'enrich' as const, 
        matchId: parseInt(m.matchId), 
        quickPurchaseId: m.quickPurchaseId,
        isFromMarketMatch: false
      })),
      ...readyToCreate.map(m => ({ 
        type: 'create' as const, 
        matchId: parseInt(m), 
        quickPurchaseId: null,
        isFromMarketMatch: marketMatchCreateMap.has(m),
        marketMatchId: marketMatchCreateMap.get(m) || null
      }))
    ]

    logger.info('Starting /predict calls for ready matches', {
      tags: ['api', 'admin', 'global-sync'],
      data: {
        totalToProcess: allMatchesToProcess.length,
        toEnrich: readyToEnrich.length,
        toCreate: readyToCreate.length,
        toSkip: matchesToSkip.length
      }
    })

    // Process all matches (enrichment and creation)
    for (let i = 0; i < allMatchesToProcess.length; i++) {
      // Check if we're approaching timeout
      const elapsedTime = Date.now() - startTime
      if (elapsedTime > MAX_PROCESSING_TIME) {
        timeoutReached = true
        logger.warn('⏰ Approaching timeout limit, stopping match processing', {
          tags: ['api', 'admin', 'global-sync', 'timeout'],
          data: {
            processed: i,
            total: allMatchesToProcess.length,
            created,
            enriched,
            skipped,
            errors,
            elapsedTime: `${elapsedTime}ms`,
            remainingMatches: allMatchesToProcess.length - i
          }
        })
        break
      }

      const match = allMatchesToProcess[i]
      const matchId = match.matchId
      const matchIdStr = matchId.toString()
      const requestStartTime = Date.now()

      try {
        logger.info(`Processing match ${i + 1}/${allMatchesToProcess.length}`, {
          tags: ['api', 'admin', 'global-sync'],
          data: { 
            matchId, 
            matchIdStr,
            action: match.type,
            progress: `${i + 1}/${allMatchesToProcess.length}`
          }
        })

        // Rate limiting: 300ms delay between calls (except first one)
        if (i > 0) {
          await delay(300)
        }

        // Get availability info for cache key
        const availabilityItem = availabilityLookup?.get(matchId)
        
        // Fetch prediction data (with caching)
        logger.debug(`Fetching prediction for match ${matchId}`, {
          tags: ['api', 'admin', 'global-sync'],
          data: { 
            matchId,
            action: match.type,
            backendUrl: `${process.env.BACKEND_URL}/predict`
          }
        })

        const predictStartTime = Date.now()
        let prediction: PredictionResponse | null = null

        try {
          prediction = await fetchPredictionDataWithCache(matchId, availabilityItem)
          const predictResponseTime = Date.now() - predictStartTime

          logger.info(`Received /predict response for match ${matchId}`, {
            tags: ['api', 'admin', 'global-sync'],
            data: {
              matchId,
              matchIdStr,
              action: match.type,
              status: prediction ? 'success' : 'failed',
              responseTime: `${predictResponseTime}ms`,
              progress: `${i + 1}/${allMatchesToProcess.length}`
            }
          })
        } catch (fetchError) {
          const predictResponseTime = Date.now() - predictStartTime
          const isTimeout = fetchError instanceof Error && 
                           (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'))
          
          errors++
          const errorMessage = isTimeout 
            ? `Request timeout after ${predictResponseTime}ms (30s limit exceeded)`
            : fetchError instanceof Error ? fetchError.message : String(fetchError)
          
          logger.error(`❌ FAILED: Match ID ${matchId} - /predict API call failed`, {
            tags: ['api', 'admin', 'global-sync', 'error'],
            data: { 
              matchId,
              matchIdStr,
              action: match.type,
              status: isTimeout ? 'timeout' : 'fetch_error',
              error: errorMessage,
              responseTime: `${predictResponseTime}ms`,
              progress: `${i + 1}/${allMatchesToProcess.length}`,
              summary: `${errors} errors, ${created} created, ${enriched} enriched, ${skipped} skipped`
            }
          })
          errorDetails.push(`Match ${matchId}: ${errorMessage}`)
          await delay(200)
          continue
        }

        if (!prediction || !prediction.match_info) {
          errors++
          logger.error(`❌ FAILED: Match ID ${matchId} - Invalid prediction response`, {
            tags: ['api', 'admin', 'global-sync', 'error'],
            data: { 
              matchId,
              matchIdStr,
              action: match.type,
              status: 'invalid_response',
              hasPrediction: !!prediction,
              hasMatchInfo: !!prediction?.match_info
            }
          })
          errorDetails.push(`Match ${matchId}: Invalid prediction response - missing match_info`)
          await delay(200)
          continue
        }

        // Skip if confidence is 0 (not ready)
        const confidence = prediction.predictions?.confidence ?? 0
        if (confidence === 0) {
          logger.info('Skipping prediction with 0 confidence', {
            tags: ['api', 'admin', 'global-sync'],
            data: { matchId, confidence, action: match.type }
          })
          skipped++
          await delay(200)
          continue
        }

        // Extract prediction details (same logic as enrichment)
        const matchInfo = prediction.match_info
        const matchName = matchInfo.home_team && matchInfo.away_team
          ? `${matchInfo.home_team} vs ${matchInfo.away_team}`
          : `Match ${matchId}`

        const predictionType = prediction.predictions?.recommended_bet ?? 
                              prediction.comprehensive_analysis?.ai_verdict?.recommended_outcome?.toLowerCase().replace(' ', '_') ?? 
                              'no_prediction'
        
        const confidenceScore = Math.round(confidence * 100)
        const valueRating = toValueRating(confidence)
        const odds = probToImpliedOdds(prediction.predictions)
        const analysisSummary = prediction.analysis?.explanation ?? 
                               prediction.comprehensive_analysis?.ai_verdict?.confidence_level ?? 
                               'AI prediction available'

        const totalRequestTime = Date.now() - requestStartTime

        // Get MarketMatch data if available (for creation)
        const marketMatch = match.isFromMarketMatch && match.marketMatchId
          ? marketMatchMap.get(matchIdStr)
          : null

        if (match.type === 'enrich') {
          // Enrich existing QuickPurchase record
          const dbStartTime = Date.now()
          try {
            await prisma.quickPurchase.update({
              where: { id: match.quickPurchaseId! },
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

            const dbTime = Date.now() - dbStartTime
            enriched++

            logger.info(`✅ SUCCESS: Match ${matchId} enriched`, {
              tags: ['api', 'admin', 'global-sync'],
              data: { 
                matchId, 
                matchIdStr,
                quickPurchaseId: match.quickPurchaseId,
                predictionType,
                confidenceScore,
                valueRating,
                dbTime: `${dbTime}ms`,
                processingTime: `${totalRequestTime}ms`,
                progress: `${enriched}/${readyToEnrich.length} enriched`
              }
            })
          } catch (dbError) {
            const dbTime = Date.now() - dbStartTime
            errors++
            const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
            logger.error(`❌ DATABASE ERROR: Failed to enrich QuickPurchase for Match ID ${matchId}`, {
              tags: ['api', 'admin', 'global-sync', 'error'],
              data: {
                matchId,
                matchIdStr,
                quickPurchaseId: match.quickPurchaseId,
                status: 'database_error',
                error: dbErrorMessage,
                dbTime: `${dbTime}ms`
              }
            })
            errorDetails.push(`Match ${matchId}: Database error - ${dbErrorMessage}`)
            await delay(200)
            continue
          }
        } else {
          // Create new QuickPurchase record
          // Use MarketMatch data if available (for richer match information)
          const matchDataFromMarketMatch = marketMatch ? {
            match_id: Number(matchId),
            home_team: marketMatch.homeTeam,
            away_team: marketMatch.awayTeam,
            league: marketMatch.league,
            league_id: marketMatch.leagueId,
            date: marketMatch.kickoffDate.toISOString(),
            home_team_logo: marketMatch.homeTeamLogo,
            away_team_logo: marketMatch.awayTeamLogo,
            consensus_odds: marketMatch.consensusOdds,
            v1_model: marketMatch.v1Model,
            v2_model: marketMatch.v2Model,
            source: 'marketmatch_table',
            sync_timestamp: new Date().toISOString()
          } : {
            ...matchInfo,
            source: 'global_sync',
            sync_timestamp: new Date().toISOString()
          }

          const quickPurchaseData = {
            name: marketMatch 
              ? `${marketMatch.homeTeam} vs ${marketMatch.awayTeam}`
              : matchName,
            price: 9.99,
            originalPrice: 19.99,
            description: marketMatch
              ? `AI prediction for ${marketMatch.homeTeam} vs ${marketMatch.awayTeam}`
              : (matchInfo.home_team && matchInfo.away_team
                ? `AI prediction for ${matchInfo.home_team} vs ${matchInfo.away_team}`
                : `AI prediction for match ${matchId}`),
            features: ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
            type: 'prediction',
            iconName: 'Brain',
            colorGradientFrom: '#3B82F6',
            colorGradientTo: '#1D4ED8',
            countryId: defaultCountry.id,
            matchId: matchIdStr,
            marketMatchId: marketMatch?.id || null, // Link to MarketMatch if available
            matchData: matchDataFromMarketMatch,
            predictionData: prediction as any,
            predictionType: predictionType,
            confidenceScore: confidenceScore,
            odds: odds?.home || (marketMatch?.consensusOdds as any)?.home || null,
            valueRating: valueRating,
            analysisSummary: analysisSummary,
            isPredictionActive: true,
            isActive: true
          }

          const dbStartTime = Date.now()
          try {
            await prisma.quickPurchase.create({ data: quickPurchaseData })
            const dbTime = Date.now() - dbStartTime
            created++

            logger.info(`✅ SUCCESS: Match ID ${matchId} created in QuickPurchase database`, {
              tags: ['api', 'admin', 'global-sync'],
              data: { 
                matchId,
                matchIdStr,
                name: marketMatch ? `${marketMatch.homeTeam} vs ${marketMatch.awayTeam}` : matchName,
                predictionType,
                confidenceScore,
                valueRating,
                source: marketMatch ? 'marketmatch_table' : 'consensus_api',
                marketMatchId: marketMatch?.id || null,
                linkedToMarketMatch: !!marketMatch,
                dbTime: `${dbTime}ms`,
                totalTime: `${totalRequestTime}ms`,
                progress: `${created}/${readyToCreate.length} created`
              }
            })
          } catch (dbError) {
            const dbTime = Date.now() - dbStartTime
            errors++
            const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
            logger.error(`❌ DATABASE ERROR: Failed to create QuickPurchase for Match ID ${matchId}`, {
              tags: ['api', 'admin', 'global-sync', 'error'],
              data: {
                matchId,
                matchIdStr,
                status: 'database_error',
                error: dbErrorMessage,
                dbTime: `${dbTime}ms`
              }
            })
            errorDetails.push(`Match ${matchId}: Database error - ${dbErrorMessage}`)
            await delay(200)
            continue
          }
        }

        // Rate limiting: small delay between requests (same as enrichment)
        await delay(500)

      } catch (error) {
        const errorTime = Date.now() - requestStartTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        logger.error('Error processing match', {
          tags: ['api', 'admin', 'global-sync', 'error'],
          data: {
            matchId: matchIdStr,
            action: match.type,
            error: errorMessage,
            requestTime: `${errorTime}ms`
          }
        })
        
        errors++
        errorDetails.push(`Match ${matchIdStr}: ${errorMessage}`)
      }
    }

    // Count skipped matches
    skipped = matchesToSkip.length

    const processingTime = Date.now() - startTime
    const totalProcessed = created + enriched + skipped
    // Total available includes MarketMatch, Database, and Consensus
    const totalAvailable = allMatchIds.size
    const coverage = totalAvailable > 0 
      ? ((totalProcessed / totalAvailable) * 100).toFixed(1)
      : '0.0'

    logger.info('Global sync completed', {
      tags: ['api', 'admin', 'global-sync', 'completed'],
      data: {
        sources: {
          marketMatch: marketMatchIds.length,
          database: databaseMatchIds.length,
          consensus: uniqueMatchIds.length
        },
        available: totalAvailable,
        created,
        enriched,
        skipped,
        errors,
        totalProcessed,
        coverage: `${coverage}%`,
        processingTimeMs: processingTime,
        processingTimeMin: (processingTime / 60000).toFixed(2),
        dateRange: `${fromDate} to ${toDate}`,
        timeoutReached: timeoutReached,
        partialSync: timeoutReached,
        waiting: waitingMatches.length,
        noOdds: noOddsMatches.length
      }
    })

    // Return comprehensive results
    return NextResponse.json({
      success: true,
      summary: {
        available: totalAvailable,
        created,
        enriched,
        skipped,
        errors,
        totalProcessed,
        coverage: `${coverage}%`,
        processingTime: {
          milliseconds: processingTime,
          minutes: (processingTime / 60000).toFixed(2)
        },
        dateRange: `${fromDate} to ${toDate}`,
        source: 'unified_sync_with_enrichment',
        waiting: waitingMatches.length,
        noOdds: noOddsMatches.length
      },
      message: timeoutReached
        ? `Sync partially completed due to timeout. ${created} new matches created, ${enriched} existing matches enriched, ${skipped} already complete, ${errors} errors.`
        : errors > 0 
        ? `Sync completed with ${errors} errors. ${created} new matches created, ${enriched} existing matches enriched, ${skipped} already complete.`
        : `Sync completed successfully! ${created} new matches created, ${enriched} existing matches enriched, ${skipped} already complete.`,
      errorDetails: errors > 0 ? errorDetails.slice(0, 10) : [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Global sync failed with unexpected error', {
      tags: ['api', 'admin', 'global-sync', 'error'],
      data: { 
        error: errorMessage,
        processingTimeMs: processingTime,
        stack: error instanceof Error ? error.stack : undefined
      }
    })

    return NextResponse.json({
      success: false,
      error: 'Global sync failed',
      details: errorMessage,
      processingTime: {
        milliseconds: processingTime,
        minutes: (processingTime / 60000).toFixed(2)
      },
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check sync status and statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current QuickPurchase statistics
    const totalQuickPurchases = await prisma.quickPurchase.count({
      where: { matchId: { not: null } }
    })

    const activeQuickPurchases = await prisma.quickPurchase.count({
      where: { 
        matchId: { not: null },
        isActive: true
      }
    })

    const withPredictionData = await prisma.quickPurchase.count({
      where: {
        matchId: { not: null },
        predictionData: { not: null }
      }
    })

    // Get latest sync info (approximate based on creation time)
    const latestQuickPurchase = await prisma.quickPurchase.findFirst({
      where: { matchId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })

    return NextResponse.json({
      success: true,
      statistics: {
        totalMatches: totalQuickPurchases,
        activeMatches: activeQuickPurchases,
        withPredictionData,
        withoutPredictionData: totalQuickPurchases - withPredictionData,
        lastSync: latestQuickPurchase?.createdAt || null
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Failed to get sync statistics', {
      tags: ['api', 'admin', 'global-sync', 'error'],
      data: { error: errorMessage }
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to get sync statistics',
      details: errorMessage
    }, { status: 500 })
  }
}
