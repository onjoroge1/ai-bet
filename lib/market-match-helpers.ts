/**
 * Helper functions for MarketMatch database integration
 * Transforms MarketMatch records to match external API response format
 */

import { MarketMatch } from '@prisma/client'

// Data freshness thresholds (in milliseconds)
const LIVE_MAX_AGE = 30 * 1000 // 30 seconds for live matches
const UPCOMING_MAX_AGE = 10 * 60 * 1000 // 10 minutes for upcoming matches
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
  const finalResult = match.finalResult as any
  const matchStatistics = match.matchStatistics as any

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
  if (match.status === 'FINISHED') {
    if (finalResult) {
      apiMatch.final_result = finalResult
      // Also add score from finalResult if available
      if (finalResult.score) {
        apiMatch.score = finalResult.score
      }
    }
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

