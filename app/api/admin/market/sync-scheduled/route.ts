import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { retryWithBackoff } from '@/lib/retry-utils'

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

// Adaptive backoff: track consecutive failures per status to avoid hammering a failing backend
const consecutiveFailures: Record<string, number> = {}

function getAdaptiveLimit(status: string, baseLimit: number): number {
  const failures = consecutiveFailures[status] || 0
  if (failures >= 3) return Math.max(10, Math.floor(baseLimit / 4))
  if (failures >= 2) return Math.max(10, Math.floor(baseLimit / 2))
  return baseLimit
}

/**
 * Fetch matches from external API with timeout
 */
async function fetchMatchesFromAPI(status: 'upcoming' | 'live' | 'completed', limit: number = 50) {
  if (!BASE_URL) {
    throw new Error('BACKEND_API_URL not configured')
  }

  // Map 'completed' to 'finished' for API compatibility
  const apiStatus = status === 'completed' ? 'finished' : status
  
  // Use lite mode for live matches (fast sync), full mode for others (complete data)
  const useLiteMode = status === 'live'
  const url = useLiteMode
    ? `${BASE_URL}/market?status=${apiStatus}&mode=lite&limit=${limit}`
    : `${BASE_URL}/market?status=${apiStatus}&limit=${limit}&include_v2=false`
  
  // Add timeout to prevent hanging. Live is small and fast; upcoming/completed pulls
  // a large batch (up to 250) and the backend builds predictions on the fly, which can
  // take ~30s in full mode. Scale the timeout with the limit to avoid false aborts.
  const EXTERNAL_API_TIMEOUT = status === 'live'
    ? 15000                                       // live: fast/small
    : Math.min(30000 + limit * 300, 90000)        // upcoming/completed: 30s base + 300ms/match, capped at 90s
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, EXTERNAL_API_TIMEOUT)

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data.matches || []
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(`[Sync Scheduled] External API timeout after ${EXTERNAL_API_TIMEOUT}ms: ${url}`, {
        tags: ['market', 'sync', 'scheduled', 'timeout'],
        data: { status, limit, url },
      })
      throw new Error(`External API timeout - request took too long (>${EXTERNAL_API_TIMEOUT}ms)`)
    }
    
    throw error
  }
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

  // Extract live data / score (for LIVE and FINISHED matches)
  let currentScore = apiMatch.score || apiMatch.live_data?.current_score || null
  let elapsed = null
  let period = null
  let liveStatistics = null
  let momentum = null
  let modelMarkets = null
  let aiAnalysis = null

  if (normalizedStatus === 'LIVE') {
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
    // Try multiple sources for final score
    const scoreFromFinalResult = apiMatch.final_result?.score
    const scoreFromScore = apiMatch.score
    const scoreFromFinalScore = apiMatch.final_score
    const scoreFromLiveData = apiMatch.live_data?.current_score
    const scoreFromCurrentScore = currentScore // Already extracted above
    
    // Determine the actual final score
    const finalScore = scoreFromFinalResult || 
                       scoreFromScore || 
                       scoreFromFinalScore || 
                       scoreFromLiveData ||
                       scoreFromCurrentScore
    
    // Only create finalResult if we have a valid score
    if (finalScore && (finalScore.home !== undefined || finalScore.away !== undefined)) {
      finalResult = apiMatch.final_result || {
        score: {
          home: finalScore.home ?? 0,
          away: finalScore.away ?? 0
        },
        outcome: apiMatch.outcome || 
                 (finalScore.home > finalScore.away ? 'home' : 
                  finalScore.away > finalScore.home ? 'away' : 'draw'),
        outcome_text: apiMatch.outcome_text ||
                     (finalScore.home > finalScore.away ? 'Home Win' : 
                      finalScore.away > finalScore.home ? 'Away Win' : 'Draw')
      }
      
      console.log(`[Sync] Extracted finalResult for match ${matchId}:`, {
        score: finalResult.score,
        outcome: finalResult.outcome,
        source: scoreFromFinalResult ? 'final_result.score' :
                scoreFromScore ? 'score' :
                scoreFromFinalScore ? 'final_score' :
                scoreFromLiveData ? 'live_data.current_score' :
                'currentScore'
      })
    } else {
      console.warn(`[Sync] No valid score found for FINISHED match ${matchId}`, {
        hasFinalResult: !!apiMatch.final_result,
        hasScore: !!apiMatch.score,
        hasFinalScore: !!apiMatch.final_score,
        hasLiveData: !!apiMatch.live_data,
        hasCurrentScore: !!currentScore
      })
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
    syncPriority,
    nextSyncAt,
    lastSyncedAt: new Date(),
    syncCount: { increment: 1 }
  }
}

/**
 * Sync matches by status with automatic retry
 */
