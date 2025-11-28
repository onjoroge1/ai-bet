import { NextRequest, NextResponse } from 'next/server'

// Use BACKEND_API_URL from environment (no hardcoded fallback)
const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

if (!BASE_URL) {
  console.error('[Trending Hot API] BACKEND_API_URL or BACKEND_URL environment variable is not set')
}

export async function GET(request: NextRequest) {
  if (!BASE_URL) {
    console.error('[Trending Hot API] BACKEND_API_URL or BACKEND_URL not set')
    return NextResponse.json(
      { 
        error: 'Backend API not configured',
        message: 'Please set BACKEND_API_URL or BACKEND_URL environment variable',
        matches: [],
        meta: {
          cache_hit: false,
          count: 0,
          status: 'error',
          note: 'Backend API not configured',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }
  
  try {
    const url = `${BASE_URL}/api/v1/trending/hot`
    console.log(`[Trending Hot API] Fetching from: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      next: { 
        revalidate: 300, // Cache for 5 minutes
        tags: ['trending-hot'] // Cache tags for selective revalidation
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[Trending Hot API] Backend API error: ${response.status} ${response.statusText}`, errorText)
      return NextResponse.json(
        { 
          error: `Backend API error: ${response.status} ${response.statusText}`,
          message: errorText,
          matches: [],
          meta: {
            cache_hit: false,
            count: 0,
            status: 'error',
            note: errorText,
            timestamp: new Date().toISOString()
          }
        },
        { 
          status: response.status,
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
          }
        }
      )
    }

    const data = await response.json()
    console.log(`[Trending Hot API] Received ${data.matches?.length || 0} hot matches`)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    })
  } catch (error) {
    console.error('[Trending Hot API] Error fetching hot matches:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch hot matches',
        message: errorMessage,
        matches: [],
        meta: {
          cache_hit: false,
          count: 0,
          status: 'error',
          note: errorMessage,
          timestamp: new Date().toISOString()
        }
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      }
    )
  }
}

