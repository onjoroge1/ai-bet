import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

// Data freshness thresholds
const UPCOMING_MAX_AGE = 10 * 60 * 1000 // 10 minutes
const FINISHED_MAX_AGE = 60 * 60 * 1000 // 1 hour (finished data rarely changes)

export const maxDuration = 30
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sport = searchParams.get('sport') || 'basketball_nba'
  const status = searchParams.get('status') || 'upcoming'
  const limit = parseInt(searchParams.get('limit') || '25', 10)
  const eventId = searchParams.get('event_id')

  try {
    // Try database first
    const maxAge = status === 'finished' ? FINISHED_MAX_AGE : UPCOMING_MAX_AGE
    const freshnessThreshold = new Date(Date.now() - maxAge)

    // Check if we have fresh data in DB
    const dbMatches = await prisma.multisportMatch.findMany({
      where: {
        sport,
        status,
        ...(eventId ? { eventId } : {}),
        lastSyncedAt: { gte: freshnessThreshold },
      },
      orderBy: { commenceTime: status === 'finished' ? 'desc' : 'asc' },
      take: limit,
    })

    if (dbMatches.length > 0) {
      // Serve from database
      const matches = dbMatches.map(m => ({
        event_id: m.eventId,
        status: m.status,
        commence_time: m.commenceTime.toISOString(),
        league: { name: m.league, sport_key: m.sport },
        home: { name: m.homeTeam, team_id: m.homeTeamId },
        away: { name: m.awayTeam, team_id: m.awayTeamId },
        odds: m.odds,
        spread: m.spread,
        model: m.model,
        final_result: m.finalResult,
      }))

      const cacheControl = status === 'finished'
        ? 'public, s-maxage=3600, stale-while-revalidate=7200'
        : 'public, s-maxage=60, stale-while-revalidate=120'

      return NextResponse.json(
        {
          sport,
          sport_name: getSportName(sport),
          matches,
          total_count: matches.length,
          source: 'database',
        },
        { headers: { 'Cache-Control': cacheControl } }
      )
    }

    // Fall back to backend API
    if (!BASE_URL) {
      return NextResponse.json(
        { error: 'Backend API not configured', matches: [], total_count: 0 },
        { status: 500 }
      )
    }

    // Backend uses /predict-multisport/available for fixture listings
    const url = `${BASE_URL}/predict-multisport/available?sport=${sport}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error')
      throw new Error(`Backend error: ${response.status} - ${text}`)
    }

    const raw = await response.json()

    // Transform /predict-multisport/available response to match expected format
    const fixtures = raw.fixtures || []
    const matches = fixtures
      .slice(0, limit)
      .map((f: any) => ({
        event_id: f.event_id,
        status: 'upcoming',
        commence_time: f.commence_time,
        league: { name: f.league_name || getSportName(sport), sport_key: sport },
        home: { name: f.home_team, team_id: null },
        away: { name: f.away_team, team_id: null },
        odds: {
          consensus: {
            home_odds: null,
            away_odds: null,
            home_prob: f.home_prob,
            away_prob: f.away_prob,
            home_spread: f.spread,
            total_line: f.total_line,
            n_bookmakers: null,
          },
        },
        spread: { line: f.spread, total: f.total_line },
        model: {
          predictions: {
            home_win: f.home_prob,
            away_win: f.away_prob,
            pick: f.model_pick,
            confidence: f.model_confidence,
            conviction_tier: f.model_confidence > 0.75 ? 'premium' : f.model_confidence > 0.6 ? 'strong' : 'standard',
          },
          source: 'v3_multisport',
          no_draw: true,
        },
        final_result: null,
      }))

    // Filter by status — /predict-multisport/available only returns upcoming
    // For finished, we can only serve from DB
    if (status === 'finished') {
      return NextResponse.json(
        { sport, sport_name: getSportName(sport), matches: [], total_count: 0, source: 'api' },
        { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
      )
    }

    const data = {
      sport,
      sport_name: getSportName(sport),
      matches,
      total_count: raw.count || matches.length,
      source: 'api',
    }

    // Store fetched matches in DB asynchronously (don't block response)
    if (matches.length > 0) {
      storeMatchesInBackground(matches, sport).catch(err =>
        console.error('[Multisport] Background store failed:', err)
      )
    }

    const cacheControl = 'public, s-maxage=60, stale-while-revalidate=120'

    return NextResponse.json(data, {
      headers: { 'Cache-Control': cacheControl },
    })
  } catch (error) {
    // Try stale DB data as last resort
    try {
      const staleMatches = await prisma.multisportMatch.findMany({
        where: { sport, status, ...(eventId ? { eventId } : {}) },
        orderBy: { commenceTime: status === 'finished' ? 'desc' : 'asc' },
        take: limit,
      })

      if (staleMatches.length > 0) {
        const matches = staleMatches.map(m => ({
          event_id: m.eventId,
          status: m.status,
          commence_time: m.commenceTime.toISOString(),
          league: { name: m.league, sport_key: m.sport },
          home: { name: m.homeTeam, team_id: m.homeTeamId },
          away: { name: m.awayTeam, team_id: m.awayTeamId },
          odds: m.odds,
          spread: m.spread,
          model: m.model,
          final_result: m.finalResult,
        }))

        return NextResponse.json(
          {
            sport,
            sport_name: getSportName(sport),
            matches,
            total_count: matches.length,
            source: 'database_stale',
          },
          { headers: { 'Cache-Control': 'public, s-maxage=30' } }
        )
      }
    } catch {
      // DB also failed
    }

    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Multisport Market API]', msg)
    return NextResponse.json(
      { error: msg, matches: [], total_count: 0 },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=60' } }
    )
  }
}

function getSportName(sport: string): string {
  const names: Record<string, string> = {
    basketball_nba: 'NBA',
    icehockey_nhl: 'NHL',
    basketball_ncaab: 'NCAA Basketball',
  }
  return names[sport] || sport
}

async function storeMatchesInBackground(matches: any[], sport: string) {
  const toStore = matches
    .map((m: any) => {
      const eventId = String(m.event_id || '')
      if (!eventId) return null
      return {
        eventId,
        sport,
        status: m.status || 'upcoming',
        homeTeam: m.home?.name || 'Home',
        awayTeam: m.away?.name || 'Away',
        homeTeamId: m.home?.team_id || null,
        awayTeamId: m.away?.team_id || null,
        league: m.league?.name || sport,
        commenceTime: new Date(m.commence_time),
        odds: m.odds || null,
        spread: m.spread || null,
        model: m.model || null,
        finalResult: m.final_result || null,
        lastSyncedAt: new Date(),
      }
    })
    .filter((m: any): m is NonNullable<typeof m> => m !== null)

  if (toStore.length === 0) return

  // Batch upsert
  await prisma.$transaction(
    toStore.map(m =>
      prisma.multisportMatch.upsert({
        where: { eventId_sport: { eventId: m.eventId, sport: m.sport } },
        update: { ...m, syncCount: { increment: 1 } },
        create: { ...m, syncCount: 1 },
      })
    ),
    { timeout: 30000 }
  )
}
