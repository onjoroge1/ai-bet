import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

const BACKEND_URL = process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
const API_KEY = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

/**
 * GET /api/players - Fetch player parlays and stats from backend
 *
 * Query params:
 *   type: "best" | "best-v2" | "by-legs" | "status" | "top-scorers" | "summary"
 *   legs: number (for by-legs)
 *   sport: string (for top-scorers, default "soccer")
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'best'
    const legs = searchParams.get('legs') || '2'
    const sport = searchParams.get('sport') || 'soccer'

    let endpoint: string

    switch (type) {
      case 'best':
        endpoint = '/api/v1/player-parlays/best'
        break
      case 'best-v2':
        endpoint = '/api/v1/player-parlays/best-v2'
        break
      case 'by-legs':
        endpoint = `/api/v1/player-parlays/by-legs/${legs}`
        break
      case 'status':
        endpoint = '/api/v1/player-parlays/status'
        break
      case 'top-scorers':
        endpoint = `/api/v1/players/top-scorers/${sport}`
        break
      case 'summary':
        endpoint = '/api/v1/players/summary'
        break
      default:
        endpoint = '/api/v1/player-parlays/best'
    }

    const url = `${BACKEND_URL}${endpoint}`

    logger.debug('Fetching player data from backend', {
      tags: ['players', 'api'],
      data: { type, url },
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        next: { revalidate: 300 }, // Cache for 5 minutes
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        logger.warn('Backend player API returned error', {
          tags: ['players', 'api', 'error'],
          data: { status: response.status, type },
        })
        return NextResponse.json(
          { error: 'Failed to fetch player data', status: response.status },
          { status: response.status }
        )
      }

      const data = await response.json()

      return NextResponse.json({
        ...data,
        fetchedAt: new Date().toISOString(),
        type,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        logger.error('Backend player API timeout', {
          tags: ['players', 'api', 'timeout'],
        })
        return NextResponse.json(
          { error: 'Backend API timeout', type },
          { status: 504 }
        )
      }

      throw fetchError
    }
  } catch (error) {
    logger.error('Error in player API route', {
      tags: ['players', 'api', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to fetch player data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

