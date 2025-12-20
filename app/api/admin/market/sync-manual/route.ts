import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

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
    rawApiData: apiMatch,
    syncPriority,
    nextSyncAt,
    lastSyncedAt: new Date(),
    syncCount: { increment: 1 }
  }
}

/**
 * Sync matches by status (manual sync - forces sync regardless of last sync time)
 */
async function syncMatchesByStatus(status: 'upcoming' | 'live' | 'completed', force: boolean = false) {
  try {
    logger.info(`🔄 Starting manual sync for ${status} matches`, {
      tags: ['market', 'sync', status, 'manual'],
    })

    const apiMatches = await fetchMatchesFromAPI(status, 100)
    
    if (apiMatches.length === 0) {
      logger.info(`No ${status} matches found in API`, {
        tags: ['market', 'sync', status, 'manual'],
      })
      return { synced: 0, errors: 0, skipped: 0 }
    }

    let synced = 0
    let errors = 0
    let skipped = 0

    for (const apiMatch of apiMatches) {
      try {
        const transformed = transformMatchData(apiMatch)
        
        if (!transformed) {
          skipped++
          continue
        }

        // For manual sync, we can force update or respect smart sync logic
        if (!force) {
          // Use smart sync logic (skip if recently synced)
          if (status === 'live') {
            const existing = await prisma.marketMatch.findUnique({
              where: { matchId: transformed.matchId },
              select: { lastSyncedAt: true, status: true }
            })

            if (existing && existing.status === 'LIVE') {
              const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
              if (timeSinceLastSync < LIVE_SYNC_INTERVAL) {
                skipped++
                continue
              }
            }
          } else if (status === 'upcoming') {
            const existing = await prisma.marketMatch.findUnique({
              where: { matchId: transformed.matchId },
              select: { lastSyncedAt: true, status: true }
            })

            if (existing && existing.status === 'UPCOMING') {
              const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
              if (timeSinceLastSync < UPCOMING_SYNC_INTERVAL) {
                skipped++
                continue
              }
            }
          } else if (status === 'completed') {
            const existing = await prisma.marketMatch.findUnique({
              where: { matchId: transformed.matchId },
              select: { status: true }
            })

            if (existing && existing.status === 'FINISHED') {
              skipped++
              continue
            }
          }
        }

        // Upsert match
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

    logger.info(`✅ Completed manual sync for ${status} matches`, {
      tags: ['market', 'sync', status, 'manual'],
      data: { synced, errors, skipped, total: apiMatches.length, force },
    })

    return { synced, errors, skipped }
  } catch (error) {
    logger.error(`Failed to sync ${status} matches`, {
      tags: ['market', 'sync', status, 'error', 'manual'],
      error: error instanceof Error ? error : undefined,
    })
    throw error
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

    const results: Record<string, { synced: number; errors: number; skipped: number }> = {}

    if (syncType === 'all' || syncType === 'live') {
      results.live = await syncMatchesByStatus('live', forceSync)
    }

    if (syncType === 'all' || syncType === 'upcoming') {
      results.upcoming = await syncMatchesByStatus('upcoming', forceSync)
    }

    if (syncType === 'all' || syncType === 'completed') {
      results.completed = await syncMatchesByStatus('completed', forceSync)
    }

    const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0)
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0)
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0)
    const duration = Date.now() - startTime

    logger.info('✅ Admin: Manual market sync completed', {
      tags: ['api', 'admin', 'market', 'sync', 'manual'],
      data: {
        userId: session.user.id,
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

