import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getDbCountryPricing } from '@/lib/server-pricing-service'
import { isMarketMatchTooOld, transformMarketMatchToApiFormat } from '@/lib/market-match-helpers'

// Use BACKEND_API_URL from environment (no hardcoded fallback)
const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

if (!BASE_URL) {
  console.error('[Match API] BACKEND_API_URL or BACKEND_URL environment variable is not set')
}

/**
 * Get match details by match_id
 * GET /api/match/[match_id]
 * Returns: Match data from market API and QuickPurchase info if available
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const { match_id: matchId } = await params
    const session = await getServerSession(authOptions)

    // First, try to get from database via QuickPurchase (faster than API call)
    let matchData = null
    let quickPurchaseInfo = null
    let userCountryCode = 'US' // Default fallback
    
    if (session?.user) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          country: {
            select: {
              code: true,
              currencyCode: true,
              currencySymbol: true
            }
          }
        }
      })

      // Get user's country code for pricing
      userCountryCode = user?.country?.code?.toUpperCase() || 'US'

      const quickPurchases = await prisma.quickPurchase.findMany({
        where: {
          matchId: matchId,
          type: { in: ['prediction', 'tip'] },
          isActive: true
        },
        include: {
          country: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // Find QuickPurchase for user's country, or use first available
      if (user?.countryId && quickPurchases.length > 0) {
        quickPurchaseInfo = quickPurchases.find(qp => qp.countryId === user.countryId) 
          || quickPurchases[0]
      } else if (quickPurchases.length > 0) {
        quickPurchaseInfo = quickPurchases[0]
      }
    } else {
      // For unauthenticated users, still get QuickPurchase info but use default pricing
      const quickPurchases = await prisma.quickPurchase.findMany({
        where: {
          matchId: matchId,
          type: { in: ['prediction', 'tip'] },
          isActive: true
        },
        include: {
          country: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      })

      if (quickPurchases.length > 0) {
        quickPurchaseInfo = quickPurchases[0]
      }
    }

    // Check database first, then fallback to external API if data is too old or missing
    let backendMatchData = null
    let dbMatch = null
    
    try {
      // Try to get from MarketMatch database first
      dbMatch = await prisma.marketMatch.findUnique({
        where: { matchId: String(matchId) },
      })

      if (dbMatch) {
        // ✅ FOR FINISHED MATCHES: Always use database (never expires, no API fallback needed)
        if (dbMatch.status === 'FINISHED') {
          console.log(`[Match API] Using database for FINISHED match ${matchId}`, {
            hasFinalResult: !!dbMatch.finalResult,
            finalResult: dbMatch.finalResult,
            status: dbMatch.status
          })
          // Transform database match to API format
          backendMatchData = transformMarketMatchToApiFormat(dbMatch)
          
          // Log finalResult extraction for debugging
          if (dbMatch.finalResult) {
            const finalResult = dbMatch.finalResult as any
            console.log(`[Match API] ✅ FinalResult from database for match ${matchId}:`, {
              finalResult: finalResult,
              hasScore: !!finalResult.score,
              score: finalResult.score,
              outcome: finalResult.outcome,
              outcome_text: finalResult.outcome_text,
              finalResultType: typeof finalResult,
              finalResultKeys: finalResult ? Object.keys(finalResult) : null
            })
          } else {
            console.warn(`[Match API] ⚠️ FINISHED match ${matchId} in database but no finalResult field`, {
              matchId: matchId,
              status: dbMatch.status,
              hasCurrentScore: !!dbMatch.currentScore,
              currentScore: dbMatch.currentScore
            })
          }
        } else if (!isMarketMatchTooOld(dbMatch)) {
          // For LIVE/UPCOMING: Use database if not too old
          console.log(`[Match API] Using database for match ${matchId} (status: ${dbMatch.status})`)
          backendMatchData = transformMarketMatchToApiFormat(dbMatch)
        } else {
          // For LIVE/UPCOMING: Data too old, fetch from API
          console.log(`[Match API] Database data too old for match ${matchId} (status: ${dbMatch.status}), fetching from API`)
          // Continue to API fetch below
        }
      } else {
        console.log(`[Match API] Match ${matchId} not in database, fetching from API`)
      }
    } catch (dbError) {
      console.error(`[Match API] Database error for match ${matchId}:`, dbError)
      // Continue to API fallback
    }

    // If database data is not available or too old, fetch from external API
    // ✅ SKIP API FETCH FOR FINISHED MATCHES - database is the source of truth
    if (!backendMatchData && BASE_URL) {
      // Check if match is FINISHED in database - if so, don't fetch from API
      if (dbMatch && dbMatch.status === 'FINISHED') {
        console.log(`[Match API] Match ${matchId} is FINISHED in database but no backendMatchData - this should not happen`)
        // Still try to transform what we have
        if (dbMatch) {
          backendMatchData = transformMarketMatchToApiFormat(dbMatch)
        }
      }
      
      // Only fetch from API if not FINISHED or if match not in database
      if (!dbMatch || dbMatch.status !== 'FINISHED') {
        // First try with status=live to get enhanced live data if match is live
        const liveMarketUrl = `${BASE_URL}/market?match_id=${matchId}&status=live`
        console.log(`[Match API] Fetching live match from: ${liveMarketUrl}`)
        
        try {
          const liveMarketResponse = await fetch(liveMarketUrl, {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
            },
            cache: 'no-store' // Disable caching for live matches to get real-time data
          })

          if (liveMarketResponse.ok) {
            const liveData = await liveMarketResponse.json()
            const match = liveData.matches?.[0]
            const matchDate = match?.kickoff_at ? new Date(match.kickoff_at) : null
            const now = new Date()
            const hoursSinceKickoff = matchDate ? (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60) : null
            const isLikelyFinished = hoursSinceKickoff !== null && hoursSinceKickoff > 3 // More than 3 hours old
            
            console.log(`[Match API] Live match response:`, { 
              hasData: !!match, 
              status: match?.status,
              hasMomentum: !!match?.momentum,
              hasModelMarkets: !!match?.model_markets,
              hasAIAnalysis: !!match?.ai_analysis,
              currentScore: match?.live_data?.current_score,
              minute: match?.live_data?.minute,
              kickoff_at: match?.kickoff_at,
              hoursSinceKickoff: hoursSinceKickoff?.toFixed(1),
              isLikelyFinished: isLikelyFinished,
              warning: isLikelyFinished && match?.status === 'LIVE' ? 'Match likely finished but status still LIVE' : null,
              timestamp: new Date().toISOString()
            })
            if (liveData.matches?.[0]) {
              backendMatchData = liveData.matches[0]
            }
          } else {
            console.log(`[Match API] Live match fetch failed: ${liveMarketResponse.status} ${liveMarketResponse.statusText}`)
          }
        } catch (error) {
          console.error(`[Match API] Error fetching live match:`, error)
        }

        // ✅ SKIP API FETCH FOR FINISHED MATCHES - database is source of truth
        // If not found as live, try finished matches from API ONLY if not already in database as FINISHED
        if (!backendMatchData) {
          const finishedMarketUrl = `${BASE_URL}/market?match_id=${matchId}&status=finished`
          console.log(`[Match API] Fetching finished match from API: ${finishedMarketUrl}`)
          
          try {
            const finishedResponse = await fetch(finishedMarketUrl, {
              headers: {
                Authorization: `Bearer ${API_KEY}`,
              },
              next: { revalidate: 3600 } // Cache finished matches for 1 hour
            })

            if (finishedResponse.ok) {
              const finishedData = await finishedResponse.json()
              console.log(`[Match API] Finished match response:`, { 
                hasData: !!finishedData.matches?.[0], 
                status: finishedData.matches?.[0]?.status,
                final_result: finishedData.matches?.[0]?.final_result 
              })
              if (finishedData.matches?.[0]) {
                backendMatchData = finishedData.matches[0]
              }
            }
          } catch (error) {
            console.error(`[Match API] Error fetching finished match:`, error)
          }
        }

        // If not found as live or finished, try without status filter (for upcoming)
        if (!backendMatchData) {
          const marketUrl = `${BASE_URL}/market?match_id=${matchId}`
          console.log(`[Match API] Fetching match from: ${marketUrl}`)
          
          try {
            const marketResponse = await fetch(marketUrl, {
              headers: {
                Authorization: `Bearer ${API_KEY}`,
              },
              next: { revalidate: 60 }
            })

            if (marketResponse.ok) {
              const marketData = await marketResponse.json()
              console.log(`[Match API] Match response:`, { 
                hasData: !!marketData.matches?.[0], 
                status: marketData.matches?.[0]?.status 
              })
              backendMatchData = marketData.matches?.[0] // Single match returned, get first element
            } else {
              console.log(`[Match API] Match fetch failed: ${marketResponse.status} ${marketResponse.statusText}`)
            }
          } catch (error) {
            console.error(`[Match API] Error fetching match:`, error)
          }
        }
      } else if (dbMatch && dbMatch.status === 'FINISHED') {
        console.log(`[Match API] ✅ Skipping API fetch for FINISHED match ${matchId} - using database finalResult only`)
      }
    } else if (!BASE_URL) {
      console.error(`[Match API] Cannot fetch match ${matchId}: BACKEND_API_URL not configured`)
    }

    // Use backend data if available (from database or API)
    if (backendMatchData) {
      matchData = backendMatchData
      
      // ✅ FIX: If match status is "finished" or "FINISHED" but final_result is missing,
      // OR if match is likely finished (more than 2.5 hours old) but status is still LIVE,
      // create final_result from current score so frontend can display it correctly
      const isFinishedStatus = matchData.status === 'finished' || matchData.status === 'FINISHED'
      const isLiveStatus = matchData.status === 'live' || matchData.status === 'LIVE'
      
      if ((isFinishedStatus || isLiveStatus) && !matchData.final_result) {
        const kickoffTime = matchData.kickoff_at ? new Date(matchData.kickoff_at).getTime() : null
        let shouldCreateFinalResult = false
        
        if (isFinishedStatus) {
          // If status is already finished, always create final_result if missing
          shouldCreateFinalResult = true
          console.log(`[Match API] ⚠️ Match ${matchId} has FINISHED status but no final_result - creating from score`)
        } else if (kickoffTime) {
          // If status is LIVE, check if match is likely finished
          const now = Date.now()
          const hoursSinceKickoff = (now - kickoffTime) / (1000 * 60 * 60)
          const likelyFinished = hoursSinceKickoff > 2.5 // More than 2.5 hours = likely finished
          shouldCreateFinalResult = likelyFinished
          if (likelyFinished) {
            console.log(`[Match API] ⚠️ Match ${matchId} is LIVE but likely finished (${hoursSinceKickoff.toFixed(2)}h old) - creating final_result from score`)
          }
        }
        
        if (shouldCreateFinalResult) {
          // Get score from multiple possible locations
          let score = matchData.score || 
                      matchData.live_data?.current_score ||
                      (matchData.currentScore ? { home: matchData.currentScore.home, away: matchData.currentScore.away } : null)
          
          // ✅ FIX: If score is still not found, try to get it from database directly
          if (!score && dbMatch && dbMatch.currentScore) {
            const dbScore = dbMatch.currentScore as { home?: number; away?: number }
            if (dbScore && (dbScore.home !== undefined || dbScore.away !== undefined)) {
              console.log(`[Match API] 🔍 Getting score from database currentScore field`)
              score = {
                home: dbScore.home ?? 0,
                away: dbScore.away ?? 0
              }
            }
          }
          
          if (score && (score.home !== undefined || score.away !== undefined)) {
            matchData.final_result = {
              score: {
                home: score.home ?? 0,
                away: score.away ?? 0
              },
              outcome: (score.home ?? 0) > (score.away ?? 0) ? 'home' : 
                       (score.away ?? 0) > (score.home ?? 0) ? 'away' : 'draw',
              outcome_text: (score.home ?? 0) > (score.away ?? 0) ? 'Home Win' : 
                           (score.away ?? 0) > (score.home ?? 0) ? 'Away Win' : 'Draw'
            }
            // Also ensure score is set at root level
            if (!matchData.score) {
              matchData.score = matchData.final_result.score
            }
            console.log(`[Match API] ✅ Created final_result:`, matchData.final_result)
          } else {
            console.warn(`[Match API] ⚠️ Cannot create final_result: no score found`, {
              hasScore: !!matchData.score,
              hasLiveData: !!matchData.live_data,
              hasCurrentScore: !!matchData.currentScore,
              hasDbMatch: !!dbMatch,
              dbMatchCurrentScore: dbMatch?.currentScore,
              matchDataKeys: Object.keys(matchData)
            })
          }
        }
      }
      
      // Normalize predictions structure (backend uses predictions.v1/v2, frontend expects models.v1_consensus/v2_lightgbm)
      if (matchData.predictions && !matchData.models) {
        matchData.models = {
          v1_consensus: matchData.predictions.v1 ? {
            pick: matchData.predictions.v1.pick,
            confidence: matchData.predictions.v1.confidence,
            probs: matchData.predictions.v1.probs
          } : null,
          v2_lightgbm: matchData.predictions.v2 ? {
            pick: matchData.predictions.v2.pick,
            confidence: matchData.predictions.v2.confidence,
            probs: matchData.predictions.v2.probs
          } : null
        }
      }
      
      // Ensure ai_analysis is preserved (it should already be in backendMatchData, but explicitly log it)
      if (matchData.ai_analysis) {
        console.log(`[Match API] AI Analysis found:`, {
          minute: matchData.ai_analysis.minute,
          hasMomentum: !!matchData.ai_analysis.momentum,
          observationsCount: matchData.ai_analysis.observations?.length || 0,
          bettingAnglesCount: matchData.ai_analysis.betting_angles?.length || 0
        })
      }
      
      // Ensure team names are populated - fallback to QuickPurchase if backend doesn't have them
      if ((!matchData.home?.name || matchData.home.name === 'TBD' || matchData.home.name.trim() === '') ||
          (!matchData.away?.name || matchData.away.name === 'TBD' || matchData.away.name.trim() === '')) {
        
        // Try to get from QuickPurchase
        if (quickPurchaseInfo) {
          const matchDataFromQP = quickPurchaseInfo.matchData as any
          
          // Extract team names from QuickPurchase name field (format: "Team A vs Team B")
          const nameParts = quickPurchaseInfo.name.split(' vs ')
          let homeTeamName = matchData.home?.name || 'TBD'
          let awayTeamName = matchData.away?.name || 'TBD'
          
          if (nameParts.length === 2) {
            homeTeamName = nameParts[0].trim() || homeTeamName
            awayTeamName = nameParts[1].trim() || awayTeamName
          } else if (matchDataFromQP) {
            // Try matchData from QuickPurchase
            homeTeamName = matchDataFromQP.home_team || matchDataFromQP.home?.name || homeTeamName
            awayTeamName = matchDataFromQP.away_team || matchDataFromQP.away?.name || awayTeamName
          }
          
          // Update matchData with extracted names if we got valid names
          if (homeTeamName !== 'TBD' && awayTeamName !== 'TBD' && 
              homeTeamName.trim() !== '' && awayTeamName.trim() !== '') {
            if (!matchData.home) matchData.home = { name: '', team_id: null, logo_url: null }
            if (!matchData.away) matchData.away = { name: '', team_id: null, logo_url: null }
            matchData.home.name = homeTeamName
            matchData.away.name = awayTeamName
            console.log(`[Match API] Extracted team names from QuickPurchase: ${homeTeamName} vs ${awayTeamName}`)
          }
        }
      }
    } else if (quickPurchaseInfo) {
      // Fallback to QuickPurchase data only if backend API fails
      const matchDataFromQP = quickPurchaseInfo.matchData as any
      if (matchDataFromQP) {
        // Extract team names from QuickPurchase name field if matchData doesn't have them
        let homeTeamName = matchDataFromQP.home_team || matchDataFromQP.home?.name || 'Home Team'
        let awayTeamName = matchDataFromQP.away_team || matchDataFromQP.away?.name || 'Away Team'
        
        // If still default values, try to extract from QuickPurchase name (format: "Team A vs Team B")
        if (homeTeamName === 'Home Team' || awayTeamName === 'Away Team') {
          const nameParts = quickPurchaseInfo.name.split(' vs ')
          if (nameParts.length === 2) {
            homeTeamName = nameParts[0].trim() || homeTeamName
            awayTeamName = nameParts[1].trim() || awayTeamName
          }
        }
        
        matchData = {
          match_id: matchId,
          status: 'UPCOMING',
          kickoff_at: matchDataFromQP.date || new Date().toISOString(),
          league: {
            id: null,
            name: matchDataFromQP.league?.name || matchDataFromQP.league || null
          },
          home: {
            name: homeTeamName,
            team_id: null,
            logo_url: null
          },
          away: {
            name: awayTeamName,
            team_id: null,
            logo_url: null
          },
          odds: {
            novig_current: {
              home: 0.33,
              draw: 0.33,
              away: 0.34
            }
          },
          models: {
            v1_consensus: quickPurchaseInfo.predictionData ? {
              pick: quickPurchaseInfo.predictionType || 'home',
              confidence: (quickPurchaseInfo.confidenceScore || 0) / 100,
              probs: {
                home: 0.33,
                draw: 0.33,
                away: 0.34
              }
            } : null,
            v2_lightgbm: null
          }
        }
      }
    }

    // Apply country-specific pricing if quickPurchaseInfo is available
    if (quickPurchaseInfo && session?.user) {
      try {
        const packageType = quickPurchaseInfo.type === 'prediction' || quickPurchaseInfo.type === 'tip' 
          ? 'prediction' 
          : 'prediction'
        
        const countryPricing = await getDbCountryPricing(userCountryCode, packageType)
        
        quickPurchaseInfo = {
          ...quickPurchaseInfo,
          price: countryPricing.price,
          originalPrice: countryPricing.originalPrice || countryPricing.price,
          country: {
            currencyCode: countryPricing.currencyCode,
            currencySymbol: countryPricing.currencySymbol,
            code: userCountryCode,
            ...(quickPurchaseInfo.country || {})
          }
        }
      } catch (error) {
        console.error('Error getting country-specific pricing:', error)
      }
    } else if (quickPurchaseInfo && !session?.user) {
      // For unauthenticated users, try to get default US pricing
      try {
        const countryPricing = await getDbCountryPricing('US', 'prediction')
        quickPurchaseInfo = {
          ...quickPurchaseInfo,
          price: countryPricing.price,
          originalPrice: countryPricing.originalPrice || countryPricing.price,
          country: {
            currencyCode: countryPricing.currencyCode,
            currencySymbol: countryPricing.currencySymbol,
            code: 'US',
            ...(quickPurchaseInfo.country || {})
          }
        }
      } catch (error) {
        console.error('Error getting default pricing for unauthenticated user:', error)
      }
    }

    if (!matchData) {
      const errorMessage = BASE_URL 
        ? 'Match not found' 
        : 'Backend API not configured. Please set BACKEND_API_URL environment variable.'
      
      return NextResponse.json(
        { error: errorMessage },
        { status: BASE_URL ? 404 : 500 }
      )
    }

    // Determine if match is live to set appropriate cache headers
    const matchStatus = matchData.status?.toUpperCase() || ''
    const isLive = matchStatus === 'LIVE' || matchData.momentum !== undefined || matchData.model_markets !== undefined
    const isFinished = matchStatus === 'FINISHED' || matchData.final_result !== undefined
    
    // Dynamic cache headers based on match status:
    // - Live matches: NO caching (real-time updates needed)
    // - Finished matches: Long cache (data won't change)
    // - Upcoming matches: Short cache (60s for performance)
    const cacheHeaders = isLive
      ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' } // No caching for live matches
      : isFinished
      ? { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } // 1 hour cache for finished matches
      : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } // 60s cache for upcoming

    // Log final response for FINISHED matches
    if (matchData?.status === 'finished' || matchData?.final_result) {
      console.log(`[Match API] 📤 Final response for FINISHED match ${matchId}:`, {
        hasFinalResult: !!matchData.final_result,
        finalResult: matchData.final_result,
        hasScore: !!matchData.score,
        score: matchData.score,
        status: matchData.status
      })
    }
    
    return NextResponse.json({
      match: matchData,
      quickPurchase: quickPurchaseInfo ? {
        id: quickPurchaseInfo.id,
        name: quickPurchaseInfo.name,
        price: quickPurchaseInfo.price,
        originalPrice: (quickPurchaseInfo as any).originalPrice || quickPurchaseInfo.price,
        description: quickPurchaseInfo.description,
        confidenceScore: quickPurchaseInfo.confidenceScore,
        predictionType: quickPurchaseInfo.predictionType,
        valueRating: quickPurchaseInfo.valueRating,
        analysisSummary: quickPurchaseInfo.analysisSummary,
        predictionData: quickPurchaseInfo.predictionData, // Include full prediction data
        country: quickPurchaseInfo.country || {
          currencyCode: 'USD',
          currencySymbol: '$',
          code: userCountryCode
        }
      } : null
    }, {
      headers: cacheHeaders
    })
  } catch (error) {
    console.error('Error fetching match details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch match details' },
      { status: 500 }
    )
  }
}

