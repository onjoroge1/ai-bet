import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

// Serve cached predictions if less than 2 hours old
const PREDICTION_MAX_AGE = 2 * 60 * 60 * 1000

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!BASE_URL) {
    return NextResponse.json({ error: 'Backend not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const sport_key = body.sport_key || body.sport
    const event_id = body.event_id

    if (!sport_key || !event_id) {
      return NextResponse.json({ error: 'sport_key and event_id are required' }, { status: 400 })
    }

    // Check DB for cached prediction
    const cached = await prisma.multisportMatch.findUnique({
      where: { eventId_sport: { eventId: String(event_id), sport: sport_key } },
      select: { predictionData: true, predictionFetchedAt: true },
    })

    if (cached?.predictionData && cached.predictionFetchedAt) {
      const age = Date.now() - cached.predictionFetchedAt.getTime()
      if (age < PREDICTION_MAX_AGE) {
        return NextResponse.json(cached.predictionData)
      }
    }

    // Fetch fresh prediction from backend
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000) // AI analysis can take 10-15s

    const response = await fetch(`${BASE_URL}/predict-multisport`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sport: sport_key, event_id, include_analysis: true }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      // If backend fails, serve stale cached prediction if available
      if (cached?.predictionData) {
        return NextResponse.json(cached.predictionData)
      }
      const text = await response.text().catch(() => 'Unknown error')
      throw new Error(`Backend error: ${response.status} - ${text}`)
    }

    const data = await response.json()

    // Cache prediction in DB (don't block response)
    prisma.multisportMatch.upsert({
      where: { eventId_sport: { eventId: String(event_id), sport: sport_key } },
      update: {
        predictionData: data,
        predictionFetchedAt: new Date(),
        teamContext: data.team_context || null,
        modelInfo: data.model_info || null,
      },
      create: {
        eventId: String(event_id),
        sport: sport_key,
        status: 'upcoming',
        homeTeam: data.match_info?.home_team || 'Home',
        awayTeam: data.match_info?.away_team || 'Away',
        league: data.match_info?.league_name || sport_key,
        commenceTime: data.match_info?.commence_time ? new Date(data.match_info.commence_time) : new Date(),
        predictionData: data,
        predictionFetchedAt: new Date(),
        teamContext: data.team_context || null,
        modelInfo: data.model_info || null,
      },
    }).catch(err => console.error('[Multisport Predict] Cache store failed:', err))

    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Multisport Predict API]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
