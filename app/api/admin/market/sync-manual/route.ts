import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { retryWithBackoff } from '@/lib/retry-utils'

// Configure timeout for long-running syncs
export const maxDuration = 300 // 5 minutes for Vercel Enterprise (allows processing large batches)
export const runtime = 'nodejs'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

const LIVE_SYNC_INTERVAL = 30 * 1000 // 30 seconds in milliseconds
const UPCOMING_SYNC_INTERVAL = 10 * 60 * 1000 // 10 minutes in milliseconds

/**
 * Fetch matches from external API with adaptive timeout
 */
async function fetchMatchesFromAPI(status: 'upcoming' | 'live' | 'completed', limit: number = 100) {
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
  
  // Adaptive timeout: base + per-match scaling
  // Smaller limits get shorter timeouts (they should be faster)
  // Live matches: faster timeout (they're smaller/lite mode)
  // Upcoming/Completed: longer timeout (more data)
  // For very small batches (≤10), use aggressive timeouts since API should respond quickly
  const baseTimeout = status === 'live' ? 10000 : 15000 // 10s for live, 15s for others (reduced for faster failure)
  const perMatchTimeout = status === 'live' ? 300 : 400 // 300ms per live match, 400ms per other
  const maxTimeout = limit <= 10 ? 12000 : 45000 // Very small batches: 12s max, larger: 45s max
  const EXTERNAL_API_TIMEOUT = Math.min(baseTimeout + (limit * perMatchTimeout), maxTimeout)
  
  logger.debug(`[Sync Manual] Fetching ${status} matches with ${EXTERNAL_API_TIMEOUT}ms timeout`, {
    tags: ['market', 'sync', 'manual'],
    data: { status, limit, timeout: EXTERNAL_API_TIMEOUT, url }
  })
  
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
    const matches = data.matches || data.data?.matches || data || []
    
    logger.debug(`API returned ${matches.length} ${status} matches`, {
      tags: ['market', 'sync', 'manual'],
      data: { 
        status, 
        limit, 
        matchCount: matches.length,
        hasMatches: Array.isArray(matches) ? matches.length > 0 : false,
        responseKeys: Object.keys(data || {})
      }
    })
    
    return Array.isArray(matches) ? matches : []
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(`[Sync Manual] External API timeout after ${EXTERNAL_API_TIMEOUT}ms: ${url}`, {
        tags: ['market', 'sync', 'manual', 'timeout'],
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

  const homeTeam = apiMatch.home?.name || apiMatch.homeTeam?.name || apiMatch.home_name || 'Home Team'
  const awayTeam = apiMatch.away?.name || apiMatch.awayTeam?.name || apiMatch.away_name || 'Away Team'
  const league = apiMatch.league?.name || apiMatch.leagueName || 'Unknown League'
  const leagueId = apiMatch.league?.id ? String(apiMatch.league.id) : null
  const kickoffDate = apiMatch.kickoff_at || apiMatch.kickoff_utc || apiMatch.matchDate || new Date()

  const status = apiMatch.status?.toUpperCase() || 'UPCOMING'
  const normalizedStatus = status === 'LIVE' ? 'LIVE' : status === 'FINISHED' || status === 'COMPLETED' ? 'FINISHED' : 'UPCOMING'

  const consensusOdds = apiMatch.odds?.novig_current || apiMatch.odds?.consensus
  const allBookmakers = apiMatch.odds?.books || {}
  const booksCount = allBookmakers && typeof allBookmakers === 'object' ? Object.keys(allBookmakers).length : 0
  const primaryBook = Object.keys(allBookmakers || {})[0] || null

  const v1Model = apiMatch.models?.v1_consensus || apiMatch.predictions?.v1
  const v2Model = apiMatch.models?.v2_lightgbm || apiMatch.predictions?.v2

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
      
      console.log(`[Sync Manual] Extracted finalResult for match ${matchId}:`, {
        score: finalResult.score,
        outcome: finalResult.outcome,
        source: scoreFromFinalResult ? 'final_result.score' :
                scoreFromScore ? 'score' :
                scoreFromFinalScore ? 'final_score' :
                scoreFromLiveData ? 'live_data.current_score' :
                'currentScore'
      })
    } else {
      console.warn(`[Sync Manual] No valid score found for FINISHED match ${matchId}`, {
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

  let syncPriority = 'low'
  if (normalizedStatus === 'LIVE') {
    syncPriority = 'high'
  } else if (normalizedStatus === 'UPCOMING') {
    const hoursUntilKickoff = (new Date(kickoffDate).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilKickoff < 24) {
      syncPriority = 'medium'
    }
  }

  let nextSyncAt: Date | null = null
  if (normalizedStatus === 'LIVE') {
    nextSyncAt = new Date(Date.now() + LIVE_SYNC_INTERVAL)
  } else if (normalizedStatus === 'UPCOMING') {
    nextSyncAt = new Date(Date.now() + UPCOMING_SYNC_INTERVAL)
  }

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
 * Fetch matches with progressive fallback (try smaller limits if large limit fails)
 */
async function fetchMatchesWithFallback(status: 'upcoming' | 'live' | 'completed'): Promise<any[]> {
  // Progressive limits: try larger first, fallback to smaller if timeout
  // For live matches, start smaller since API is consistently slow
  const limits = status === 'live' 
    ? [25, 10, 5] // Live: start with 25, fallback to 10, then 5 (smaller batches for faster failure)
    : [50, 25, 10] // Upcoming/Completed: start with 50, fallback to 25, then 10
  
  const maxRetries = status === 'live' ? 1 : 2 // Fewer retries for fallback attempts
  const initialDelay = 1000
  const maxDelay = 10000

  for (let i = 0; i < limits.length; i++) {
    const limit = limits[i]
    const isLastAttempt = i === limits.length - 1
    
    try {
      logger.info(`Attempting to fetch ${status} matches with limit=${limit}`, {
        tags: ['market', 'sync', status, 'manual', 'fallback'],
        data: { limit, attempt: i + 1, totalAttempts: limits.length }
      })

      const matches = await retryWithBackoff(
        () => fetchMatchesFromAPI(status, limit),
        isLastAttempt ? maxRetries : 1, // Only retry on last attempt
        initialDelay,
        maxDelay
      )

      if (matches.length > 0) {
        logger.info(`Successfully fetched ${matches.length} ${status} matches with limit=${limit}`, {
          tags: ['market', 'sync', status, 'manual', 'fallback'],
          data: { limit, matchCount: matches.length }
        })
        return matches
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.warn(`Failed to fetch ${status} matches with limit=${limit}`, {
        tags: ['market', 'sync', status, 'manual', 'fallback'],
        data: { limit, attempt: i + 1, error: errorMessage },
        error: error instanceof Error ? error : undefined
      })

      // If this is the last attempt, throw the error
      if (isLastAttempt) {
        throw error
      }
      
      // Otherwise, try next smaller limit
      logger.info(`Falling back to smaller limit for ${status} matches`, {
        tags: ['market', 'sync', status, 'manual', 'fallback'],
        data: { currentLimit: limit, nextLimit: limits[i + 1] }
      })
    }
  }

  // Should never reach here, but return empty array as fallback
  return []
}

/**
 * Sync matches by status (manual sync - forces sync regardless of last sync time)
 */
async function syncMatchesByStatus(status: 'upcoming' | 'live' | 'completed', force: boolean = false) {
  let apiMatches: any[] = []
  let synced = 0
  let errors = 0
  let skipped = 0

  try {
    logger.info(`🔄 Starting manual sync for ${status} matches`, {
      tags: ['market', 'sync', status, 'manual'],
    })

    // Fetch from API with progressive fallback (try smaller limits if large limit fails)
    apiMatches = await fetchMatchesWithFallback(status)
    
    if (apiMatches.length === 0) {
      logger.warn(`No ${status} matches found in API after all fallback attempts`, {
        tags: ['market', 'sync', status, 'manual'],
        data: { 
          status,
          note: 'This could indicate the external API is down or all limits timed out'
        }
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
          
          logger.info(`Updated lastSyncedAt for ${updatedCount.count} existing ${status} matches (API returned 0 matches)`, {
            tags: ['market', 'sync', status, 'manual'],
            data: { 
              status,
              updatedCount: updatedCount.count,
              note: 'Updated timestamps to reflect successful sync attempt, even though API returned no matches'
            }
          })
        } catch (updateError) {
          logger.error(`Failed to update lastSyncedAt for existing ${status} matches`, {
            tags: ['market', 'sync', status, 'manual', 'error'],
            error: updateError instanceof Error ? updateError : undefined,
          })
        }
      }
      
      return { synced: 0, errors: 0, skipped: 0 }
    }

    // Batch process matches for better performance
    // Process in chunks to avoid overwhelming the database
    const BATCH_SIZE = 10 // Keep small to reduce lock contention
    const batches = []
    for (let i = 0; i < apiMatches.length; i += BATCH_SIZE) {
      batches.push(apiMatches.slice(i, i + BATCH_SIZE))
    }

    logger.info(`Processing ${apiMatches.length} matches in ${batches.length} batches`, {
      tags: ['market', 'sync', status, 'manual'],
      data: { totalMatches: apiMatches.length, batchSize: BATCH_SIZE, batchCount: batches.length }
    })

    // Pre-fetch existing matches for smart sync check (batch query)
    const matchIds = apiMatches
      .map(m => String(m.id || m.match_id || m.matchId || ''))
      .filter(id => id && id !== 'undefined' && id !== 'null')
    
    const existingMatches = await prisma.marketMatch.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, lastSyncedAt: true, status: true }
    })
    
    const existingMatchesMap = new Map(
      existingMatches.map(m => [m.matchId, m])
    )

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const batchStartTime = Date.now()
      
      logger.debug(`Processing batch ${batchIndex + 1}/${batches.length}`, {
        tags: ['market', 'sync', status, 'manual'],
        data: { batchIndex: batchIndex + 1, batchSize: batch.length, totalBatches: batches.length }
      })

      // Process batch with transaction for atomicity
      try {
        await prisma.$transaction(
          async (tx) => {
            for (const apiMatch of batch) {
              try {
                const transformed = transformMatchData(apiMatch)
                
                if (!transformed) {
                  skipped++
                  continue
                }

                const existing = existingMatchesMap.get(transformed.matchId)

                // For manual sync, we can force update or respect smart sync logic
                if (!force && existing) {
                  // Use smart sync logic (skip if recently synced)
                  if (status === 'live' && existing.status === 'LIVE') {
                    const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
                    if (timeSinceLastSync < LIVE_SYNC_INTERVAL) {
                      skipped++
                      continue
                    }
                  } else if (status === 'upcoming' && existing.status === 'UPCOMING') {
                    const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
                    if (timeSinceLastSync < UPCOMING_SYNC_INTERVAL) {
                      skipped++
                      continue
                    }
                  } else if (status === 'completed' && existing.status === 'FINISHED') {
                    skipped++
                    continue
                  }
                }

                // Upsert match within transaction
                await tx.marketMatch.upsert({
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
                  tags: ['market', 'sync', status, 'error', 'manual'],
                  error: error instanceof Error ? error : undefined,
                })
                // Continue processing other matches in batch
              }
            }
          },
          {
            timeout: 15000, // 15 second timeout — fail fast
          }
        )

        const batchDuration = Date.now() - batchStartTime
        logger.debug(`Batch ${batchIndex + 1} completed in ${batchDuration}ms`, {
          tags: ['market', 'sync', status, 'manual'],
          data: { batchIndex: batchIndex + 1, duration: batchDuration, progress: `${batchIndex + 1}/${batches.length}` }
        })
      } catch (batchError) {
        // If batch transaction fails, process matches individually
        logger.warn(`Batch ${batchIndex + 1} transaction failed, processing individually`, {
          tags: ['market', 'sync', status, 'manual', 'fallback'],
          error: batchError instanceof Error ? batchError : undefined,
        })

        for (const apiMatch of batch) {
          try {
            const transformed = transformMatchData(apiMatch)
            
            if (!transformed) {
              skipped++
              continue
            }

            const existing = existingMatchesMap.get(transformed.matchId)

            if (!force && existing) {
              if (status === 'live' && existing.status === 'LIVE') {
                const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
                if (timeSinceLastSync < LIVE_SYNC_INTERVAL) {
                  skipped++
                  continue
                }
              } else if (status === 'upcoming' && existing.status === 'UPCOMING') {
                const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
                if (timeSinceLastSync < UPCOMING_SYNC_INTERVAL) {
                  skipped++
                  continue
                }
              } else if (status === 'completed' && existing.status === 'FINISHED') {
                skipped++
                continue
              }
            }

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
              tags: ['market', 'sync', status, 'error', 'manual'],
              error: error instanceof Error ? error : undefined,
            })
          }
        }
      }
    }

    logger.info(`✅ Completed manual sync for ${status} matches`, {
      tags: ['market', 'sync', status, 'manual'],
      data: { synced, errors, skipped, total: apiMatches.length, force },
    })

    return { synced, errors, skipped }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // If we got some matches but failed to process them, return partial success
    // This allows the UI to show progress instead of complete failure
    if (apiMatches && apiMatches.length > 0) {
      logger.warn(`Partial sync failure for ${status} matches - some matches may have been processed`, {
        tags: ['market', 'sync', status, 'error', 'manual', 'partial'],
        error: error instanceof Error ? error : undefined,
        data: { 
          totalMatches: apiMatches.length,
          note: 'Some matches may have been synced before the error occurred'
        }
      })
      
      // Return partial results instead of throwing
      return { 
        synced: synced || 0, 
        errors: errors || apiMatches.length, 
        skipped: skipped || 0,
        partial: true,
        error: errorMessage
      }
    }
    
    logger.error(`Failed to sync ${status} matches - no matches fetched from API`, {
      tags: ['market', 'sync', status, 'error', 'manual'],
      error: error instanceof Error ? error : undefined,
      data: { 
        errorMessage,
        note: 'External API may be down or timing out. Consider checking API health.'
      }
    })
    
    // Even when all API attempts fail, update lastSyncedAt to show we attempted a sync
    // This prevents the sync status from showing "318 hours ago" - it will show "just now" with error status
    // Only do this for live and upcoming (completed matches don't need re-sync)
    if (status === 'live' || status === 'upcoming') {
      try {
        const updatedCount = await prisma.marketMatch.updateMany({
          where: { 
            status: status === 'live' ? 'LIVE' : 'UPCOMING',
            isActive: true
          },
          data: {
            lastSyncedAt: new Date(), // Update timestamp to show we tried
            syncErrors: { increment: 1 }, // Increment error count (sync failed)
            lastSyncError: errorMessage // Store error message
          }
        })
        
        logger.info(`Updated lastSyncedAt for ${updatedCount.count} existing ${status} matches (sync failed but timestamp updated)`, {
          tags: ['market', 'sync', status, 'manual', 'error'],
          data: { 
            status,
            updatedCount: updatedCount.count,
            error: errorMessage,
            note: 'Timestamp updated to reflect sync attempt, even though it failed'
          }
        })
      } catch (updateError) {
        logger.error(`Failed to update lastSyncedAt for existing ${status} matches after sync failure`, {
          tags: ['market', 'sync', status, 'manual', 'error'],
          error: updateError instanceof Error ? updateError : undefined,
        })
      }
    }
    
    // Return error result instead of throwing to allow other syncs to continue
    return { 
      synced: 0, 
      errors: 1, 
      skipped: 0,
      error: errorMessage
    }
  }
}

