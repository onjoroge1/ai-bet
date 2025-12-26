import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

/**
 * Sync frequency constants
 * - Live matches: Every 30 seconds (cron runs every minute, syncs if lastSync > 30s ago)
 * - Upcoming matches: Every 10 minutes
 * - Completed matches: Only sync once when status changes to FINISHED, then never again
 */
const LIVE_SYNC_INTERVAL = 30 * 1000 // 30 seconds in milliseconds
const UPCOMING_SYNC_INTERVAL = 10 * 60 * 1000 // 10 minutes in milliseconds

/**
 * Fetch matches from external API
 */
async function fetchMatchesFromAPI(status: 'upcoming' | 'live' | 'completed', limit: number = 100) {
  if (!BASE_URL) {
    throw new Error('BACKEND_API_URL not configured')
  }

  // Map 'completed' to 'finished' for API compatibility
  const apiStatus = status === 'completed' ? 'finished' : status
  const url = `${BASE_URL}/market?status=${apiStatus}&limit=${limit}&include_v2=false`
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.matches || []
}

/**
 * Transform API match to MarketMatch format
 */
function transformMatchData(apiMatch: any) {
  const matchId = String(apiMatch.id || apiMatch.match_id || apiMatch.matchId || '')
  
  if (!matchId || matchId === 'undefined' || matchId === 'null') {
    return null
  }

  // Extract basic info
  const homeTeam = apiMatch.home?.name || apiMatch.homeTeam?.name || apiMatch.home_name || 'Home Team'
  const awayTeam = apiMatch.away?.name || apiMatch.awayTeam?.name || apiMatch.away_name || 'Away Team'
  const league = apiMatch.league?.name || apiMatch.leagueName || 'Unknown League'
  const leagueId = apiMatch.league?.id ? String(apiMatch.league.id) : null
  const kickoffDate = apiMatch.kickoff_at || apiMatch.kickoff_utc || apiMatch.matchDate || new Date()

  // Extract status
  const status = apiMatch.status?.toUpperCase() || 'UPCOMING'
  const normalizedStatus = status === 'LIVE' ? 'LIVE' : status === 'FINISHED' || status === 'COMPLETED' ? 'FINISHED' : 'UPCOMING'

  // Extract odds
  const consensusOdds = apiMatch.odds?.novig_current || apiMatch.odds?.consensus
  const allBookmakers = apiMatch.odds?.books || {}
  const booksCount = allBookmakers && typeof allBookmakers === 'object' ? Object.keys(allBookmakers).length : 0
  const primaryBook = Object.keys(allBookmakers || {})[0] || null

  // Extract model predictions
  const v1Model = apiMatch.models?.v1_consensus || apiMatch.predictions?.v1
  const v2Model = apiMatch.models?.v2_lightgbm || apiMatch.predictions?.v2

  // Extract live data (if status is LIVE)
  let currentScore = null
  let elapsed = null
  let period = null
  let liveStatistics = null
  let momentum = null
  let modelMarkets = null
  let aiAnalysis = null

  if (normalizedStatus === 'LIVE') {
    currentScore = apiMatch.score || apiMatch.live_data?.current_score
    elapsed = apiMatch.minute || apiMatch.elapsed || apiMatch.live_data?.minute
    period = apiMatch.period || apiMatch.live_data?.period || 'Live'
    liveStatistics = apiMatch.live_data?.statistics || apiMatch.statistics
    momentum = apiMatch.momentum
    modelMarkets = apiMatch.model_markets
    aiAnalysis = apiMatch.ai_analysis
  }

  // Extract final result (if status is FINISHED)
  let finalResult = null
  let matchStatistics = null
  let venue = null
  let referee = null
  let attendance = null

  if (normalizedStatus === 'FINISHED') {
    finalResult = apiMatch.final_result || {
      score: apiMatch.score || apiMatch.final_score,
      outcome: apiMatch.outcome,
      outcome_text: apiMatch.outcome_text
    }
    matchStatistics = apiMatch.match_statistics || apiMatch.statistics
    venue = apiMatch.venue
    referee = apiMatch.referee
    attendance = apiMatch.attendance
  }

  // Calculate sync priority
  let syncPriority = 'low'
  if (normalizedStatus === 'LIVE') {
    syncPriority = 'high'
  } else if (normalizedStatus === 'UPCOMING') {
    const hoursUntilKickoff = (new Date(kickoffDate).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilKickoff < 24) {
      syncPriority = 'medium'
    }
  }

  // Calculate next sync time
  let nextSyncAt: Date | null = null
  if (normalizedStatus === 'LIVE') {
    nextSyncAt = new Date(Date.now() + LIVE_SYNC_INTERVAL)
  } else if (normalizedStatus === 'UPCOMING') {
    nextSyncAt = new Date(Date.now() + UPCOMING_SYNC_INTERVAL)
  }
  // For FINISHED matches, nextSyncAt remains null (no more syncing)

  return {
    matchId,
    status: normalizedStatus,
    homeTeam,
    homeTeamId: apiMatch.home?.id || apiMatch.homeTeam?.id ? String(apiMatch.home?.id || apiMatch.homeTeam?.id) : null,
    homeTeamLogo: apiMatch.home?.logo_url || apiMatch.homeTeam?.logo || null,
    awayTeam,
    awayTeamId: apiMatch.away?.id || apiMatch.awayTeam?.id ? String(apiMatch.away?.id || apiMatch.awayTeam?.id) : null,
    awayTeamLogo: apiMatch.away?.logo_url || apiMatch.awayTeam?.logo || null,
    league,
    leagueId,
    leagueCountry: apiMatch.league?.country || null,
    leagueFlagUrl: apiMatch.league?.flagUrl || apiMatch.league?.flag || null,
    leagueFlagEmoji: apiMatch.league?.flagEmoji || null,
    kickoffDate: new Date(kickoffDate),
    matchDate: apiMatch.matchDate ? new Date(apiMatch.matchDate) : null,
    consensusOdds: consensusOdds ? {
      home: consensusOdds.home || 0,
      draw: consensusOdds.draw || 0,
      away: consensusOdds.away || 0
    } : null,
    isConsensusOdds: !!apiMatch.odds?.novig_current,
    allBookmakers: allBookmakers && Object.keys(allBookmakers).length > 0 ? allBookmakers : null,
    primaryBook,
    booksCount: booksCount > 0 ? booksCount : null,
    v1Model: v1Model ? {
      pick: v1Model.pick || null,
      confidence: v1Model.confidence || 0,
      probs: v1Model.probs || null
    } : null,
    v2Model: v2Model ? {
      pick: v2Model.pick || null,
      confidence: v2Model.confidence || 0,
      probs: v2Model.probs || null
    } : null,
    modelPredictions: (v1Model || v2Model) ? {
      free: v1Model ? {
        side: v1Model.pick,
        confidence: (v1Model.confidence || 0) * 100
      } : undefined,
      premium: v2Model ? {
        side: v2Model.pick,
        confidence: (v2Model.confidence || 0) * 100
      } : undefined
    } : null,
    currentScore: currentScore ? { home: currentScore.home || 0, away: currentScore.away || 0 } : null,
    liveScore: currentScore ? { home: currentScore.home || 0, away: currentScore.away || 0 } : null,
    elapsed,
    minute: elapsed,
    period,
    liveStatistics,
    momentum,
    modelMarkets,
    aiAnalysis,
    finalResult,
    matchStatistics,
    venue,
    referee,
    attendance,
    rawApiData: apiMatch,
    syncPriority,
    nextSyncAt,
    lastSyncedAt: new Date(),
    syncCount: { increment: 1 }
  }
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt) // Exponential backoff
        logger.warn(`Sync attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
          tags: ['market', 'sync', 'retry'],
          error: lastError,
        })
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * Sync matches by status with automatic retry
 */
async function syncMatchesByStatus(status: 'upcoming' | 'live' | 'completed') {
  try {
    logger.info(`🔄 Starting sync for ${status} matches`, {
      tags: ['market', 'sync', status],
    })

    // Fetch from API with retry logic
    const apiMatches = await retryWithBackoff(
      () => fetchMatchesFromAPI(status, 100),
      3, // Max 3 retries
      2000 // Initial delay 2 seconds
    )
    
    if (apiMatches.length === 0) {
      logger.info(`No ${status} matches found in API`, {
        tags: ['market', 'sync', status],
      })
      return { synced: 0, errors: 0, skipped: 0 }
    }

    let synced = 0
    let errors = 0
    let skipped = 0

    // Process each match
    for (const apiMatch of apiMatches) {
      try {
        const transformed = transformMatchData(apiMatch)
        
        if (!transformed) {
          skipped++
          continue
        }

        // Check if we should sync this match
        if (status === 'live') {
          // For live matches, check if last sync was more than 30 seconds ago
          const existing = await prisma.marketMatch.findUnique({
            where: { matchId: transformed.matchId },
            select: { lastSyncedAt: true, status: true }
          })

          if (existing && existing.status === 'LIVE') {
            const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
            if (timeSinceLastSync < LIVE_SYNC_INTERVAL) {
              skipped++
              continue // Skip if synced recently
            }
          }
        } else if (status === 'upcoming') {
          // For upcoming matches, check if last sync was more than 10 minutes ago
          const existing = await prisma.marketMatch.findUnique({
            where: { matchId: transformed.matchId },
            select: { lastSyncedAt: true, status: true }
          })

          if (existing && existing.status === 'UPCOMING') {
            const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
            if (timeSinceLastSync < UPCOMING_SYNC_INTERVAL) {
              skipped++
              continue // Skip if synced recently
            }
          }
        } else if (status === 'completed') {
          // For completed matches, only sync if status changed from LIVE/UPCOMING to FINISHED
          const existing = await prisma.marketMatch.findUnique({
            where: { matchId: transformed.matchId },
            select: { status: true }
          })

          if (existing && existing.status === 'FINISHED') {
            skipped++
            continue // Already finished, no need to sync again
          }
        }

        // Upsert match
        await prisma.marketMatch.upsert({
          where: { matchId: transformed.matchId },
          update: {
            ...transformed,
            syncErrors: 0, // Reset error count on successful sync
            lastSyncError: null,
          },
          create: {
            ...transformed,
            syncCount: 1,
          },
        })

        synced++
      } catch (error) {
        errors++
        logger.error(`Error syncing match ${apiMatch.id || apiMatch.match_id}`, {
          tags: ['market', 'sync', status, 'error'],
          error: error instanceof Error ? error : undefined,
        })

        // Update error count if match exists
        try {
          const matchId = String(apiMatch.id || apiMatch.match_id || '')
          if (matchId && matchId !== 'undefined' && matchId !== 'null') {
            await prisma.marketMatch.updateMany({
              where: { matchId },
              data: {
                syncErrors: { increment: 1 },
                lastSyncError: error instanceof Error ? error.message : 'Unknown error',
              },
            })
          }
        } catch (updateError) {
          // Ignore update errors
        }
      }
    }

    logger.info(`✅ Completed sync for ${status} matches`, {
      tags: ['market', 'sync', status],
      data: { synced, errors, skipped, total: apiMatches.length },
    })

    return { synced, errors, skipped }
  } catch (error) {
    logger.error(`Failed to sync ${status} matches after retries`, {
      tags: ['market', 'sync', status, 'error'],
      error: error instanceof Error ? error : undefined,
    })
    
    // Return error result instead of throwing to allow other syncs to continue
    return { synced: 0, errors: 1, skipped: 0 }
  }
}

/**
 * GET /api/admin/market/sync-scheduled - Scheduled market sync (for cron jobs)
 * 
 * Sync frequencies:
 * - Live matches: Every 30 seconds (cron runs every minute, syncs if needed)
 * - Upcoming matches: Every 10 minutes
 * - Completed matches: Only sync once when status changes to FINISHED
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('🕐 CRON: Unauthorized market sync attempt', {
        tags: ['api', 'admin', 'market', 'cron', 'security'],
        data: { hasAuthHeader: !!authHeader },
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('🕐 CRON: Starting scheduled market sync', {
      tags: ['api', 'admin', 'market', 'cron', 'sync'],
      data: { startTime: new Date(startTime).toISOString() },
    })

    // Determine which statuses to sync based on cron schedule
    // This endpoint can be called with different frequencies:
    // - Every minute: Sync live matches (if needed)
    // - Every 10 minutes: Sync upcoming matches
    const searchParams = request.nextUrl.searchParams
    const syncType = searchParams.get('type') || 'all' // 'live', 'upcoming', 'completed', or 'all'

    const results: Record<string, { synced: number; errors: number; skipped: number }> = {}

    // Sync based on type
    if (syncType === 'all' || syncType === 'live') {
      results.live = await syncMatchesByStatus('live')
    }

    if (syncType === 'all' || syncType === 'upcoming') {
      results.upcoming = await syncMatchesByStatus('upcoming')
    }

    if (syncType === 'all' || syncType === 'completed') {
      results.completed = await syncMatchesByStatus('completed')
    }

    const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0)
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0)
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0)
    const duration = Date.now() - startTime

    logger.info('🕐 CRON: Scheduled market sync completed', {
      tags: ['api', 'admin', 'market', 'cron', 'sync'],
      data: {
        results,
        totalSynced,
        totalErrors,
        totalSkipped,
        duration: `${duration}ms`,
      },
    })

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalSynced,
        totalErrors,
        totalSkipped,
        duration: `${duration}ms`,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('🕐 CRON: Market sync failed', {
      tags: ['api', 'admin', 'market', 'cron', 'sync', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { duration: `${duration}ms` },
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  }
}

