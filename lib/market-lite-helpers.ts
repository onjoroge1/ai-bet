/**
 * Helper functions for Lite Mode Market API
 * Handles transformation and merging of lite data
 */

import { MarketMatch } from '@prisma/client'

/**
 * Transform external API lite response to our database format
 */
export function transformLiteMatchToDatabaseFormat(liteMatch: any): Partial<MarketMatch> {
  const matchId = String(liteMatch.match_id || liteMatch.id || '')
  
  if (!matchId || matchId === 'undefined' || matchId === 'null') {
    return {}
  }

  const status = (liteMatch.status || 'UPCOMING').toUpperCase()
  const normalizedStatus = status === 'LIVE' ? 'LIVE' : 
                          status === 'FINISHED' || status === 'COMPLETED' ? 'FINISHED' : 
                          'UPCOMING'

  const data: Partial<MarketMatch> = {
    matchId,
    status: normalizedStatus,
    homeTeam: liteMatch.home?.name || 'Home Team',
    homeTeamId: liteMatch.home?.id ? String(liteMatch.home.id) : null,
    homeTeamLogo: liteMatch.home?.logo_url || null,
    awayTeam: liteMatch.away?.name || 'Away Team',
    awayTeamId: liteMatch.away?.id ? String(liteMatch.away.id) : null,
    awayTeamLogo: liteMatch.away?.logo_url || null,
    league: liteMatch.league?.name || 'Unknown League',
    leagueId: liteMatch.league?.id ? String(liteMatch.league.id) : null,
    leagueCountry: liteMatch.league?.country || null,
    kickoffDate: liteMatch.kickoff_at ? new Date(liteMatch.kickoff_at) : new Date(),
    lastSyncedAt: new Date(),
  }

  // Add live match data if status is LIVE
  if (normalizedStatus === 'LIVE' && liteMatch.score) {
    data.currentScore = {
      home: liteMatch.score.home || 0,
      away: liteMatch.score.away || 0
    }
    data.liveScore = data.currentScore
    data.elapsed = liteMatch.elapsed?.minute || liteMatch.elapsed || null
    data.minute = data.elapsed
    data.period = liteMatch.elapsed?.period || 'Live'
  }

  // Add basic prediction if provided (lite mode has basic prediction)
  if (liteMatch.prediction) {
    const pick = liteMatch.prediction.pick || 'draw'
    const confidence = liteMatch.prediction.confidence || 0
    
    data.modelPredictions = {
      free: {
        side: pick,
        confidence: Math.round(confidence * 100)
      }
    }
  }

  // Add consensus odds if provided
  if (liteMatch.odds?.consensus) {
    data.consensusOdds = {
      home: liteMatch.odds.consensus.home || 0,
      draw: liteMatch.odds.consensus.draw || 0,
      away: liteMatch.odds.consensus.away || 0
    }
  }

  // Store bookmaker names (but not full odds - that's in full mode)
  if (liteMatch.bookmakers && Array.isArray(liteMatch.bookmakers)) {
    data.booksCount = liteMatch.bookmakers.length
    data.primaryBook = liteMatch.bookmakers[0] || null
  }

  return data
}

/**
 * Merge lite data into existing database record
 * Preserves full data fields (allBookmakers, v1Model, v2Model, etc.)
 */
