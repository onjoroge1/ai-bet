import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * GET/POST /api/admin/parlays/sync-backend-scheduled - Cron job endpoint for syncing parlays from backend APIs
 * 
 * This endpoint is called by Vercel Cron to automatically sync parlays from backend V1/V2 APIs.
 * It uses CRON_SECRET for authentication instead of user sessions.
 * 
 * Schedule: Configured in vercel.json (recommended: every 15-30 minutes)
 * 
 * What it does:
 * - Calls POST /api/parlays to sync parlays from backend V1/V2 APIs
 * - Stores parlays in ParlayConsensus table
 * - Creates ParlayLeg records for each parlay
 * - Filters by UPCOMING matches when displaying
 */

export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      logger.error('CRON_SECRET not configured', {
        tags: ['api', 'admin', 'parlays', 'cron', 'sync-backend']
      })
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron job attempt for backend parlay sync', {
        tags: ['api', 'admin', 'parlays', 'cron', 'sync-backend']
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('🕐 CRON: Starting scheduled parlay sync from backend APIs (V1/V2)', {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync-backend']
    })

    // Call the POST /api/parlays endpoint with CRON_SECRET
    const isProduction = process.env.VERCEL === '1'
    const baseUrl = isProduction 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    const syncUrl = `${baseUrl}/api/parlays`
    
    logger.info('🕐 CRON: Calling parlay sync endpoint', {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync-backend'],
      data: { syncUrl, isProduction }
    })

    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`, // Use cron secret for authentication
      },
      body: JSON.stringify({ version: 'both' }), // Sync both V1 and V2
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('🕐 CRON: Failed to sync parlays from backend APIs', {
        tags: ['api', 'admin', 'parlays', 'cron', 'sync-backend'],
        data: { status: response.status, error: errorText }
      })
      return NextResponse.json(
        { error: 'Failed to sync parlays', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    logger.info('🕐 CRON: Completed syncing parlays from backend APIs', {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync-backend'],
      data: result
    })

    return NextResponse.json({
      success: true,
      message: `Synced ${result.totals?.synced || 0} parlays from backend APIs (${result.totals?.errors || 0} errors)`,
      ...result
    })
  } catch (error) {
    logger.error('🕐 CRON: Error in scheduled backend parlay sync', {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync-backend'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to sync parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

