import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
const API_KEY = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

/**
 * GET /api/player-predictions/top-picks
 * Proxies to backend GET /player-predictions/top-picks
 * Returns best scorer picks across all upcoming matches (~0.5s — stats ranking)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = searchParams.get('limit') || '10'
  const sport = searchParams.get('sport') || ''

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const params = new URLSearchParams({ limit })
    if (sport) params.set('sport', sport)

    const response = await fetch(`${BASE_URL}/player-predictions/top-picks?${params}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache
      },
    })
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    return NextResponse.json(
      { error: isTimeout ? 'Request timeout' : 'Failed to fetch top picks' },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
