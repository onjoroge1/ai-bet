import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.BACKEND_API_URL || "http://localhost:8000"
const API_KEY = process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'upcoming'
    const limit = searchParams.get('limit') || '10'
    const leagueId = searchParams.get('league')

    let url = `${BASE_URL}/market?status=${status}&limit=${limit}`
    
    if (leagueId) {
      url += `&league=${leagueId}`
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

