import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

const SPORTS = ['basketball_nba', 'icehockey_nhl', 'basketball_ncaab']
const SYNC_INTERVAL = 10 * 60 * 1000 // 10 minutes
const PREDICT_DELAY = 300 // 300ms between prediction calls to avoid rate limiting

export const maxDuration = 120
export const runtime = 'nodejs'

/**
 * Fetch finished results for a sport from backend
 * Uses GET /predict-multisport/results?sport={sport}&days={days}
 */
async function fetchSportResults(sport: string, days: number = 7, limit: number = 25) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s — results endpoint is slow

  try {
    const response = await fetch(
      `${BASE_URL}/predict-multisport/results?sport=${sport}&days=${days}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
        signal: controller.signal,
        cache: 'no-store',
      }
    )
    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        // Endpoint not deployed yet — silently skip
        return []
      }
      throw new Error(`Results API error: ${response.status}`)
    }

    const raw = await response.json()
    const results = raw.matches || raw.results || []

    return results.map((m: any) => ({
      eventId: m.event_id,
      sport,
      status: 'finished',
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      commenceTime: m.commence_time,
      finalResult: m.final_result || m.result || null,
      model: m.model || m.prediction || null,
      odds: m.odds || null,
    }))
  } catch (error) {
    clearTimeout(timeoutId)
    logger.warn(`[Multisport Sync] Failed to fetch results for ${sport}`, {
      tags: ['multisport', 'sync', 'results'],
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

/**
 * Fetch market data for a sport from backend
 */
async function fetchSportMarket(sport: string, status: string, limit: number = 30) {
  // Finished data now comes from /predict-multisport/results endpoint
  if (status === 'finished') {
    return { matches: [], sport, total_count: 0 }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(
      `${BASE_URL}/predict-multisport/available?sport=${sport}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
        signal: controller.signal,
        cache: 'no-store',
      }
    )
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const raw = await response.json()
    // Transform /predict-multisport/available response to match expected format
    const fixtures = (raw.fixtures || []).slice(0, limit)
    const matches = fixtures.map((f: any) => ({
      event_id: f.event_id,
      status: 'upcoming',
      commence_time: f.commence_time,
      league: { name: f.league_name || sport, sport_key: sport },
      home: { name: f.home_team, team_id: null },
      away: { name: f.away_team, team_id: null },
      odds: {
        consensus: {
          home_prob: f.home_prob,
          away_prob: f.away_prob,
          home_spread: f.spread,
          total_line: f.total_line,
        },
      },
      model: {
        predictions: {
          home_win: f.home_prob,
          away_win: f.away_prob,
          pick: f.model_pick,
          confidence: f.model_confidence,
        },
        source: 'v3_multisport',
        no_draw: true,
      },
    }))

    return { matches, sport, total_count: raw.count || matches.length }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Fetch prediction for a single event
 */
async function fetchPrediction(sportKey: string, eventId: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(`${BASE_URL}/predict-multisport`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sport: sportKey, event_id: eventId }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) return null

    return await response.json()
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

/**
 * Transform API match to MultisportMatch format
 */
function transformMatch(match: any, sport: string) {
  const eventId = String(match.event_id || '')
  if (!eventId) return null

  return {
    eventId,
    sport,
    status: match.status || 'upcoming',
    homeTeam: match.home?.name || 'Home',
    awayTeam: match.away?.name || 'Away',
    homeTeamId: match.home?.team_id || null,
    awayTeamId: match.away?.team_id || null,
    league: match.league?.name || sport,
    commenceTime: new Date(match.commence_time),
    odds: match.odds || null,
    spread: match.spread || null,
    totalLine: match.odds?.consensus ? {
      total: match.odds.consensus.total_line,
      over_odds: match.odds.consensus.over_odds,
      under_odds: match.odds.consensus.under_odds,
    } : null,
    model: match.model || null,
    finalResult: match.final_result || null,
    lastSyncedAt: new Date(),
  }
}

