import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET|POST /api/admin/clv/sync-scheduled
 *
 * Cron job: Fetches CLV opportunities from the backend and caches them in
 * the CLVOpportunityCache table so the dashboard can read from DB rather than
 * hitting the external API on every page load.
 *
 * Runs every 30 minutes (see vercel.json).
 */
async function handleRequest() {
  const windows = ['all', 'T-72to48', 'T-48to24', 'T-24to2']
  const results: Record<string, number> = {}

  const backendUrl = process.env.BACKEND_URL
  const backendApiKey = process.env.BACKEND_API_KEY

  if (!backendUrl || !backendApiKey) {
    logger.warn('[clv/sync-scheduled] BACKEND_URL or BACKEND_API_KEY not set — skipping CLV sync', {
      tags: ['cron', 'clv'],
    })
    return { skipped: true, reason: 'Missing backend credentials' }
  }

  // Clear entries older than 2 hours before populating fresh ones
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  await prisma.cLVOpportunityCache.deleteMany({
    where: { cachedAt: { lt: twoHoursAgo } },
  })

  for (const window of windows) {
    try {
      const url = new URL(`${backendUrl}/clv/club/opportunities`)
      if (window !== 'all') url.searchParams.append('window', window)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${backendApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        logger.warn(`[clv/sync-scheduled] Backend returned ${response.status} for window ${window}`, {
          tags: ['cron', 'clv'],
        })
        results[window] = 0
        continue
      }

      const data = await response.json()
      const opportunities: Array<Record<string, unknown>> = data.items || data.opportunities || []

      if (opportunities.length > 0) {
        await prisma.cLVOpportunityCache.createMany({
          data: opportunities.map((opp) => ({
            matchId: opp.match_id?.toString() ?? null,
            homeTeam: (opp.home_team as string) ?? null,
            awayTeam: (opp.away_team as string) ?? null,
            league: (opp.league as string) ?? 'Unknown',
            matchDate: opp.match_date ? new Date(opp.match_date as string) : new Date(),
            marketType: (opp.market_type as string) ?? '1X2',
            selection: (opp.selection as string) ?? '',
            entryOdds: Number(opp.entry_odds ?? opp.best_odds ?? 0),
            closeOdds: Number(opp.close_odds ?? opp.market_composite_odds ?? 0),
            entryTime: opp.entry_time ? new Date(opp.entry_time as string) : new Date(),
            bookmaker: (opp.bookmaker as string) ?? null,
            timeBucket: (opp.time_bucket as string) ?? null,
            windowFilter: window,
            cachedAt: new Date(),
          })),
          skipDuplicates: true,
        })
      }

      results[window] = opportunities.length

      logger.info(`[clv/sync-scheduled] Cached ${opportunities.length} opportunities for window=${window}`, {
        tags: ['cron', 'clv'],
      })
    } catch (_err) {
      logger.error(`[clv/sync-scheduled] Failed to sync window ${window}`, {
        tags: ['cron', 'clv'],
        data: { error: _err instanceof Error ? _err.message : 'Unknown' },
      })
      results[window] = 0
    }
  }

  return { success: true, results }
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.CRON_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await handleRequest()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.CRON_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await handleRequest()
  return NextResponse.json(result)
}

