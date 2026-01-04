import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { isMarketMatchTooOld, transformMarketMatchesToApiResponse } from '@/lib/market-match-helpers'
import { retryWithBackoff } from '@/lib/retry-utils'
import { 
  transformLiteMatchToDatabaseFormat, 
  mergeLiteDataWithExisting,
  transformLiteMatchToApiFormat 
} from '@/lib/market-lite-helpers'

// Use BACKEND_API_URL from environment (no hardcoded fallback)
const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

// API route timeout configuration
export const maxDuration = 30 // 30 seconds for Vercel Pro/Enterprise
export const runtime = 'nodejs'

// External API timeout (15 seconds - leave buffer for Next.js timeout)
const EXTERNAL_API_TIMEOUT = 15000

if (!BASE_URL) {
  console.error('[Market API] BACKEND_API_URL or BACKEND_URL environment variable is not set')
}

/**
 * Fetch from external API with timeout and retry logic
 * Each retry attempt gets a fresh timeout to prevent AbortController conflicts
 */
async function fetchFromExternalAPI(url: string, cacheConfig: any, isLive: boolean) {
  // Use retry logic with exponential backoff
  // Each retry gets a fresh AbortController to avoid signal conflicts
  const response = await retryWithBackoff(
    async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, EXTERNAL_API_TIMEOUT)

      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
          signal: controller.signal,
          ...cacheConfig
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unknown error')
          throw new Error(`API error: ${res.status} ${res.statusText} - ${errorText}`)
        }

        return res
      } catch (error) {
        clearTimeout(timeoutId)
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.error(`[Market API] External API timeout after ${EXTERNAL_API_TIMEOUT}ms: ${url}`)
          throw new Error('External API timeout - request took too long')
        }
        
        throw error
      }
    },
    3,    // Max 3 retries
    2000, // Initial 2 second delay
    30000 // Max 30 second delay cap
  )

  return response
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
    const mode = searchParams.get('mode') // 'lite' or null
    const isLite = mode === 'lite'
    
    // For lite mode with live matches, don't limit (get all matches)
    // For full mode or upcoming, use provided limit or default
    const defaultLimit = isLite && status === 'live' ? '1000' : '10'
    const limit = searchParams.get('limit') || defaultLimit
    
    const leagueId = searchParams.get('league')
    const matchId = searchParams.get('match_id')
    const includeV2 = searchParams.get('include_v2') // Support for V1-only mode
    
    console.log(`[Market API] Using backend: ${BASE_URL}, mode: ${mode || 'full'}`)

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

      // Fallback to external API with timeout and retry
      const url = `${BASE_URL}/market?match_id=${matchId}${includeV2 === 'false' ? '&include_v2=false' : ''}`
      console.log(`[Market API] Fetching single match from API: ${url}`)
      
      try {
        const response = await fetchFromExternalAPI(
          url,
          {
            next: { 
              revalidate: 60,
              tags: ['market-data', `market-${matchId}`]
            }
          },
          false // Single match request, not live list
        )

        const data = await response.json()
        return NextResponse.json(data, {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          }
        })
      } catch (error) {
        console.error(`[Market API] Error fetching single match:`, error)
        // Return empty result instead of error (graceful degradation)
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

    // Multi-match request - check database first
    const isLive = status === 'live'
    const dbStatus = status.toUpperCase() // Convert 'live' to 'LIVE', 'upcoming' to 'UPCOMING'
    
    // Declare dbMatches outside try block so it's accessible in catch block for stale data fallback
    let dbMatches: any[] = []
    
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
      // For upcoming matches, don't limit (get all matches)
      // For other statuses, use provided limit or default
      const dbLimit = (status === 'upcoming' || status === 'live') ? undefined : (parseInt(limit) || 10)
      
      dbMatches = await prisma.marketMatch.findMany({
        where: whereClause,
        orderBy: [
          { kickoffDate: 'asc' }, // Order by kickoff time
        ],
        ...(dbLimit !== undefined && { take: dbLimit }),
      })

      // Filter out matches that are too old
      const freshMatches = dbMatches.filter((match) => !isMarketMatchTooOld(match))
      const staleMatches = dbMatches.filter((match) => isMarketMatchTooOld(match))

      if (freshMatches.length > 0) {
        console.log(`[Market API] Using database: ${freshMatches.length} fresh matches for status=${status}`)
        if (staleMatches.length > 0) {
          console.log(`[Market API] ${staleMatches.length} matches in database are too old, will fetch from API`)
        }

        // Deduplicate database matches by matchId (shouldn't happen, but safety check)
        const seenMatchIds = new Set<string>()
        const uniqueFreshMatches = freshMatches.filter((match) => {
          const matchId = String(match.matchId || '')
          if (!matchId || seenMatchIds.has(matchId)) {
            return false
          }
          seenMatchIds.add(matchId)
          return true
        })
        
        if (uniqueFreshMatches.length < freshMatches.length) {
          console.warn(`[Market API] Found ${freshMatches.length - uniqueFreshMatches.length} duplicate matches in database, deduplicating`)
        }
        
        // Transform and return database matches
        const apiResponse = transformMarketMatchesToApiResponse(uniqueFreshMatches, uniqueFreshMatches.length)
        
        // Dynamic cache headers based on match status
        const cacheHeaders = isLive
          ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' } // No caching for live
          : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } // Cache upcoming
        
        return NextResponse.json(apiResponse, {
          headers: cacheHeaders
        })
      } else if (dbMatches.length > 0) {
        // All matches in database are too old, but we have some data
        // For lite mode, return stale data rather than empty (better UX)
        // For full mode, try to fetch fresh data from API
        if (isLite) {
          console.log(`[Market API] All ${dbMatches.length} database matches are stale, but returning stale data for lite mode (better than empty)`)
          const apiResponse = transformMarketMatchesToApiResponse(dbMatches, dbMatches.length)
          const cacheHeaders = isLive
            ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
            : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
          return NextResponse.json({
            ...apiResponse,
            _metadata: {
              stale: true,
              warning: 'Data may be outdated'
            }
          }, {
            headers: cacheHeaders
          })
        } else {
          console.log(`[Market API] All ${dbMatches.length} database matches are too old, fetching from API`)
        }
      } else {
        // No matches in database
        console.log(`[Market API] No matches in database for status=${status}, fetching from API`)
      }
    } catch (dbError) {
      console.error(`[Market API] Database error for status=${status}:`, dbError)
      // Continue to API fallback
    }

    // Fallback to external API
    // IMPORTANT: Always use lite mode for live matches to prevent timeouts
    // For other statuses, use lite mode if requested, otherwise use full mode
    const shouldUseLite = isLite || (status === 'live' && !matchId) // Always use lite for live list requests
    
    let url = `${BASE_URL}/market?status=${status}`
    
    // Add mode parameter if lite mode should be used
    if (shouldUseLite) {
      url += `&mode=lite`
      // For live and upcoming matches in lite mode, don't add limit (get all matches)
      // Lite mode is fast, so we can get all matches without performance issues
      if (status === 'live' || status === 'upcoming') {
        // Don't add limit parameter - let external API return all matches
        // If external API requires a limit, it will use its default
      } else {
        url += `&limit=${limit}`
      }
    } else {
      url += `&limit=${limit}`
      if (includeV2 === 'false') {
        url += '&include_v2=false' // 50% faster V1-only mode
      }
    }
    
    if (leagueId) {
      url += `&league=${leagueId}`
    }

    console.log(`[Market API] Fetching from external API (mode: ${mode || 'full'}): ${url}`)

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

    try {
      // Fetch with timeout and retry logic
      const response = await fetchFromExternalAPI(url, cacheConfig, isLive)
      
      const data = await response.json()
      const apiMatches = data.matches || []
      console.log(`[Market API] Received ${apiMatches.length} matches from external API (mode: ${mode || 'full'})`)
      
      // If lite mode, merge data into database and transform response
      if (isLite && apiMatches.length > 0) {
        console.log(`[Market API] Processing ${apiMatches.length} lite matches - merging with database`)
        
        // Process each lite match: merge with database
        for (const liteMatch of apiMatches) {
          try {
            const liteData = transformLiteMatchToDatabaseFormat(liteMatch)
            
            if (!liteData.matchId) {
              console.warn(`[Market API] Skipping lite match with invalid matchId:`, liteMatch)
              continue
            }

            // Check if match exists in database
            const existing = await prisma.marketMatch.findUnique({
              where: { matchId: liteData.matchId },
            })

            if (existing) {
              // Merge lite data with existing full data (preserve full data fields)
              const merged = mergeLiteDataWithExisting(liteData, existing)
              
              await prisma.marketMatch.update({
                where: { matchId: liteData.matchId },
                data: merged,
              })
              
              console.log(`[Market API] Merged lite data for match ${liteData.matchId} (preserved full data)`)
            } else {
              // Create new record with lite data
              await prisma.marketMatch.create({
                data: {
                  ...liteData,
                  syncCount: 1,
                } as any,
              })
              
              console.log(`[Market API] Created new match ${liteData.matchId} from lite data`)
            }
          } catch (mergeError) {
            console.error(`[Market API] Error merging lite match ${liteMatch.match_id}:`, mergeError)
            // Continue processing other matches
          }
        }

        // Transform lite matches to API format for response
        const transformedMatches = apiMatches.map(transformLiteMatchToApiFormat)
        
        // Deduplicate by matchId - keep the first occurrence (most recent odds data)
        const seenMatchIds = new Set<string>()
        const deduplicatedMatches = transformedMatches.filter((match) => {
          const matchId = String(match.id || match.match_id || '')
          if (!matchId || matchId === 'undefined' || matchId === 'null') {
            return false // Skip invalid matchIds
          }
          if (seenMatchIds.has(matchId)) {
            console.warn(`[Market API] Duplicate matchId ${matchId} detected in API response, skipping duplicate`)
            return false // Skip duplicates
          }
          seenMatchIds.add(matchId)
          return true
        })
        
        if (deduplicatedMatches.length < transformedMatches.length) {
          console.log(`[Market API] Deduplicated ${transformedMatches.length} matches to ${deduplicatedMatches.length} unique matches`)
        }
        
        // Dynamic cache headers based on match status
        const cacheHeaders = isLive
          ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' } // No caching for live
          : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } // Cache upcoming
        
        return NextResponse.json({
          matches: deduplicatedMatches,
          total_count: deduplicatedMatches.length,
          mode: 'lite',
        }, {
          headers: cacheHeaders
        })
      }
      
      // Full mode: deduplicate and return data
      // Reuse apiMatches from above (already declared at line 332)
      const fullModeMatches = apiMatches || []
      
      // Deduplicate by matchId - keep the first occurrence
      const seenMatchIds = new Set<string>()
      const deduplicatedMatches = fullModeMatches.filter((match: any) => {
        const matchId = String(match.id || match.match_id || match.matchId || '')
        if (!matchId || matchId === 'undefined' || matchId === 'null') {
          return false // Skip invalid matchIds
        }
        if (seenMatchIds.has(matchId)) {
          console.warn(`[Market API] Duplicate matchId ${matchId} detected in full mode response, skipping duplicate`)
          return false // Skip duplicates
        }
        seenMatchIds.add(matchId)
        return true
      })
      
      if (deduplicatedMatches.length < fullModeMatches.length) {
        console.log(`[Market API] Deduplicated ${fullModeMatches.length} matches to ${deduplicatedMatches.length} unique matches (full mode)`)
      }
      
      // Dynamic cache headers based on match status
      const cacheHeaders = isLive
        ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' } // No caching for live
        : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } // Cache upcoming
      
      return NextResponse.json({
        ...data,
        matches: deduplicatedMatches,
        total_count: deduplicatedMatches.length,
      }, {
        headers: cacheHeaders
      })
    } catch (error) {
      // Handle timeout and other errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('AbortError')
      
      // Enhanced error logging with context
      console.error(`[Market API] Error fetching from external API:`, {
        error: errorMessage,
        isTimeout,
        status,
        limit,
        url,
        hasStaleData: dbMatches.length > 0,
        staleMatchCount: dbMatches.length,
        timestamp: new Date().toISOString()
      })
      
      // Different cache headers based on match status
      const errorCacheHeaders = isLive
        ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
      
      // Fallback to stale database data if available (better than empty array)
      if (dbMatches.length > 0) {
        const oldestSync = dbMatches.reduce((oldest, match) => {
          return match.lastSyncedAt < oldest ? match.lastSyncedAt : oldest
        }, dbMatches[0].lastSyncedAt)
        
        const ageSeconds = Math.floor((Date.now() - oldestSync.getTime()) / 1000)
        const ageMinutes = Math.floor(ageSeconds / 60)
        
        console.log(`[Market API] External API failed, using stale database data: ${dbMatches.length} matches (${ageMinutes}m ${ageSeconds % 60}s old)`)
        
        // Transform and return stale database matches
        const apiResponse = transformMarketMatchesToApiResponse(dbMatches, dbMatches.length)
        
        return NextResponse.json(
          {
            ...apiResponse,
            _metadata: {
              stale: true,
              lastSyncTime: oldestSync.toISOString(),
              ageSeconds,
              errorType: isTimeout ? 'api_timeout' : 'api_error',
              errorMessage: isTimeout 
                ? 'External API timeout - using stale database data'
                : `External API error - using stale database data: ${errorMessage}`,
              fallbackReason: 'external_api_unavailable'
            }
          },
          {
            status: 200, // Return 200 to prevent frontend errors
            headers: errorCacheHeaders
          }
        )
      }
      
      // No stale data available - return empty matches with error context
      // But first, try to query database one more time without freshness check
      // This ensures we return something if matches exist, even if stale
      try {
        const emergencyMatches = await prisma.marketMatch.findMany({
          where: {
            status: dbStatus,
            isActive: true,
            isArchived: false,
          },
          orderBy: [
            { kickoffDate: 'asc' },
          ],
          take: parseInt(limit) || 10,
        })

        if (emergencyMatches.length > 0) {
          console.warn(`[Market API] External API failed, returning ${emergencyMatches.length} emergency matches (may be stale)`)
          const apiResponse = transformMarketMatchesToApiResponse(emergencyMatches, emergencyMatches.length)
          return NextResponse.json(
            {
              ...apiResponse,
              _metadata: {
                stale: true,
                warning: 'Data may be outdated - external API unavailable',
                errorType: isTimeout ? 'api_timeout' : 'api_error',
                errorMessage,
              }
            },
            {
              status: 200,
              headers: errorCacheHeaders
            }
          )
        }
      } catch (emergencyError) {
        console.error(`[Market API] Emergency database query also failed:`, emergencyError)
      }
      
      console.warn(`[Market API] External API failed and no database data available - returning empty matches`)
      
      return NextResponse.json(
        { 
          error: isTimeout
            ? 'External API timeout - request took too long'
            : `Failed to fetch matches: ${errorMessage}`,
          message: 'No matches available - external API unavailable and no database fallback',
          matches: [],
          total_count: 0,
          _metadata: {
            stale: false,
            errorType: isTimeout ? 'api_timeout' : 'api_error',
            errorMessage,
            fallbackReason: 'no_data_available',
            hasStaleData: false
          }
        },
        { 
          status: 200, // Return 200 instead of 500/504 to prevent frontend errors
          headers: errorCacheHeaders
        }
      )
    }
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

