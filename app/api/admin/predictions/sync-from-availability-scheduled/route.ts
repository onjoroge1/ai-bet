import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/predictions/sync-from-availability-scheduled - Scheduled global match sync (for cron jobs)
 * 
 * This endpoint is called by Vercel Cron to automatically sync matches.
 * It uses CRON_SECRET for authentication instead of user sessions.
 * 
 * Schedule: Every 2 hours (recommended frequency)
 * - Frequent enough to keep data fresh
 * - Not too frequent to avoid API rate limits
 * - Balances between discovery and enrichment
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('🕐 CRON: Unauthorized global sync attempt', {
        tags: ['api', 'admin', 'global-sync', 'cron', 'security'],
        data: { hasAuthHeader: !!authHeader },
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('🕐 CRON: Starting scheduled global match sync', {
      tags: ['api', 'admin', 'global-sync', 'cron', 'sync'],
      data: { startTime: new Date(startTime).toISOString() },
    })

    // Call the main sync endpoint internally
    // In production (Vercel), we can use the internal URL
    // In local dev, we'll use localhost
    const isProduction = process.env.VERCEL === '1'
    const baseUrl = isProduction 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    const syncUrl = `${baseUrl}/api/admin/predictions/sync-from-availability`
    
    logger.info('🕐 CRON: Calling global sync endpoint', {
      tags: ['api', 'admin', 'global-sync', 'cron'],
      data: { 
        syncUrl,
        isProduction,
        baseUrl
      }
    })

    // Make internal request to sync endpoint with CRON_SECRET
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`, // Use cron secret for authentication
        'X-Internal-Cron': 'true', // Internal cron flag
      },
      body: JSON.stringify({
        // Use default date range (last 5 days)
        timeWindow: 'recent'
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('🕐 CRON: Global sync endpoint returned error', {
        tags: ['api', 'admin', 'global-sync', 'cron', 'error'],
        data: {
          status: response.status,
          errorText: errorText.substring(0, 500)
        }
      })
      throw new Error(`Global sync failed: ${response.status} - ${errorText.substring(0, 200)}`)
    }

    const result = await response.json()
    const duration = Date.now() - startTime

    logger.info('🕐 CRON: Scheduled global match sync completed', {
      tags: ['api', 'admin', 'global-sync', 'cron', 'sync'],
      data: {
        result: result.summary,
        duration: `${duration}ms`,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Scheduled global sync completed',
      result: result.summary,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('🕐 CRON: Global sync failed', {
      tags: ['api', 'admin', 'global-sync', 'cron', 'sync', 'error'],
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

