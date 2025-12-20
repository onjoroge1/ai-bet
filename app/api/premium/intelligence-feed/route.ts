import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPremiumAccess } from '@/lib/premium-access'

/**
 * GET /api/premium/intelligence-feed
 * Get betting intelligence feed (alerts, updates, etc.)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await hasPremiumAccess()
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Premium subscription required' },
        { status: 403 }
      )
    }

    // TODO: This should fetch from backend intelligence feed API
    // For now, return mock data structure
    const feed = [
      {
        id: '1',
        type: 'warning',
        icon: 'warning',
        title: 'Sharp money detected on Napoli ML',
        description: 'Significant line movement detected. Early money suggests value.',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'info',
        icon: 'document',
        title: 'Injury update: Starting CB ruled out',
        description: 'Key defensive player confirmed out. May impact match odds.',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        type: 'opportunity',
        icon: 'trending',
        title: 'CLV opportunity: Liverpool Away',
        description: 'Strong CLV detected (+5.2%). Multiple books confirming value.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
    ]

    return NextResponse.json({
      feed,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching intelligence feed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch intelligence feed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