/**
 * POST /api/admin/market/sync-manual - Manual market sync (for admin UI)
 * 
 * Requires admin authentication via session
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      logger.warn('Manual market sync: Unauthorized (no session)', {
        tags: ['api', 'admin', 'market', 'sync', 'manual', 'security'],
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      logger.warn('Manual market sync: Forbidden (not admin)', {
        tags: ['api', 'admin', 'market', 'sync', 'manual', 'security'],
        data: { userId: session.user.id, role: session.user.role },
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { type, force } = body

    const syncType = type || 'all' // 'live', 'upcoming', 'completed', or 'all'
    const forceSync = force === true // Force sync even if recently synced

    logger.info('🔄 Admin: Starting manual market sync', {
      tags: ['api', 'admin', 'market', 'sync', 'manual'],
      data: { 
        userId: session.user.id,
        email: session.user.email,
        syncType,
        force: forceSync,
        startTime: new Date(startTime).toISOString(),
      },
    })

    const results: Record<string, { synced: number; errors: number; skipped: number; partial?: boolean; error?: string }> = {}
    const errors: string[] = []

    if (syncType === 'all' || syncType === 'live') {
      try {
        results.live = await syncMatchesByStatus('live', forceSync)
        if (results.live.error) {
          errors.push(`Live matches: ${results.live.error}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.live = { synced: 0, errors: 1, skipped: 0, error: errorMessage }
        errors.push(`Live matches: ${errorMessage}`)
      }
    }

    if (syncType === 'all' || syncType === 'upcoming') {
      try {
        results.upcoming = await syncMatchesByStatus('upcoming', forceSync)
        if (results.upcoming.error) {
          errors.push(`Upcoming matches: ${results.upcoming.error}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.upcoming = { synced: 0, errors: 1, skipped: 0, error: errorMessage }
        errors.push(`Upcoming matches: ${errorMessage}`)
      }
    }

    if (syncType === 'all' || syncType === 'completed') {
      try {
        results.completed = await syncMatchesByStatus('completed', forceSync)
        if (results.completed.error) {
          errors.push(`Completed matches: ${results.completed.error}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.completed = { synced: 0, errors: 1, skipped: 0, error: errorMessage }
        errors.push(`Completed matches: ${errorMessage}`)
      }
    }

    const totalSynced = Object.values(results).reduce((sum, r) => sum + (r.synced || 0), 0)
    const totalErrors = Object.values(results).reduce((sum, r) => sum + (r.errors || 0), 0)
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + (r.skipped || 0), 0)
    const hasPartialSuccess = Object.values(results).some(r => r.partial === true)
    const duration = Date.now() - startTime

    // Determine overall success
    const success = totalSynced > 0 || (totalErrors === 0 && totalSkipped === 0)
    const statusCode = success ? 200 : (hasPartialSuccess ? 207 : 500) // 207 = Multi-Status (partial success)

    logger.info(`${success ? '✅' : '⚠️'} Admin: Manual market sync ${success ? 'completed' : 'completed with errors'}`, {
      tags: ['api', 'admin', 'market', 'sync', 'manual'],
      data: {
        userId: session.user.id,
        results,
        totalSynced,
        totalErrors,
        totalSkipped,
        hasPartialSuccess,
        duration: `${duration}ms`,
        errors: errors.length > 0 ? errors : undefined,
      },
    })

    return NextResponse.json(
      {
        success,
        results,
        summary: {
          totalSynced,
          totalErrors,
          totalSkipped,
          hasPartialSuccess,
          duration: `${duration}ms`,
        },
        ...(errors.length > 0 && { errors }),
        ...(hasPartialSuccess && { 
          message: 'Sync completed with partial success. Some matches may not have been synced due to API timeouts.' 
        }),
      },
      { status: statusCode }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('❌ Admin: Manual market sync failed', {
      tags: ['api', 'admin', 'market', 'sync', 'manual', 'error'],
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

