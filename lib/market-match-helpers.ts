/**
 * Helper functions for MarketMatch database integration
 * Transforms MarketMatch records to match external API response format
 */

import { MarketMatch } from '@prisma/client'

// Data freshness thresholds (in milliseconds)
const LIVE_MAX_AGE = 30 * 1000 // 30 seconds for live matches
const UPCOMING_MAX_AGE = 30 * 60 * 1000 // 30 minutes for upcoming matches (20-minute buffer after 10-minute sync)
// FINISHED matches never expire (use database always)

/**
 * Check if MarketMatch data is too old based on status
 */
export function isMarketMatchTooOld(match: MarketMatch): boolean {
  const now = Date.now()
  const lastSynced = match.lastSyncedAt.getTime()
  const age = now - lastSynced

  switch (match.status) {
    case 'LIVE':
      return age > LIVE_MAX_AGE
    case 'UPCOMING':
      return age > UPCOMING_MAX_AGE
    case 'FINISHED':
    case 'CANCELLED':
    case 'POSTPONED':
      // Finished matches never expire - always use database
      return false
    default:
      // Unknown status - treat as upcoming
      return age > UPCOMING_MAX_AGE
  }
}

/**
 * Transform MarketMatch to external API match format
 */
export function transformMarketMatchToApiFormat(match: MarketMatch): any {
  // Extract JSON fields
  const consensusOdds = match.consensusOdds as { home?: number; draw?: number; away?: number } | null
  const allBookmakers = match.allBookmakers as Record<string, any> | null
  const v1Model = match.v1Model as any
  const v2Model = match.v2Model as any
  const currentScore = match.currentScore as { home?: number; away?: number } | null
  const momentum = match.momentum as any
  const modelMarkets = match.modelMarkets as any
  const aiAnalysis = match.aiAnalysis as any
  const finalResult = match.finalResult as any // ✅ Direct read from database - format: {"score":{"away":1,"home":1},"outcome":"D","outcome_text":"Draw"}
  const matchStatistics = match.matchStatistics as any
  
  // Log finalResult for FINISHED matches
  if (match.status === 'FINISHED') {
    console.log(`[Transform] Processing FINISHED match ${match.matchId}`, {
      hasFinalResult: !!finalResult,
      finalResult: finalResult,
      finalResultType: typeof finalResult,
      finalResultKeys: finalResult ? Object.keys(finalResult) : null
    })
  }

  // Build API response format
  const apiMatch: any = {
    id: match.matchId,
    match_id: match.matchId,
    status: match.status.toLowerCase(),
    home: {
      name: match.homeTeam,
      id: match.homeTeamId || null,
      team_id: match.homeTeamId || null,
      logo_url: match.homeTeamLogo || null,
    },
    away: {
      name: match.awayTeam,
      id: match.awayTeamId || null,
      team_id: match.awayTeamId || null,
      logo_url: match.awayTeamLogo || null,
    },
    league: {
      name: match.league,
      id: match.leagueId || null,
      country: match.leagueCountry || null,
      flagUrl: match.leagueFlagUrl || null,
      flag: match.leagueFlagUrl || null, // Alternative field name
      flagEmoji: match.leagueFlagEmoji || null,
    },
    kickoff_at: match.kickoffDate.toISOString(),
    matchDate: match.matchDate?.toISOString() || match.kickoffDate.toISOString(),
  }

  // Add odds data
  if (consensusOdds || allBookmakers) {
    apiMatch.odds = {}
    if (consensusOdds) {
      apiMatch.odds.novig_current = {
        home: consensusOdds.home || 0,
        draw: consensusOdds.draw || 0,
        away: consensusOdds.away || 0,
      }
      apiMatch.odds.consensus = apiMatch.odds.novig_current // Alternative field name
    }
    if (allBookmakers) {
      apiMatch.odds.books = allBookmakers
    }
  }

  // Add model predictions
  if (v1Model || v2Model) {
    apiMatch.models = {}
    if (v1Model) {
      apiMatch.models.v1_consensus = {
        pick: v1Model.pick || null,
        confidence: v1Model.confidence || 0,
        probs: v1Model.probs || null,
      }
    }
    if (v2Model) {
      apiMatch.models.v2_lightgbm = {
        pick: v2Model.pick || null,
        confidence: v2Model.confidence || 0,
        probs: v2Model.probs || null,
      }
    }

    // Also add predictions format (alternative)
    apiMatch.predictions = {}
    if (v1Model) {
      apiMatch.predictions.v1 = {
        pick: v1Model.pick || null,
        confidence: v1Model.confidence || 0,
        probs: v1Model.probs || null,
      }
    }
    if (v2Model) {
      apiMatch.predictions.v2 = {
        pick: v2Model.pick || null,
        confidence: v2Model.confidence || 0,
        probs: v2Model.probs || null,
      }
    }
  }

  // Add live match data (if status is LIVE)
  if (match.status === 'LIVE') {
    if (currentScore) {
      apiMatch.score = {
        home: currentScore.home || 0,
        away: currentScore.away || 0,
      }
      apiMatch.live_data = {
        current_score: apiMatch.score,
        minute: match.elapsed || match.minute || null,
        period: match.period || 'Live',
      }
      
      // ✅ FIX: If match is likely finished (more than 2.5 hours old), also set final_result
      // This handles cases where database still says LIVE but match has actually finished
      const kickoffTime = match.kickoffDate.getTime()
      const now = Date.now()
      const hoursSinceKickoff = (now - kickoffTime) / (1000 * 60 * 60)
      const likelyFinished = hoursSinceKickoff > 2.5 // More than 2.5 hours = likely finished
      
      if (likelyFinished && !finalResult) {
        console.log(`[Transform] ⚠️ Match ${match.matchId} is LIVE in DB but likely finished (${hoursSinceKickoff.toFixed(2)}h old) - creating finalResult from currentScore`)
        apiMatch.final_result = {
          score: {
            home: currentScore.home ?? 0,
            away: currentScore.away ?? 0
          },
          outcome: (currentScore.home ?? 0) > (currentScore.away ?? 0) ? 'home' : 
                   (currentScore.away ?? 0) > (currentScore.home ?? 0) ? 'away' : 'draw',
          outcome_text: (currentScore.home ?? 0) > (currentScore.away ?? 0) ? 'Home Win' : 
                       (currentScore.away ?? 0) > (currentScore.home ?? 0) ? 'Away Win' : 'Draw'
        }
        // Also update status to finished since it's likely finished
        apiMatch.status = 'finished'
      }
    }
    if (match.elapsed !== null || match.minute !== null) {
      apiMatch.minute = match.elapsed || match.minute
      apiMatch.elapsed = match.elapsed || match.minute
    }
    if (match.period) {
      apiMatch.period = match.period
    }
    if (match.liveStatistics) {
      apiMatch.live_data = apiMatch.live_data || {}
      apiMatch.live_data.statistics = match.liveStatistics
      apiMatch.statistics = match.liveStatistics // Alternative field name
    }
    if (momentum) {
      apiMatch.momentum = momentum
    }
    if (modelMarkets) {
      apiMatch.model_markets = modelMarkets
    }
    if (aiAnalysis) {
      apiMatch.ai_analysis = aiAnalysis
    }
  }

  // Add finished match data (if status is FINISHED)
  // ✅ PRIORITY: Always use finalResult from database for FINISHED matches
  if (match.status === 'FINISHED') {
    console.log(`[Transform] 🔍 Processing FINISHED match ${match.matchId}`, {
      hasFinalResult: !!finalResult,
      finalResultType: typeof finalResult,
      finalResultValue: finalResult,
      finalResultKeys: finalResult ? Object.keys(finalResult) : null,
      hasCurrentScore: !!currentScore,
      currentScoreValue: currentScore
    })
    
    if (finalResult) {
      // ✅ Direct read from marketMatch.finalResult - format: {"score":{"away":1,"home":1},"outcome":"D","outcome_text":"Draw"}
      apiMatch.final_result = finalResult
      
      // Extract score from finalResult.score (nested structure)
      // Handle multiple possible score locations in finalResult
      const scoreFromFinalResult = finalResult.score || 
                                   finalResult.final_score ||
                                   (finalResult.home !== undefined && finalResult.away !== undefined ? 
                                     { home: finalResult.home, away: finalResult.away } : null)
      
      if (scoreFromFinalResult) {
        apiMatch.score = scoreFromFinalResult
        console.log(`[Transform] ✅ Using finalResult.score for FINISHED match ${match.matchId}:`, {
          score: scoreFromFinalResult,
          source: finalResult.score ? 'finalResult.score' : 
                  finalResult.final_score ? 'finalResult.final_score' : 
                  'finalResult.home/away'
        })
      } else {
        console.warn(`[Transform] ⚠️ finalResult exists but no score found in any format for match ${match.matchId}`, {
          finalResult: finalResult,
          finalResultKeys: Object.keys(finalResult)
        })
        // Still set final_result even if score is missing
      }
    } else {
      // Fallback: Try to get score from currentScore if finalResult is missing
      // This handles edge cases where score was stored but finalResult wasn't created
      if (currentScore && (currentScore.home !== undefined || currentScore.away !== undefined)) {
        console.log(`[Transform] Using currentScore as fallback for FINISHED match ${match.matchId}`, {
          currentScore: currentScore
        })
        const homeScore = currentScore.home ?? 0
        const awayScore = currentScore.away ?? 0
        apiMatch.final_result = {
          score: {
            home: homeScore,
            away: awayScore
          },
          outcome: homeScore > awayScore ? 'home' : 
                   awayScore > homeScore ? 'away' : 'draw',
          outcome_text: homeScore > awayScore ? 'Home Win' : 
                       awayScore > homeScore ? 'Away Win' : 'Draw'
        }
        apiMatch.score = apiMatch.final_result.score
      } else {
        console.warn(`[Transform] ⚠️ No finalResult or currentScore for FINISHED match ${match.matchId}`, {
          hasFinalResult: !!finalResult,
          hasCurrentScore: !!currentScore,
          matchId: match.matchId,
          status: match.status
        })
      }
    }
    
    // Log final state
    console.log(`[Transform] 📊 Final state for FINISHED match ${match.matchId}:`, {
      hasFinalResult: !!apiMatch.final_result,
      hasScore: !!apiMatch.score,
      finalResult: apiMatch.final_result,
      score: apiMatch.score
    })
    if (matchStatistics) {
      apiMatch.match_statistics = matchStatistics
      apiMatch.statistics = matchStatistics // Alternative field name
    }
    if (match.venue) {
      apiMatch.venue = match.venue
    }
    if (match.referee) {
      apiMatch.referee = match.referee
    }
    if (match.attendance) {
      apiMatch.attendance = match.attendance
    }
  }

  // Add raw API data if available (for debugging/completeness)
  if (match.rawApiData) {
    // Merge raw data, but prioritize transformed fields
    const rawData = match.rawApiData as any
    // Only merge fields that weren't already set
    Object.keys(rawData).forEach((key) => {
      if (!apiMatch[key] && key !== 'id' && key !== 'match_id') {
        apiMatch[key] = rawData[key]
      }
    })
  }

  return apiMatch
}

/**
 * Transform array of MarketMatch records to API response format
 */
export function transformMarketMatchesToApiResponse(
  matches: MarketMatch[],
  totalCount?: number
): { matches: any[]; total_count: number } {
  return {
    matches: matches.map(transformMarketMatchToApiFormat),
    total_count: totalCount ?? matches.length,
  }
}

