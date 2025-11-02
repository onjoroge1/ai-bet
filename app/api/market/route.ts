import { NextRequest, NextResponse } from 'next/server'

// Use BACKEND_API_URL from environment (no hardcoded fallback)
const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

if (!BASE_URL) {
  console.error('[Market API] BACKEND_API_URL or BACKEND_URL environment variable is not set')
}

export async function GET(request: NextRequest) {
  if (!BASE_URL) {
    return NextResponse.json(
      { 
        error: 'Backend API not configured',
        message: 'Please set BACKEND_API_URL or BACKEND_URL environment variable',
        matches: [],
        total_count: 0
      },
      { status: 500 }
    )
  }
  
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'upcoming'
    const limit = searchParams.get('limit') || '10'
    const leagueId = searchParams.get('league')
    const matchId = searchParams.get('match_id')
    const includeV2 = searchParams.get('include_v2') // Support for V1-only mode

    // Single match request - fastest path
    if (matchId) {
      const url = `${BASE_URL}/market?match_id=${matchId}${includeV2 === 'false' ? '&include_v2=false' : ''}`
      console.log(`Fetching single match: ${url}`)
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
        next: { 
          revalidate: 60,
          tags: ['market-data', `market-${matchId}`]
        }
      })

      if (!response.ok) {
        console.error(`Backend API error: ${response.status} ${response.statusText}`)
        return NextResponse.json(
          { 
            matches: [],
            total_count: 0
          },
          { 
            status: 200,
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
    }

    // Multi-match request
    let url = `${BASE_URL}/market?status=${status}&limit=${limit}`
    
    if (leagueId) {
      url += `&league=${leagueId}`
    }
    
    if (includeV2 === 'false') {
      url += '&include_v2=false' // 50% faster V1-only mode
    }

    console.log(`Fetching from: ${url}`)

    // Cache for 60 seconds - ISR (Incremental Static Regeneration)
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      next: { 
        revalidate: 60, // Revalidate every 60 seconds
        tags: ['market-data', `market-${status}`] // Cache tags for selective revalidation
      }
    })

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { 
          matches: [],
          total_count: 0
        },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
          }
        }
      )
    }

    const data = await response.json()
    console.log(`Received ${data.matches?.length || 0} matches`)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    })
  } catch (error) {
    console.error('Error fetching market data:', error)
    return NextResponse.json(
      { 
        matches: [],
        total_count: 0
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      }
    )
  }
}

