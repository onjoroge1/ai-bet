import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

// POST /api/admin/predictions/trigger-consensus - Trigger consensus for specific matches
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { matchIds } = await req.json()

    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return NextResponse.json({ error: 'matchIds array is required' }, { status: 400 })
    }

    logger.info('Triggering consensus for matches', {
      tags: ['api', 'admin', 'predictions', 'consensus'],
      data: { matchIds: matchIds.slice(0, 10) } // Log first 10 for brevity
    })

    // Call the backend availability API with trigger_consensus: true
    const response = await fetch(`${process.env.BACKEND_URL}/predict/availability`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        match_ids: matchIds,
        trigger_consensus: true,
        staleness_hours: 168
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Backend responded with status ${response.status}: ${errorText}`)
    }

    const result = await response.json()

    logger.info('Consensus trigger completed', {
      tags: ['api', 'admin', 'predictions', 'consensus'],
      data: {
        requestedCount: matchIds.length,
        readyCount: result.meta?.ready_count || 0,
        notReadyCount: result.meta?.not_ready_count || 0,
        processingMs: result.meta?.processing_ms || 0
      }
    })

    return NextResponse.json({
      success: true,
      message: `Triggered consensus for ${matchIds.length} matches`,
      data: {
        requestedCount: matchIds.length,
        readyCount: result.meta?.ready_count || 0,
        notReadyCount: result.meta?.not_ready_count || 0,
        breakdown: result.meta?.breakdown || {},
        processingMs: result.meta?.processing_ms || 0
      }
    })

  } catch (error) {
    logger.error('Failed to trigger consensus', {
      tags: ['api', 'admin', 'predictions', 'consensus'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    return NextResponse.json({ 
      error: 'Failed to trigger consensus', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