async function syncMatchesByStatus(status: 'upcoming' | 'live' | 'completed') {
  try {
    logger.info(`🔄 Starting sync for ${status} matches`, {
      tags: ['market', 'sync', status],
    })

    // Adaptive limit based on consecutive failure count.
    // Live matches stay small (always fast, never many at once).
    // Upcoming/completed pull a much larger batch so we don't miss fixtures
    // when a league publishes its next round (backend reports ~130+ upcoming).
    const baseLimit = status === 'live' ? 50 : 250
    const limit = getAdaptiveLimit(status, baseLimit)

    // Fetch from API with retry logic (3 retries, 2s initial delay, 30s max delay cap)
    let apiMatches: any[]
    try {
      apiMatches = await retryWithBackoff(
        () => fetchMatchesFromAPI(status, limit),
        3,    // Max 3 retries
        2000, // Initial delay 2 seconds
        30000 // Maximum delay cap 30 seconds
      )
      // Reset failure counter on successful fetch
      consecutiveFailures[status] = 0
    } catch (fetchError) {
      consecutiveFailures[status] = (consecutiveFailures[status] || 0) + 1
      logger.warn(`Sync fetch failed for ${status} (consecutive failures: ${consecutiveFailures[status]}, next limit: ${getAdaptiveLimit(status, baseLimit)})`, {
        tags: ['market', 'sync', status, 'backoff'],
      })
      throw fetchError
    }
    
    if (apiMatches.length === 0) {
      logger.info(`No ${status} matches found in API`, {
        tags: ['market', 'sync', status],
      })
      
      // Even if API returns 0 matches, update lastSyncedAt for existing matches
      // This prevents the sync status from showing "Error" due to stale timestamps
      // Only do this for live and upcoming (completed matches don't need re-sync)
      if (status === 'live' || status === 'upcoming') {
        try {
          const updatedCount = await prisma.marketMatch.updateMany({
            where: { 
              status: status === 'live' ? 'LIVE' : 'UPCOMING',
              isActive: true
            },
            data: {
              lastSyncedAt: new Date(),
              syncErrors: 0, // Reset errors since we successfully checked
              lastSyncError: null
            }
          })
          
          logger.debug(`Updated lastSyncedAt for ${updatedCount.count} existing ${status} matches (API returned 0 matches)`, {
            tags: ['market', 'sync', status],
            data: { 
              status,
              updatedCount: updatedCount.count,
              note: 'Updated timestamps to reflect successful sync attempt, even though API returned no matches'
            }
          })
        } catch (updateError) {
          logger.error(`Failed to update lastSyncedAt for existing ${status} matches`, {
            tags: ['market', 'sync', status, 'error'],
            error: updateError instanceof Error ? updateError : undefined,
          })
        }
      }
      
      return { synced: 0, errors: 0, skipped: 0 }
    }

    let synced = 0
    let errors = 0
    let skipped = 0

    // Transform all matches first
    const transformedMatches: { apiMatch: any; transformed: NonNullable<ReturnType<typeof transformMatchData>> }[] = []
    for (const apiMatch of apiMatches) {
      const transformed = transformMatchData(apiMatch)
      if (transformed) {
        transformedMatches.push({ apiMatch, transformed })
      } else {
        skipped++
      }
    }

    // Batch pre-fetch existing matches (single query instead of N queries)
    const matchIds = transformedMatches.map(m => m.transformed.matchId)
    const existingMatches = await prisma.marketMatch.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, lastSyncedAt: true, status: true, finalResult: true, currentScore: true }
    })
    const existingMap = new Map(existingMatches.map(m => [m.matchId, m]))

    // Filter matches that need syncing using the pre-fetched map
    const matchesToSync: typeof transformedMatches = []
    for (const { apiMatch, transformed } of transformedMatches) {
      const existing = existingMap.get(transformed.matchId)

      if (status === 'live') {
        if (existing && existing.status === 'LIVE') {
          const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
          if (timeSinceLastSync < LIVE_SYNC_INTERVAL) {
            skipped++
            continue
          }
        }
      } else if (status === 'upcoming') {
        if (existing && existing.status === 'UPCOMING') {
          const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
          if (timeSinceLastSync < UPCOMING_SYNC_INTERVAL) {
            skipped++
            continue
          }
        }
      } else if (status === 'completed') {
        if (existing && existing.status === 'FINISHED') {
          const fr = existing.finalResult as Record<string, unknown> | null
          const hasFinalResult = fr && typeof fr === 'object' && Object.keys(fr).length > 0
          if (hasFinalResult) {
            skipped++
            continue
          }
          // Missing finalResult — try to derive from existing DB currentScore
          if (!transformed.finalResult) {
            const dbScore = existing.currentScore as { home?: number; away?: number } | null
            if (dbScore && typeof dbScore.home === 'number' && typeof dbScore.away === 'number') {
              transformed.finalResult = {
                score: { home: dbScore.home, away: dbScore.away },
                outcome: dbScore.home > dbScore.away ? 'home' : dbScore.away > dbScore.home ? 'away' : 'draw',
                outcome_text: dbScore.home > dbScore.away ? 'Home Win' : dbScore.away > dbScore.home ? 'Away Win' : 'Draw',
              }
              console.log(`[Sync] Derived finalResult from DB currentScore for ${transformed.matchId}`)
            }
          }
        }
      }

      matchesToSync.push({ apiMatch, transformed })
    }

    // Process in batches with transactions
    const BATCH_SIZE = 10 // Keep small to reduce lock contention
    for (let i = 0; i < matchesToSync.length; i += BATCH_SIZE) {
      const batch = matchesToSync.slice(i, i + BATCH_SIZE)

      try {
        await prisma.$transaction(
          batch.map(({ transformed }) =>
            prisma.marketMatch.upsert({
              where: { matchId: transformed.matchId },
              update: {
                ...transformed,
                syncErrors: 0,
                lastSyncError: null,
              },
              create: {
                ...transformed,
                syncCount: 1,
              },
            })
          ),
          { timeout: 15000 }
        )
        synced += batch.length
      } catch (batchError) {
        // Fall back to individual upserts if batch transaction fails
        logger.warn(`Batch transaction failed for ${status}, falling back to individual upserts`, {
          tags: ['market', 'sync', status, 'batch-fallback'],
          error: batchError instanceof Error ? batchError : undefined,
        })

        for (const { apiMatch, transformed } of batch) {
          try {
            await prisma.marketMatch.upsert({
              where: { matchId: transformed.matchId },
              update: {
                ...transformed,
                syncErrors: 0,
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

