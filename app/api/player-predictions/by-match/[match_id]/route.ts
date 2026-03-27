import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
const API_KEY = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

/**
 * GET /api/player-predictions/by-match/[match_id]
 * Proxies to backend GET /player-predictions/by-match/{match_id}
 * Returns top scorers for a specific match (~25s — ML prediction)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  const { match_id } = await params

  if (!match_id) {
    return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 35000) // 35s — backend takes ~25s

    const response = await fetch(`${BASE_URL}/player-predictions/by-match/${match_id}`, {
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
    const isTimeout = error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))
    return NextResponse.json(
      { error: isTimeout ? 'Request timeout — prediction is still generating' : 'Failed to fetch player predictions' },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