/**
 * POST /api/admin/multisport/sync
 *
 * Syncs market data for all multisport leagues, then runs predictions
 * on matches that don't have prediction data yet.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth check - cron secret or admin session
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'
    const isCron = authHeader === `Bearer ${cronSecret}`

    if (!isCron) {
      // Check admin session — must pass authOptions or session is always null
      const { getServerSession } = await import('next-auth')
      const { authOptions } = await import('@/lib/auth')
      const session = await getServerSession(authOptions)
      if (!session?.user || (session.user as any).role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!BASE_URL) {
      return NextResponse.json({ error: 'Backend API not configured' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const sports = body.sports || SPORTS
    const runPredictions = body.predictions !== false // default true
    const force = body.force === true

    const results: Record<string, { synced: number; predicted: number; skipped: number; errors: number }> = {}

    for (const sport of sports) {
      const sportResult = { synced: 0, predicted: 0, skipped: 0, errors: 0 }

      try {
        // Fetch upcoming matches and finished results
        const daysLookback = sport.includes('nhl') ? 30 : sport.includes('ncaab') ? 14 : 7
        const [upcomingData, resultsData] = await Promise.allSettled([
          fetchSportMarket(sport, 'upcoming', 30),
          fetchSportResults(sport, daysLookback, 25),
        ])

        const allMatches: { match: any; status: string }[] = []

        if (upcomingData.status === 'fulfilled' && upcomingData.value?.matches) {
          for (const m of upcomingData.value.matches) {
            allMatches.push({ match: m, status: 'upcoming' })
          }
        }

        // Process finished results — upsert directly since they have different shape
        let resultsStored = 0
        if (resultsData.status === 'fulfilled' && Array.isArray(resultsData.value)) {
          for (const result of resultsData.value) {
            if (!result.eventId) continue
            try {
              await prisma.multisportMatch.upsert({
                where: { eventId_sport: { eventId: result.eventId, sport } },
                update: {
                  status: 'finished',
                  finalResult: result.finalResult,
                  lastSyncedAt: new Date(),
                  syncCount: { increment: 1 },
                },
                create: {
                  eventId: result.eventId,
                  sport,
                  status: 'finished',
                  homeTeam: result.homeTeam || 'Unknown',
                  awayTeam: result.awayTeam || 'Unknown',
                  league: sport,
                  commenceTime: result.commenceTime ? new Date(result.commenceTime) : new Date(),
                  finalResult: result.finalResult,
                  model: result.model,
                  odds: result.odds,
                  lastSyncedAt: new Date(),
                },
              })
              resultsStored++
            } catch (err) {
              logger.warn(`[Multisport Sync] Failed to store result for ${result.eventId}`, {
                tags: ['multisport', 'sync', 'results'],
                error: err instanceof Error ? err.message : String(err),
              })
            }
          }
          if (resultsStored > 0) {
            logger.info(`[Multisport Sync] Stored ${resultsStored} finished results for ${sport}`, {
              tags: ['multisport', 'sync', 'results'],
            })
          }
          sportResult.synced += resultsStored
        }

        if (allMatches.length === 0) {
          results[sport] = sportResult
          continue
        }

        // Transform matches
        const transformed = allMatches
          .map(({ match }) => transformMatch(match, sport))
          .filter((m): m is NonNullable<typeof m> => m !== null)

        // Batch pre-fetch existing records
        const eventIds = transformed.map(m => m.eventId)
        const existing = await prisma.multisportMatch.findMany({
          where: { eventId: { in: eventIds }, sport },
          select: { eventId: true, lastSyncedAt: true, predictionFetchedAt: true }
        })
        const existingMap = new Map(existing.map(m => [m.eventId, m]))

        // Filter out recently synced (unless forced)
        const toSync = force
          ? transformed
          : transformed.filter(m => {
              const ex = existingMap.get(m.eventId)
              if (!ex) return true
              return Date.now() - ex.lastSyncedAt.getTime() > SYNC_INTERVAL
            })

        // Batch upsert with transaction
        if (toSync.length > 0) {
          const BATCH_SIZE = 20
          for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
            const batch = toSync.slice(i, i + BATCH_SIZE)
            try {
              await prisma.$transaction(
                batch.map(m =>
                  prisma.multisportMatch.upsert({
                    where: { eventId_sport: { eventId: m.eventId, sport: m.sport } },
                    update: { ...m, syncCount: { increment: 1 } },
                    create: { ...m, syncCount: 1 },
                  })
                ),
                { timeout: 30000 }
              )
              sportResult.synced += batch.length
            } catch {
              // Fall back to individual upserts
              for (const m of batch) {
                try {
                  await prisma.multisportMatch.upsert({
                    where: { eventId_sport: { eventId: m.eventId, sport: m.sport } },
                    update: { ...m, syncCount: { increment: 1 } },
                    create: { ...m, syncCount: 1 },
                  })
                  sportResult.synced++
                } catch {
                  sportResult.errors++
                }
              }
            }
          }
        }

        // Run predictions on upcoming matches without prediction data
        if (runPredictions) {
          const needPrediction = transformed.filter(m => {
            if (m.status !== 'upcoming') return false
            const ex = existingMap.get(m.eventId)
            if (!ex) return true // New match, needs prediction
            if (!ex.predictionFetchedAt) return true // Never fetched
            // Refetch if prediction is older than 6 hours
            return Date.now() - ex.predictionFetchedAt.getTime() > 6 * 60 * 60 * 1000
          })

          for (const match of needPrediction) {
            try {
              const prediction = await fetchPrediction(sport, match.eventId)
              if (prediction && !prediction.error) {
                await prisma.multisportMatch.update({
                  where: { eventId_sport: { eventId: match.eventId, sport } },
                  data: {
                    predictionData: prediction,
                    predictionFetchedAt: new Date(),
                    teamContext: prediction.team_context || null,
                    modelInfo: prediction.model_info || null,
                  },
                })
                sportResult.predicted++
              }
              // Rate limit
              await new Promise(r => setTimeout(r, PREDICT_DELAY))
            } catch {
              sportResult.errors++
            }
          }
        }
      } catch (error) {
        sportResult.errors++
        logger.error(`Multisport sync failed for ${sport}`, {
          tags: ['multisport', 'sync', sport],
          error: error instanceof Error ? error : undefined,
        })
      }

      results[sport] = sportResult
    }

    const duration = Date.now() - startTime
    const totalSynced = Object.values(results).reduce((s, r) => s + r.synced, 0)
    const totalPredicted = Object.values(results).reduce((s, r) => s + r.predicted, 0)

    logger.info('Multisport sync completed', {
      tags: ['multisport', 'sync'],
      data: { results, duration: `${duration}ms` },
    })

    return NextResponse.json({
      success: true,
      results,
      summary: { totalSynced, totalPredicted, duration: `${duration}ms` },
    })
  } catch (error) {
    logger.error('Multisport sync failed', {
      tags: ['multisport', 'sync', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/multisport/sync - Cron-triggered multisport sync
 * Vercel Cron uses GET requests. Delegates to the same sync logic as POST.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create a synthetic POST request body with default params
  const syntheticRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ sports: SPORTS, predictions: true, force: false }),
  })

  return POST(syntheticRequest)
}
