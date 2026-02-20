import { NextRequest, NextResponse } from 'next/server'
import { syncAdditionalMarketsForUpcomingMatches } from '@/lib/market/sync-additional-markets'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/additional-markets/sync-scheduled - Cron job endpoint (Vercel crons use GET)
 */
export async function GET(req: NextRequest) {
  return handleRequest(req)
}

/**
 * POST /api/admin/additional-markets/sync-scheduled - Manual trigger endpoint
 * Uses CRON_SECRET for authentication
 */
export async function POST(req: NextRequest) {
  return handleRequest(req)
}

async function handleRequest(req: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      logger.error('CRON_SECRET not configured', {
        tags: ['api', 'admin', 'additional-markets', 'cron', 'error'],
      })
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Invalid CRON_SECRET in additional markets sync request', {
        tags: ['api', 'admin', 'additional-markets', 'cron', 'security'],
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('🔄 Starting scheduled additional markets sync', {
      tags: ['api', 'admin', 'additional-markets', 'cron'],
    })

    const result = await syncAdditionalMarketsForUpcomingMatches()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    logger.error('❌ Failed to sync additional markets in cron job', {
      tags: ['api', 'admin', 'additional-markets', 'cron', 'error'],
      error: error instanceof Error ? error.message : String(error),
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

