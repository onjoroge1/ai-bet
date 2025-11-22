import { NextRequest, NextResponse } from 'next/server'

// Use BACKEND_API_URL from environment (no hardcoded fallback)
const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

if (!BASE_URL) {
  console.error('[Betting Intelligence API] BACKEND_API_URL or BACKEND_URL environment variable is not set')
}

/**
 * Get betting intelligence for a specific match
 * GET /api/betting-intelligence/[match_id]?bankroll=1000
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  if (!BASE_URL) {
    return NextResponse.json(
      { 
        error: 'Backend API not configured',
        message: 'Please set BACKEND_API_URL or BACKEND_URL environment variable'
      },
      { status: 500 }
    )
  }

  try {
    const { match_id: matchId } = await params
    const searchParams = request.nextUrl.searchParams
    const bankroll = searchParams.get('bankroll') || '1000'
    const model = searchParams.get('model') || 'best'

    // Build URL with query parameters
    let url = `${BASE_URL}/betting-intelligence/${matchId}?bankroll=${bankroll}`
    if (model !== 'best') {
      url += `&model=${model}`
    }

    console.log(`[Betting Intelligence] Fetching from: ${url}`)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      next: { 
        revalidate: 60, // Cache for 60 seconds
        tags: ['betting-intelligence', `betting-intelligence-${matchId}`]
      }
    })

    if (!response.ok) {
      // If betting intelligence not available, return null (not an error)
      if (response.status === 404) {
        return NextResponse.json(
          { 
            betting_intelligence: null,
            message: 'Betting intelligence not available for this match'
          },
          { 
            status: 200,
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
            }
          }
        )
      }

      console.error(`[Betting Intelligence] Backend API error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { 
          error: 'Failed to fetch betting intelligence',
          betting_intelligence: null
        },
        { 
          status: 200, // Return 200 with null data instead of error
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
          }
        }
      )
    }

    const data = await response.json()
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    })
  } catch (error) {
    console.error('[Betting Intelligence] Error fetching betting intelligence:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch betting intelligence',
        betting_intelligence: null
      },
      { 
        status: 200, // Return 200 with null data instead of error
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      }
    )
  }
}


