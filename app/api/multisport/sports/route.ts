import { NextResponse } from 'next/server'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

const SPORTS = [
  { key: 'basketball_nba', name: 'NBA' },
  { key: 'icehockey_nhl', name: 'NHL' },
  { key: 'basketball_ncaab', name: 'NCAA Basketball' },
]

export const maxDuration = 15
export const runtime = 'nodejs'

export async function GET() {
  if (!BASE_URL) {
    return NextResponse.json({ error: 'Backend not configured', sports: [] }, { status: 500 })
  }

  try {
    // Probe /predict-multisport/available for each sport to get fixture counts
    const results = await Promise.allSettled(
      SPORTS.map(async (sport) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const res = await fetch(`${BASE_URL}/predict-multisport/available?sport=${sport.key}`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
          signal: controller.signal,
          cache: 'no-store',
        })
        clearTimeout(timeoutId)

        if (!res.ok) return { sport_key: sport.key, name: sport.name, count: 0, available: false }

        const data = await res.json()
        return {
          sport_key: data.sport || sport.key,
          name: sport.name,
          count: data.count || 0,
          available: true,
          fixtures: {
            upcoming: data.count || 0,
            upcoming_with_odds: data.count || 0,
            finished: 0,
            total: data.count || 0,
          },
          season: {
            status: (data.count || 0) > 0 ? 'in_season' : 'off_season',
            season_window: '',
          },
          model: { available: true, training_samples: 0, confidence_note: null },
          live_data_available: false,
        }
      })
    )

    const sports = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      return {
        sport_key: SPORTS[i].key,
        name: SPORTS[i].name,
        count: 0,
        available: false,
        fixtures: { upcoming: 0, upcoming_with_odds: 0, finished: 0, total: 0 },
        season: { status: 'off_season', season_window: '' },
        model: { available: false, training_samples: 0, confidence_note: null },
        live_data_available: false,
      }
    })

    return NextResponse.json(
      { sports },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (error) {
    console.error('[Multisport Sports API]', error)
    return NextResponse.json(
      { error: 'Failed to fetch sports', sports: [] },
      { status: 200 }
    )
  }
}
