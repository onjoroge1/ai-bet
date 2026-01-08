import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncAdditionalMarketsForUpcomingMatches } from '@/lib/market/sync-additional-markets'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/additional-markets/sync-manual - Manual sync endpoint (for admin UI)
 * Requires admin authentication via session
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      logger.warn('Manual additional markets sync: Unauthorized (no session)', {
        tags: ['api', 'admin', 'additional-markets', 'sync', 'manual', 'security'],
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      logger.warn('Manual additional markets sync: Forbidden (not admin)', {
        tags: ['api', 'admin', 'additional-markets', 'sync', 'manual', 'security'],
        data: { userId: session.user.id, role: session.user.role },
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    logger.info('🔄 Admin: Starting manual additional markets sync', {
      tags: ['api', 'admin', 'additional-markets', 'sync', 'manual'],
      data: {
        userId: session.user.id,
        email: session.user.email,
        startTime: new Date(startTime).toISOString(),
      },
    })

    const result = await syncAdditionalMarketsForUpcomingMatches()

    const duration = Date.now() - startTime

    logger.info('✅ Admin: Completed manual additional markets sync', {
      tags: ['api', 'admin', 'additional-markets', 'sync', 'manual'],
      data: {
        userId: session.user.id,
        ...result,
        durationMs: duration,
      },
    })

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: duration,
    })
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error('❌ Admin: Failed manual additional markets sync', {
      tags: ['api', 'admin', 'additional-markets', 'sync', 'manual', 'error'],
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration,
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}

