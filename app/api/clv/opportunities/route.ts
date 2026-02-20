import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * GET /api/clv/opportunities - DB-first CLV opportunities
 * 
 * Strategy: Check DB cache first → if stale, fetch backend & auto-cache → return
 * This eliminates recurring backend calls and provides fast responses.
 * 
 * Query params: 
 *   window (optional) - e.g., T-72to48, T-48to24, T-24to2
 *   limit (optional) - max results
 *   force_refresh (optional) - bypass cache
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check premium access (admins bypass)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionPlan: true, subscriptionExpiresAt: true, role: true },
    })

    const isAdmin = user?.role === 'admin'
    const isPremiumPlan = user?.subscriptionPlan && 
      (user.subscriptionPlan.toLowerCase().includes('premium') ||
       user.subscriptionPlan.toLowerCase().includes('monthly') ||
       user.subscriptionPlan.toLowerCase().includes('vip'))
    const isNotExpired = user?.subscriptionExpiresAt && 
      new Date(user.subscriptionExpiresAt) > new Date()
    const hasAccess = isAdmin || (isPremiumPlan && isNotExpired)

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Premium subscription required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const windowFilter = searchParams.get('window') || 'all'
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : undefined
    const forceRefresh = searchParams.get('force_refresh') === 'true'

    // ── Step 1: Try DB cache first ──────────────────────────────────────
    if (!forceRefresh) {
      const cacheThreshold = new Date(Date.now() - CACHE_TTL_MS)
      
      const cached = await prisma.cLVOpportunityCache.findMany({
        where: {
          cachedAt: { gte: cacheThreshold },
          windowFilter,
        },
        orderBy: { matchDate: 'asc' },
      })

      if (cached.length > 0) {
        let opportunities = cached.map(c => ({
          match_id: parseInt(c.matchId || '0'),
          home_team: c.homeTeam,
          away_team: c.awayTeam,
          league: c.league,
          match_date: c.matchDate.toISOString(),
          market_type: c.marketType,
          selection: c.selection,
          entry_odds: Number(c.entryOdds),
          close_odds: Number(c.closeOdds),
          entry_time: c.entryTime.toISOString(),
          bookmaker: c.bookmaker,
          time_bucket: c.timeBucket,
        }))

        if (limit && opportunities.length > limit) {
          opportunities = opportunities.slice(0, limit)
        }

        logger.info('CLV opportunities served from DB cache', {
          tags: ['api', 'clv', 'cache-hit'],
          data: {
            count: opportunities.length,
            window: windowFilter,
            cacheAge: `${Math.round((Date.now() - cached[0].cachedAt.getTime()) / 1000)}s`,
          },
        })

        return NextResponse.json({
          opportunities,
          meta: {
            count: opportunities.length,
            window: windowFilter,
            generated_at: cached[0].cachedAt.toISOString(),
            cached: true,
            cache_age_seconds: Math.round((Date.now() - cached[0].cachedAt.getTime()) / 1000),
          },
        })
      }
    }

    // ── Step 2: Fetch from backend ──────────────────────────────────────
    const backendUrl = new URL(`${process.env.BACKEND_URL}/clv/club/opportunities`)
    if (windowFilter && windowFilter !== 'all') {
      backendUrl.searchParams.append('window', windowFilter)
    }

    logger.info('CLV cache miss — fetching from backend', {
      tags: ['api', 'clv', 'cache-miss'],
      data: {
        userId: session.user.id,
        window: windowFilter,
        forceRefresh,
      },
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(backendUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend CLV API error', {
        tags: ['api', 'clv', 'backend-error'],
        data: { status: response.status, error: errorText },
      })
      throw new Error(`Backend responded with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    let opportunities = data.items || data.opportunities || []

    // ── Step 3: Auto-cache in DB ────────────────────────────────────────
    if (opportunities.length > 0) {
      try {
        // Clear old cache for this window
        await prisma.cLVOpportunityCache.deleteMany({
          where: { windowFilter },
        })

        // Store fresh data
        await prisma.cLVOpportunityCache.createMany({
          data: opportunities.map((opp: any) => ({
            matchId: opp.match_id?.toString() || null,
            homeTeam: opp.home_team || 'Unknown',
            awayTeam: opp.away_team || 'Unknown',
            league: opp.league || 'Unknown',
            matchDate: new Date(opp.match_date),
            marketType: opp.market_type || 'unknown',
            selection: opp.selection || 'unknown',
            entryOdds: opp.entry_odds || 0,
            closeOdds: opp.close_odds || 0,
            entryTime: new Date(opp.entry_time),
            bookmaker: opp.bookmaker || 'unknown',
            timeBucket: opp.time_bucket || 'unknown',
            windowFilter,
            cachedAt: new Date(),
          })),
          skipDuplicates: true,
        })

        logger.info('CLV opportunities auto-cached in DB', {
          tags: ['api', 'clv', 'auto-cache'],
          data: { cached: opportunities.length, window: windowFilter },
        })
      } catch (cacheError) {
        // Non-blocking: if caching fails, still return data
        logger.warn('Failed to auto-cache CLV opportunities', {
          tags: ['api', 'clv', 'auto-cache', 'error'],
          data: { error: cacheError instanceof Error ? cacheError.message : 'Unknown' },
        })
      }
    }

    // ── Step 4: Return response ─────────────────────────────────────────
    if (limit && opportunities.length > limit) {
      opportunities = opportunities.slice(0, limit)
    }

    return NextResponse.json({
      opportunities,
      meta: {
        count: opportunities.length,
        window: windowFilter,
        generated_at: data.timestamp || new Date().toISOString(),
        cached: false,
        status: data.status,
      },
    })
  } catch (error) {
    // ── Fallback: try stale cache on backend failure ──────────────────
    try {
      const { searchParams } = new URL(req.url)
      const windowFilter = searchParams.get('window') || 'all'

      const staleCache = await prisma.cLVOpportunityCache.findMany({
        where: { windowFilter },
        orderBy: { matchDate: 'asc' },
      })

      if (staleCache.length > 0) {
        const opportunities = staleCache.map(c => ({
          match_id: parseInt(c.matchId || '0'),
          home_team: c.homeTeam,
          away_team: c.awayTeam,
          league: c.league,
          match_date: c.matchDate.toISOString(),
          market_type: c.marketType,
          selection: c.selection,
          entry_odds: Number(c.entryOdds),
          close_odds: Number(c.closeOdds),
          entry_time: c.entryTime.toISOString(),
          bookmaker: c.bookmaker,
          time_bucket: c.timeBucket,
        }))

        logger.warn('Serving stale CLV cache after backend failure', {
          tags: ['api', 'clv', 'stale-cache'],
          data: {
            count: opportunities.length,
            cacheAge: `${Math.round((Date.now() - staleCache[0].cachedAt.getTime()) / 1000)}s`,
          },
        })

        return NextResponse.json({
          opportunities,
          meta: {
            count: opportunities.length,
            window: windowFilter,
            generated_at: staleCache[0].cachedAt.toISOString(),
            cached: true,
            stale: true,
          },
        })
      }
    } catch {
      // Double failure — return error
    }

    logger.error('Failed to fetch CLV opportunities (no cache fallback)', {
      tags: ['api', 'clv', 'error'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' },
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch CLV opportunities',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
