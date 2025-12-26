import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/market/sync-status
 * Returns the current sync status for live, upcoming, and completed matches
 * Used by admin dashboard to display sync health indicators
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const LIVE_SYNC_INTERVAL = 30 * 1000 // 30 seconds
    const UPCOMING_SYNC_INTERVAL = 10 * 60 * 1000 // 10 minutes

    // Get latest sync times for each status
    const [liveMatches, upcomingMatches, completedMatches] = await Promise.all([
      prisma.marketMatch.findFirst({
        where: { status: 'LIVE', isActive: true },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true, syncErrors: true, syncCount: true },
      }),
      prisma.marketMatch.findFirst({
        where: { status: 'UPCOMING', isActive: true },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true, syncErrors: true, syncCount: true },
      }),
      prisma.marketMatch.findFirst({
        where: { status: 'FINISHED', isActive: true },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true, syncErrors: true, syncCount: true },
      }),
    ])

    // Get match counts
    const [liveCount, upcomingCount, completedCount] = await Promise.all([
      prisma.marketMatch.count({ where: { status: 'LIVE', isActive: true } }),
      prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true } }),
      prisma.marketMatch.count({ where: { status: 'FINISHED', isActive: true } }),
    ])

    // Calculate status for each type
    const getStatus = (
      lastSync: { lastSyncedAt: Date; syncErrors: number } | null,
      syncInterval: number,
      matchCount: number,
      matchType: 'live' | 'upcoming' | 'completed'
    ): 'healthy' | 'degraded' | 'error' => {
      // For live matches: 0 matches is NORMAL (no games live) - should be healthy if sync is recent
      // For upcoming matches: 0 matches is UNUSUAL (we should usually have upcoming matches) - could indicate an issue
      // For completed matches: 0 matches might be normal (if archived) or unusual (if not)
      
      if (matchType === 'live') {
        // Live matches: 0 matches is normal when no games are live
        if (matchCount === 0) {
          // If we have recent sync data, it's healthy (just no live matches)
          // If no sync data at all, it's an error (sync might not be working)
          if (lastSync) {
            const timeSinceLastSync = now.getTime() - lastSync.lastSyncedAt.getTime()
            // If sync was recent (< 5 minutes), it's healthy (just no live matches)
            if (timeSinceLastSync < 5 * 60 * 1000) {
              return lastSync.syncErrors > 0 ? 'degraded' : 'healthy'
            }
            // If sync is old, might indicate sync isn't running
            return 'degraded'
          }
          return 'error' // No sync data at all
        }
        
        // Have live matches - check sync freshness
        if (!lastSync) {
          return 'error'
        }
        
        const timeSinceLastSync = now.getTime() - lastSync.lastSyncedAt.getTime()
        const isStale = timeSinceLastSync > syncInterval * 2 // 2x interval = stale
        const hasErrors = lastSync.syncErrors > 0

        if (isStale || hasErrors) {
          return isStale ? 'error' : 'degraded'
        }

        // Check if sync is slightly delayed (within 1.5x interval = degraded)
        if (timeSinceLastSync > syncInterval * 1.5) {
          return 'degraded'
        }

        return 'healthy'
      }

      if (matchType === 'completed') {
        // For completed matches, they're only synced once when they finish
        // So old lastSyncedAt is normal - only check for sync errors
        if (matchCount === 0) {
          // 0 completed matches is normal if they're archived or we just started
          // Only error if we have sync errors
          return lastSync?.syncErrors > 0 ? 'degraded' : 'healthy'
        }
        
        if (!lastSync) {
          return 'error' // No sync data at all
        }
        // Only check for sync errors, not sync age (completed matches don't re-sync)
        return lastSync.syncErrors > 0 ? 'degraded' : 'healthy'
      }

      // For upcoming matches, check both sync age and errors
      if (matchCount === 0) {
        // 0 upcoming matches is unusual - we should usually have some
        // But if sync is recent, might just be a temporary gap
        if (lastSync) {
          const timeSinceLastSync = now.getTime() - lastSync.lastSyncedAt.getTime()
          if (timeSinceLastSync < UPCOMING_SYNC_INTERVAL * 2) {
            // Recent sync, just no matches - might be okay (temporary gap)
            return lastSync.syncErrors > 0 ? 'degraded' : 'degraded' // Degraded because unusual
          }
        }
        return 'error' // No matches and old/no sync data
      }

      if (!lastSync) {
        return 'error' // No sync data
      }

      const timeSinceLastSync = now.getTime() - lastSync.lastSyncedAt.getTime()
      const isStale = timeSinceLastSync > syncInterval * 2 // 2x interval = stale
      const hasErrors = lastSync.syncErrors > 0

      if (isStale || hasErrors) {
        return isStale ? 'error' : 'degraded'
      }

      // Check if sync is slightly delayed (within 1.5x interval = degraded)
      if (timeSinceLastSync > syncInterval * 1.5) {
        return 'degraded'
      }

      return 'healthy'
    }

    const liveStatus = getStatus(liveMatches, LIVE_SYNC_INTERVAL, liveCount, 'live')
    const upcomingStatus = getStatus(upcomingMatches, UPCOMING_SYNC_INTERVAL, upcomingCount, 'upcoming')
    const completedStatus = getStatus(completedMatches, UPCOMING_SYNC_INTERVAL, completedCount, 'completed') // Completed matches are never re-synced

    // Calculate time since last sync
    const getTimeSinceLastSync = (lastSync: { lastSyncedAt: Date } | null): string => {
      if (!lastSync) return 'Never'
      const seconds = Math.floor((now.getTime() - lastSync.lastSyncedAt.getTime()) / 1000)
      if (seconds < 60) return `${seconds}s ago`
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
      return `${Math.floor(seconds / 3600)}h ago`
    }

    return NextResponse.json({
      success: true,
      status: {
        live: {
          status: liveStatus,
          lastSyncedAt: liveMatches?.lastSyncedAt || null,
          timeSinceLastSync: getTimeSinceLastSync(liveMatches),
          matchCount: liveCount,
          syncErrors: liveMatches?.syncErrors || 0,
          syncCount: liveMatches?.syncCount || 0,
        },
        upcoming: {
          status: upcomingStatus,
          lastSyncedAt: upcomingMatches?.lastSyncedAt || null,
          timeSinceLastSync: getTimeSinceLastSync(upcomingMatches),
          matchCount: upcomingCount,
          syncErrors: upcomingMatches?.syncErrors || 0,
          syncCount: upcomingMatches?.syncCount || 0,
        },
        completed: {
          status: completedStatus,
          lastSyncedAt: completedMatches?.lastSyncedAt || null,
          timeSinceLastSync: getTimeSinceLastSync(completedMatches),
          matchCount: completedCount,
          syncErrors: completedMatches?.syncErrors || 0,
          syncCount: completedMatches?.syncCount || 0,
        },
      },
      overall: {
        // Overall status only considers live and upcoming (completed matches don't affect overall health)
        status: liveStatus === 'error' || upcomingStatus === 'error' 
          ? 'error' 
          : liveStatus === 'degraded' || upcomingStatus === 'degraded' 
          ? 'degraded' 
          : 'healthy',
        lastCheckedAt: now,
      },
    })
  } catch (error) {
    logger.error('Failed to get sync status', {
      tags: ['api', 'admin', 'market', 'sync-status', 'error'],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

