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
      matchCount: number
    ): 'healthy' | 'degraded' | 'error' => {
      if (!lastSync || matchCount === 0) {
        return 'error' // No matches or no sync data
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

    const liveStatus = getStatus(liveMatches, LIVE_SYNC_INTERVAL, liveCount)
    const upcomingStatus = getStatus(upcomingMatches, UPCOMING_SYNC_INTERVAL, upcomingCount)
    const completedStatus = getStatus(completedMatches, UPCOMING_SYNC_INTERVAL, completedCount) // Completed uses same interval

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

