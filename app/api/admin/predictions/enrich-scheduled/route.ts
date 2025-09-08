import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// POST /api/admin/predictions/enrich-scheduled - Scheduled enrichment job
export async function POST(req: NextRequest) {
  try {
    // Verify this is a scheduled call (could add API key check here)
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting scheduled enrichment job', {
      tags: ['api', 'admin', 'predictions', 'scheduled'],
      data: { timestamp: new Date().toISOString() }
    })

    // Call the internal enrichment endpoint
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/admin/predictions/enrich-quickpurchases`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({ 
        limit: 100,
        timeWindow: 'all' // Process all pending matches
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Scheduled enrichment failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    logger.info('Scheduled enrichment completed', {
      tags: ['api', 'admin', 'predictions', 'scheduled'],
      data: {
        success: result.success,
        enrichedCount: result.data?.enrichedCount || 0,
        readyCount: result.data?.readyCount || 0,
        waitingCount: result.data?.waitingCount || 0,
        noOddsCount: result.data?.noOddsCount || 0,
        totalProcessed: result.data?.totalProcessed || 0
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Scheduled enrichment completed',
      data: result.data
    })

  } catch (error) {
    logger.error('Scheduled enrichment failed', {
      tags: ['api', 'admin', 'predictions', 'scheduled'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json({
      success: false,
      error: 'Scheduled enrichment failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
