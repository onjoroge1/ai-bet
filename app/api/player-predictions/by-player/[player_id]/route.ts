import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
const API_KEY = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

/**
 * GET /api/player-predictions/by-player/[player_id]
 * Proxies to backend GET /player-predictions/by-player/{player_id}
 * Returns a single player's next match prediction (~5s — ML)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ player_id: string }> }
) {
  const { player_id } = await params

  if (!player_id) {
    return NextResponse.json({ error: 'player_id is required' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(`${BASE_URL}/player-predictions/by-player/${player_id}`, {
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
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    return NextResponse.json(
      { error: isTimeout ? 'Request timeout' : 'Failed to fetch player prediction' },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
