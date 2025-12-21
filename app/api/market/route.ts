import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { isMarketMatchTooOld, transformMarketMatchesToApiResponse } from '@/lib/market-match-helpers'

// Use BACKEND_API_URL from environment (no hardcoded fallback)
const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

if (!BASE_URL) {
  console.error('[Market API] BACKEND_API_URL or BACKEND_URL environment variable is not set')
}

export async function GET(request: NextRequest) {
  if (!BASE_URL) {
    console.error('[Market API] BACKEND_API_URL or BACKEND_URL not set')
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
    
    console.log(`[Market API] Using backend: ${BASE_URL}`)

    // Single match request - check database first
    if (matchId) {
      try {
        // Try to get from database first
        const dbMatch = await prisma.marketMatch.findUnique({
          where: { matchId: String(matchId) },
        })

        if (dbMatch && !isMarketMatchTooOld(dbMatch)) {
          console.log(`[Market API] Using database for match ${matchId}`)
          const { transformMarketMatchToApiFormat } = await import('@/lib/market-match-helpers')
          const apiMatch = transformMarketMatchToApiFormat(dbMatch)
          
          // Determine cache headers based on status
          const isLive = dbMatch.status === 'LIVE'
          const isFinished = dbMatch.status === 'FINISHED'
          const cacheHeaders = isLive
            ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
            : isFinished
            ? { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' }
            : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }

          return NextResponse.json(
            {
              matches: [apiMatch],
              total_count: 1,
            },
            { headers: cacheHeaders }
          )
        } else if (dbMatch && isMarketMatchTooOld(dbMatch)) {
          console.log(`[Market API] Database data too old for match ${matchId}, fetching from API`)
        } else {
          console.log(`[Market API] Match ${matchId} not in database, fetching from API`)
        }
      } catch (dbError) {
        console.error(`[Market API] Database error for match ${matchId}:`, dbError)
        // Continue to API fallback
      }

      // Fallback to external API
      const url = `${BASE_URL}/market?match_id=${matchId}${includeV2 === 'false' ? '&include_v2=false' : ''}`
      console.log(`[Market API] Fetching single match from API: ${url}`)
      
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
        console.error(`[Market API] Backend API error: ${response.status} ${response.statusText}`)
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

    // Multi-match request - check database first
    const isLive = status === 'live'
    const dbStatus = status.toUpperCase() // Convert 'live' to 'LIVE', 'upcoming' to 'UPCOMING'
    
    try {
      // Build database query
      const whereClause: any = {
        status: dbStatus,
        isActive: true,
        isArchived: false,
      }

      if (leagueId) {
        whereClause.leagueId = String(leagueId)
      }

      // Query database
      const dbMatches = await prisma.marketMatch.findMany({
        where: whereClause,
        orderBy: [
          { kickoffDate: 'asc' }, // Order by kickoff time
        ],
        take: parseInt(limit) || 10,
      })

      // Filter out matches that are too old
      const freshMatches = dbMatches.filter((match) => !isMarketMatchTooOld(match))
      const staleMatches = dbMatches.filter((match) => isMarketMatchTooOld(match))

      if (freshMatches.length > 0) {
        console.log(`[Market API] Using database: ${freshMatches.length} fresh matches for status=${status}`)
        if (staleMatches.length > 0) {
          console.log(`[Market API] ${staleMatches.length} matches in database are too old, will fetch from API`)
        }

        // Transform and return database matches
        const apiResponse = transformMarketMatchesToApiResponse(freshMatches, freshMatches.length)
        
        // Dynamic cache headers based on match status
        const cacheHeaders = isLive
          ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' } // No caching for live
          : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } // Cache upcoming
        
        return NextResponse.json(apiResponse, {
          headers: cacheHeaders
        })
      } else if (dbMatches.length > 0) {
        // All matches in database are too old
        console.log(`[Market API] All ${dbMatches.length} database matches are too old, fetching from API`)
      } else {
        // No matches in database
        console.log(`[Market API] No matches in database for status=${status}, fetching from API`)
      }
    } catch (dbError) {
      console.error(`[Market API] Database error for status=${status}:`, dbError)
      // Continue to API fallback
    }

    // Fallback to external API
    let url = `${BASE_URL}/market?status=${status}&limit=${limit}`
    
    if (leagueId) {
      url += `&league=${leagueId}`
    }
    
    if (includeV2 === 'false') {
      url += '&include_v2=false' // 50% faster V1-only mode
    }

    console.log(`[Market API] Fetching from external API: ${url}`)

    // Live matches should NOT be cached - they need real-time data
    // Upcoming matches can be cached for performance
    const cacheConfig = isLive 
      ? { cache: 'no-store' as const } // No caching for live matches
      : { 
          next: { 
            revalidate: 60, // Cache upcoming matches for 60 seconds
            tags: ['market-data', `market-${status}`] // Cache tags for selective revalidation
          }
        }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      ...cacheConfig
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[Market API] Backend API error: ${response.status} ${response.statusText}`, errorText)
      
      // Different cache headers based on match status
      const errorCacheHeaders = isLive
        ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
      
      return NextResponse.json(
        { 
          error: `Backend API error: ${response.status} ${response.statusText}`,
          message: errorText,
          matches: [],
          total_count: 0
        },
        { 
          status: response.status,
          headers: errorCacheHeaders
        }
      )
    }

    const data = await response.json()
    console.log(`[Market API] Received ${data.matches?.length || 0} matches from external API`)
    
    // Dynamic cache headers based on match status
    const cacheHeaders = isLive
      ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' } // No caching for live
      : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } // Cache upcoming
    
    return NextResponse.json(data, {
      headers: cacheHeaders
    })
  } catch (error) {
    console.error('Error fetching market data:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch market data',
        message: errorMessage,
        matches: [],
        total_count: 0
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      }
    )
  }
}

