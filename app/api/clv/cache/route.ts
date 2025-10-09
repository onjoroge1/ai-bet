import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * POST /api/clv/cache - Cache CLV opportunities in database
 * This endpoint is called periodically to cache CLV data for low-bandwidth users
 */
export async function POST(req: NextRequest) {
  try {
    // This endpoint can be called by a cron job or admin action
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    const { window } = await req.json().catch(() => ({ window: 'all' }))

    // Fetch from backend
    const backendUrl = new URL(`${process.env.BACKEND_URL}/clv/club/opportunities`)
    if (window && window !== 'all') {
      backendUrl.searchParams.append('window', window)
    }

    const response = await fetch(backendUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`)
    }

    const data = await response.json()
    const opportunities = data.items || data.opportunities || []

    // Store in database
    // First, clear old cached data (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    await prisma.cLVOpportunityCache.deleteMany({
      where: {
        cachedAt: {
          lt: oneHourAgo
        }
      }
    })

    // Store new opportunities
    if (opportunities.length > 0) {
      await prisma.cLVOpportunityCache.createMany({
        data: opportunities.map((opp: any) => ({
          matchId: opp.match_id?.toString() || null,
          homeTeam: opp.home_team,
          awayTeam: opp.away_team,
          league: opp.league,
          matchDate: new Date(opp.match_date),
          marketType: opp.market_type,
          selection: opp.selection,
          entryOdds: opp.entry_odds,
          closeOdds: opp.close_odds,
          entryTime: new Date(opp.entry_time),
          bookmaker: opp.bookmaker,
          timeBucket: opp.time_bucket,
          windowFilter: window || 'all',
          cachedAt: new Date()
        })),
        skipDuplicates: true
      })
    }

    logger.info('CLV opportunities cached successfully', {
      tags: ['api', 'clv', 'cache'],
      data: {
        opportunitiesCached: opportunities.length,
        window: window || 'all'
      }
    })

    return NextResponse.json({
      success: true,
      cached: opportunities.length,
      window: window || 'all',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to cache CLV opportunities', {
      tags: ['api', 'clv', 'cache'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { 
        error: 'Failed to cache opportunities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/clv/cache - Get cached CLV opportunities
 * Returns cached data for low-bandwidth users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const window = searchParams.get('window') || 'all'
    const useCache = searchParams.get('useCache') === 'true'

    if (!useCache) {
      return NextResponse.json({
        success: false,
        message: 'Cache not requested'
      })
    }

    // Get cached opportunities (max 1 hour old)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    const cached = await prisma.cLVOpportunityCache.findMany({
      where: {
        cachedAt: {
          gte: oneHourAgo
        },
        windowFilter: window
      },
      orderBy: {
        matchDate: 'asc'
      }
    })

    const opportunities = cached.map(c => ({
      match_id: parseInt(c.matchId || '0'),
      home_team: c.homeTeam,
      away_team: c.awayTeam,
      league: c.league,
      match_date: c.matchDate.toISOString(),
      market_type: c.marketType,
      selection: c.selection,
      entry_odds: c.entryOdds,
      close_odds: c.closeOdds,
      entry_time: c.entryTime.toISOString(),
      bookmaker: c.bookmaker,
      time_bucket: c.timeBucket
    }))

    logger.info('Served cached CLV opportunities', {
      tags: ['api', 'clv', 'cache'],
      data: {
        opportunitiesCount: opportunities.length,
        window,
        oldestCache: cached[0]?.cachedAt
      }
    })

    return NextResponse.json({
      opportunities,
      meta: {
        count: opportunities.length,
        window,
        generated_at: cached[0]?.cachedAt?.toISOString() || new Date().toISOString(),
        cached: true
      }
    })

  } catch (error) {
    logger.error('Failed to get cached opportunities', {
      tags: ['api', 'clv', 'cache'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { 
        error: 'Failed to get cached opportunities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