export function mergeLiteDataWithExisting(
  liteData: Partial<MarketMatch>,
  existing: MarketMatch
): Partial<MarketMatch> {
  // Start with existing data
  const merged: Partial<MarketMatch> = {
    ...existing,
  }

  // Update basic fields from lite data
  merged.status = liteData.status || existing.status
  merged.homeTeam = liteData.homeTeam || existing.homeTeam
  merged.homeTeamId = liteData.homeTeamId || existing.homeTeamId
  merged.homeTeamLogo = liteData.homeTeamLogo || existing.homeTeamLogo
  merged.awayTeam = liteData.awayTeam || existing.awayTeam
  merged.awayTeamId = liteData.awayTeamId || existing.awayTeamId
  merged.awayTeamLogo = liteData.awayTeamLogo || existing.awayTeamLogo
  merged.league = liteData.league || existing.league
  merged.leagueId = liteData.leagueId || existing.leagueId
  merged.leagueCountry = liteData.leagueCountry || existing.leagueCountry
  merged.kickoffDate = liteData.kickoffDate || existing.kickoffDate

  // Update live match data from lite (if live match)
  if (liteData.status === 'LIVE') {
    if (liteData.currentScore) {
      merged.currentScore = liteData.currentScore
      merged.liveScore = liteData.liveScore
    }
    if (liteData.elapsed !== null && liteData.elapsed !== undefined) {
      merged.elapsed = liteData.elapsed
      merged.minute = liteData.minute
    }
    if (liteData.period) {
      merged.period = liteData.period
    }
  }

  // Smart prediction merge: Update basic prediction but preserve full analysis
  if (liteData.modelPredictions) {
    const existingPredictions = existing.modelPredictions as any
    const litePredictions = liteData.modelPredictions as any
    if (existingPredictions && existingPredictions.free) {
      // Merge: Keep existing full prediction, update basic fields
      merged.modelPredictions = {
        ...existingPredictions,
        free: {
          ...existingPredictions.free,
          // Update basic fields from lite if provided
          side: (litePredictions && typeof litePredictions === 'object' && litePredictions.free?.side) || existingPredictions.free.side,
          confidence: (litePredictions && typeof litePredictions === 'object' && litePredictions.free?.confidence) || existingPredictions.free.confidence
        }
      }
    } else {
      // No existing prediction, use lite prediction
      merged.modelPredictions = liteData.modelPredictions
    }
  }

  // Update consensus odds if provided in lite data
  if (liteData.consensusOdds) {
    merged.consensusOdds = liteData.consensusOdds
  }

  // Update bookmaker count if provided
  if (liteData.booksCount !== null && liteData.booksCount !== undefined) {
    merged.booksCount = liteData.booksCount
  }
  if (liteData.primaryBook) {
    merged.primaryBook = liteData.primaryBook
  }

  // PRESERVE full data fields (don't overwrite)
  // Keep existing: allBookmakers, v1Model, v2Model, liveStatistics, momentum, modelMarkets, aiAnalysis
  merged.allBookmakers = existing.allBookmakers
  merged.v1Model = existing.v1Model
  merged.v2Model = existing.v2Model
  merged.liveStatistics = existing.liveStatistics
  merged.momentum = existing.momentum
  merged.modelMarkets = existing.modelMarkets
  merged.aiAnalysis = existing.aiAnalysis
  merged.matchStatistics = existing.matchStatistics
  merged.finalResult = existing.finalResult

  // Update timestamp
  merged.lastSyncedAt = new Date()
  merged.syncCount = (existing.syncCount || 0) + 1

  return merged
}

/**
 * Transform lite match to API response format (for frontend)
 */
export function transformLiteMatchToApiFormat(liteMatch: any): any {
  const matchId = String(liteMatch.match_id || liteMatch.id || '')
  
  return {
    id: matchId,
    match_id: matchId,
    status: (liteMatch.status || 'UPCOMING').toLowerCase(),
    home: {
      name: liteMatch.home?.name || 'Home Team',
      logo_url: liteMatch.home?.logo_url || null,
      id: liteMatch.home?.id || null,
      team_id: liteMatch.home?.id || null,
    },
    away: {
      name: liteMatch.away?.name || 'Away Team',
      logo_url: liteMatch.away?.logo_url || null,
      id: liteMatch.away?.id || null,
      team_id: liteMatch.away?.id || null,
    },
    league: {
      name: liteMatch.league?.name || 'Unknown League',
      id: liteMatch.league?.id || null,
      country: liteMatch.league?.country || null,
    },
    kickoff_at: liteMatch.kickoff_at || new Date().toISOString(),
    matchDate: liteMatch.kickoff_at || new Date().toISOString(),
    score: liteMatch.score || null,
    elapsed: liteMatch.elapsed?.minute || liteMatch.elapsed || null,
    period: liteMatch.elapsed?.period || null,
    odds: liteMatch.odds?.consensus ? {
      consensus: liteMatch.odds.consensus,
      novig_current: liteMatch.odds.consensus, // Alternative field name
    } : null,
    prediction: liteMatch.prediction ? {
      team: liteMatch.prediction.pick === 'home' ? liteMatch.home?.name :
            liteMatch.prediction.pick === 'away' ? liteMatch.away?.name :
            'Draw',
      confidence: Math.round((liteMatch.prediction.confidence || 0) * 100),
      isPremium: false, // Lite mode doesn't include premium predictions
    } : null,
    bookmakers: liteMatch.bookmakers || [],
  }
}

