import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/clv/opportunities - Fetch CLV opportunities from backend
 * Query params: window (optional) - e.g., T-72to48, T-48to24, T-24to2
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const window = searchParams.get('window')

    // Build backend URL
    const backendUrl = new URL(`${process.env.BACKEND_URL}/clv/club/opportunities`)
    if (window) {
      backendUrl.searchParams.append('window', window)
    }

    logger.info('Fetching CLV opportunities', {
      tags: ['api', 'clv', 'opportunities'],
      data: { 
        userId: session.user.id,
        window: window || 'all',
        backendUrl: backendUrl.toString()
      }
    })

    // Fetch from backend
    const response = await fetch(backendUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend CLV API error', {
        tags: ['api', 'clv', 'opportunities'],
        data: { 
          status: response.status, 
          error: errorText 
        }
      })
      throw new Error(`Backend responded with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // Backend returns 'items' instead of 'opportunities'
    // Normalize the response to match our frontend expectations
    const normalizedData = {
      opportunities: data.items || data.opportunities || [],
      meta: {
        count: data.count || (data.items?.length || 0),
        window: window || 'all',
        generated_at: data.timestamp || new Date().toISOString(),
        status: data.status
      }
    }

    logger.info('CLV opportunities fetched successfully', {
      tags: ['api', 'clv', 'opportunities'],
      data: { 
        opportunitiesCount: normalizedData.opportunities.length,
        window: window || 'all',
        backendCount: data.count,
        backendStatus: data.status
      }
    })

    return NextResponse.json(normalizedData)

  } catch (error) {
    logger.error('Failed to fetch CLV opportunities', {
      tags: ['api', 'clv', 'opportunities'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { 
        error: 'Failed to fetch CLV opportunities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

