/**
 * WhatsApp Multisport Picks — fetch, format, and display NBA/NHL/NCAAB picks
 * Mirrors lib/whatsapp-picks.ts but for binary-outcome sports (no draw).
 */

import prisma from '@/lib/db'

// ─── Sport Configuration ────────────────────────────────────────────────────

export const SPORT_CONFIG: Record<string, { key: string; name: string; emoji: string }> = {
  nba:   { key: 'basketball_nba',   name: 'NBA',   emoji: '🏀' },
  nhl:   { key: 'icehockey_nhl',    name: 'NHL',   emoji: '🏒' },
  ncaab: { key: 'basketball_ncaab', name: 'NCAAB', emoji: '🏀' },
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MultisportWhatsAppPick {
  eventId: string
  sportKey: string
  sportName: string
  homeTeam: string
  awayTeam: string
  league: string
  commenceTime: string
  odds: {
    homeOdds?: number | null
    awayOdds?: number | null
    homeProb?: number | null
    awayProb?: number | null
    homeSpread?: number | null
    totalLine?: number | null
    overOdds?: number | null
    underOdds?: number | null
    bookCount?: number | null
  }
  model: {
    pick?: string | null      // "H" or "A"
    confidence?: number | null
    convictionTier?: string | null  // "premium", "strong", "standard"
    homeWin?: number | null
    awayWin?: number | null
    edgeVsMarket?: number | null
  }
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

/**
 * Fetch multisport picks from the database (MultisportMatch table).
 * Falls back to the internal API if DB is empty.
 */
export async function getMultisportPicks(
  sportKey: string,
  limit: number = 20
): Promise<MultisportWhatsAppPick[]> {
  try {
    // Try DB first (faster, no network call)
    const dbMatches = await prisma.multisportMatch.findMany({
      where: {
        sport: sportKey,
        status: 'upcoming',
        commenceTime: { gte: new Date() },
      },
      orderBy: { commenceTime: 'asc' },
      take: limit,
    })

    if (dbMatches.length > 0) {
      return dbMatches.map(m => transformDBMatch(m))
    }

    // Fallback: fetch from internal API
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/multisport/market?sport=${sportKey}&status=upcoming&limit=${limit}`, {
      next: { revalidate: 0 },
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      console.error(`[WhatsApp Multisport] API error: ${res.status}`)
      return []
    }

    const data = await res.json() as { matches?: any[] }
    const matches = data.matches || []

    return matches.map((m: any) => transformAPIMatch(m, sportKey))
  } catch (error) {
    console.error('[WhatsApp Multisport] Error fetching picks:', error)
    return []
  }
}

/**
 * Fetch a single multisport pick by event ID (searches across all sports).
 */
export async function getMultisportPickByEventId(
  eventId: string
): Promise<MultisportWhatsAppPick | null> {
  try {
    const match = await prisma.multisportMatch.findFirst({
      where: { eventId },
    })

    if (!match) return null
    return transformDBMatch(match)
  } catch (error) {
    console.error('[WhatsApp Multisport] Error fetching pick by eventId:', error)
    return null
  }
}

// ─── Data Transformers ──────────────────────────────────────────────────────

function transformDBMatch(m: any): MultisportWhatsAppPick {
  const odds = (m.odds as any) || {}
  const consensus = odds.consensus || odds
  const model = (m.model as any) || {}
  const predictions = model.predictions || model

  const sportShort = m.sport?.includes('nba') ? 'nba'
    : m.sport?.includes('nhl') ? 'nhl'
    : m.sport?.includes('ncaab') ? 'ncaab'
    : 'nba'

  const config = SPORT_CONFIG[sportShort] || SPORT_CONFIG.nba

  return {
    eventId: m.eventId,
    sportKey: m.sport,
    sportName: config.name,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    league: m.league || config.name,
    commenceTime: m.commenceTime?.toISOString?.() || m.commenceTime,
    odds: {
      homeOdds: consensus.home_odds ?? null,
      awayOdds: consensus.away_odds ?? null,
      homeProb: consensus.home_prob ?? null,
      awayProb: consensus.away_prob ?? null,
      homeSpread: consensus.home_spread ?? null,
      totalLine: consensus.total_line ?? null,
      overOdds: consensus.over_odds ?? null,
      underOdds: consensus.under_odds ?? null,
      bookCount: consensus.n_bookmakers ?? odds.book_count ?? null,
    },
    model: {
      pick: predictions.pick ?? null,
      confidence: predictions.confidence ?? null,
      convictionTier: predictions.conviction_tier ?? null,
      homeWin: predictions.home_win ?? null,
      awayWin: predictions.away_win ?? null,
      edgeVsMarket: predictions.edge_vs_market ?? null,
    },
  }
}

function transformAPIMatch(m: any, sportKey: string): MultisportWhatsAppPick {
  const consensus = m.odds?.consensus || {}
  const model = m.model?.predictions || m.model || {}
  const sportShort = sportKey.includes('nba') ? 'nba'
    : sportKey.includes('nhl') ? 'nhl'
    : sportKey.includes('ncaab') ? 'ncaab'
    : 'nba'
  const config = SPORT_CONFIG[sportShort] || SPORT_CONFIG.nba

  return {
    eventId: m.event_id,
    sportKey,
    sportName: config.name,
    homeTeam: m.home?.name || 'Home',
    awayTeam: m.away?.name || 'Away',
    league: m.league?.name || config.name,
    commenceTime: m.commence_time,
    odds: {
      homeOdds: consensus.home_odds ?? null,
      awayOdds: consensus.away_odds ?? null,
      homeProb: consensus.home_prob ?? null,
      awayProb: consensus.away_prob ?? null,
      homeSpread: consensus.home_spread ?? null,
      totalLine: consensus.total_line ?? null,
      overOdds: consensus.over_odds ?? null,
      underOdds: consensus.under_odds ?? null,
      bookCount: consensus.n_bookmakers ?? m.odds?.book_count ?? null,
    },
    model: {
      pick: model.pick ?? null,
      confidence: model.confidence ?? null,
      convictionTier: model.conviction_tier ?? null,
      homeWin: model.home_win ?? null,
      awayWin: model.away_win ?? null,
      edgeVsMarket: model.edge_vs_market ?? null,
    },
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format a single multisport pick for WhatsApp display.
 */
export function formatMultisportPick(pick: MultisportWhatsAppPick, index?: number): string {
  const config = Object.values(SPORT_CONFIG).find(c => c.key === pick.sportKey) || SPORT_CONFIG.nba
  const lines: string[] = []

  // Header
  const num = index !== undefined ? `${index + 1}) ` : ''
  lines.push(`${num}${pick.homeTeam} vs ${pick.awayTeam}`)
  lines.push('')

  // Sport & League — use sport name if league is a raw key like "basketball_nba"
  const displayLeague = pick.league.includes('_') ? config.name : pick.league
  lines.push(`${config.emoji} ${displayLeague}`)

  // Time
  if (pick.commenceTime) {
    try {
      const d = new Date(pick.commenceTime)
      const formatted = d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York',
      })
      lines.push(`📅 ${formatted} ET`)
    } catch {
      lines.push(`📅 ${pick.commenceTime}`)
    }
  }

  // Model pick
  if (pick.model.pick) {
    const pickTeam = pick.model.pick === 'H' ? pick.homeTeam : pick.awayTeam
    const conf = pick.model.confidence
      ? `${Math.round(pick.model.confidence * 100)}%`
      : '—'
    const tier = pick.model.convictionTier
      ? ` | ${pick.model.convictionTier.charAt(0).toUpperCase() + pick.model.convictionTier.slice(1)}`
      : ''
    lines.push(`📊 Pick: ${pickTeam}`)
    lines.push(`💡 Confidence: ${conf}${tier}`)
  }

  // Probabilities
  if (pick.model.homeWin && pick.model.awayWin) {
    const hPct = Math.round(pick.model.homeWin * 100)
    const aPct = Math.round(pick.model.awayWin * 100)
    lines.push(`📈 ${pick.homeTeam}: ${hPct}% | ${pick.awayTeam}: ${aPct}%`)
  }

  // Spread
  if (pick.odds.homeSpread != null) {
    const spreadTeam = pick.model.pick === 'H' ? pick.homeTeam : pick.awayTeam
    const spreadVal = pick.model.pick === 'H' ? pick.odds.homeSpread : -(pick.odds.homeSpread)
    const sign = spreadVal > 0 ? '+' : ''
    lines.push(`📏 Spread: ${spreadTeam} ${sign}${spreadVal}`)
  }

  // Over/Under
  if (pick.odds.totalLine != null) {
    lines.push(`🎯 O/U: ${pick.odds.totalLine}`)
  }

  // Moneyline odds
  if (pick.odds.homeOdds && pick.odds.awayOdds) {
    lines.push(`💰 ML: ${pick.homeTeam} ${formatOdds(pick.odds.homeOdds)} | ${pick.awayTeam} ${formatOdds(pick.odds.awayOdds)}`)
  }

  return lines.join('\n')
}

/**
 * Format a list of multisport picks with header, footer, and upsell.
 */
export function formatMultisportPicksList(
  picks: MultisportWhatsAppPick[],
  sportShortKey: string,
  limit?: number,
  isVIP: boolean = false
): string {
  const config = SPORT_CONFIG[sportShortKey] || SPORT_CONFIG.nba
  const displayPicks = limit ? picks.slice(0, limit) : picks
  const separator = '─'.repeat(28)

  const lines: string[] = []

  // Header
  lines.push(`${config.emoji} TODAY'S ${config.name} PICKS`)
  lines.push(`snapbet.ai/sports`)
  lines.push(separator)

  if (displayPicks.length === 0) {
    lines.push('')
    lines.push(`No ${config.name} games found right now.`)
    lines.push(`Check back closer to game time!`)
    lines.push('')
    lines.push(`⚽ Soccer picks available! Send PICKS`)
    return lines.join('\n')
  }

  // Picks
  for (let i = 0; i < displayPicks.length; i++) {
    lines.push('')
    lines.push(formatMultisportPick(displayPicks[i], i))
    if (i < displayPicks.length - 1) {
      lines.push(separator)
    }
  }

  // Footer
  lines.push('')
  lines.push(separator)

  if (picks.length > displayPicks.length) {
    lines.push(`📋 Showing ${displayPicks.length} of ${picks.length} games`)
  }

  // Upsell
  if (!isVIP) {
    lines.push('')
    lines.push(`⭐ Want full analysis? Send ${config.name} VIP`)
  }

  // Cross-sport discovery
  const otherSports = Object.entries(SPORT_CONFIG)
    .filter(([k]) => k !== sportShortKey)
    .map(([, v]) => v.name)
  lines.push('')
  lines.push(`⚽ Soccer? Send PICKS`)
  lines.push(`${otherSports.map(s => `Send ${s}`).join(' | ')}`)

  // Ensure under 4096 chars
  let result = lines.join('\n')
  while (result.length > 4000 && displayPicks.length > 1) {
    displayPicks.pop()
    return formatMultisportPicksList(picks.slice(0, displayPicks.length), sportShortKey, displayPicks.length, isVIP)
  }

  return result
}

/**
 * Format VIP analysis for a single multisport pick (detailed view).
 */
export function formatMultisportVIPAnalysis(
  pick: MultisportWhatsAppPick,
  predictionData?: any
): string {
  const config = Object.values(SPORT_CONFIG).find(c => c.key === pick.sportKey) || SPORT_CONFIG.nba
  const separator = '─'.repeat(28)
  const lines: string[] = []

  lines.push(`${config.emoji} ${pick.homeTeam} vs ${pick.awayTeam}`)
  lines.push(`🏆 ${pick.league}`)
  lines.push(separator)

  // Basic pick info
  lines.push(formatMultisportPick(pick))
  lines.push(separator)

  // Prediction data (from /predict-multisport endpoint)
  if (predictionData) {
    // Team context
    const teamCtx = predictionData.team_context
    if (teamCtx) {
      lines.push('')
      lines.push('📊 **TEAM CONTEXT**')

      if (teamCtx.home) {
        const homeForm = Array.isArray(teamCtx.home.recent_form)
          ? teamCtx.home.recent_form.join('')
          : ''
        const homeRecord = teamCtx.home.season_stats
          ? `${teamCtx.home.season_stats.wins}W-${teamCtx.home.season_stats.losses}L`
          : ''
        lines.push(`🏠 ${pick.homeTeam}: ${homeForm} (${homeRecord})`)
        if (teamCtx.home.season_stats?.home_record) {
          lines.push(`   Home: ${teamCtx.home.season_stats.home_record}`)
        }
      }

      if (teamCtx.away) {
        const awayForm = Array.isArray(teamCtx.away.recent_form)
          ? teamCtx.away.recent_form.join('')
          : ''
        const awayRecord = teamCtx.away.season_stats
          ? `${teamCtx.away.season_stats.wins}W-${teamCtx.away.season_stats.losses}L`
          : ''
        lines.push(`✈️ ${pick.awayTeam}: ${awayForm} (${awayRecord})`)
        if (teamCtx.away.season_stats?.away_record) {
          lines.push(`   Away: ${teamCtx.away.season_stats.away_record}`)
        }
      }
    }

    // Model info
    const modelInfo = predictionData.model_info
    if (modelInfo) {
      lines.push('')
      lines.push('🤖 **MODEL INFO**')
      if (modelInfo.accuracy) {
        lines.push(`Accuracy: ${Math.round(modelInfo.accuracy * 100)}%`)
      }
      if (modelInfo.features_used) {
        lines.push(`Features: ${modelInfo.features_used}`)
      }
      if (modelInfo.n_training_samples) {
        lines.push(`Training samples: ${modelInfo.n_training_samples.toLocaleString()}`)
      }
    }

    // Edge vs market
    if (pick.model.edgeVsMarket) {
      lines.push('')
      const edgePct = Math.round(Math.abs(pick.model.edgeVsMarket) * 100)
      const edgeDir = pick.model.edgeVsMarket > 0 ? 'above' : 'below'
      lines.push(`📈 Edge: Model is ${edgePct}% ${edgeDir} market`)
    }
  }

  lines.push('')
  lines.push(separator)
  lines.push(`snapbet.ai/sports/${config.key}`)
  lines.push('⚠️ Bet responsibly. Not financial advice.')

  // Truncate if needed
  let result = lines.join('\n')
  if (result.length > 4000) {
    result = result.substring(0, 3997) + '...'
  }

  return result
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatOdds(decimal: number): string {
  if (decimal >= 2) {
    return `+${Math.round((decimal - 1) * 100)}`
  } else {
    return `${Math.round(-100 / (decimal - 1))}`
  }
}
