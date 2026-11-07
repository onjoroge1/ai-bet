/**
 * WhatsApp Multisport Picks — fetch, format, and display NBA/NFL/NHL picks
 * Mirrors lib/whatsapp-picks.ts but for binary-outcome sports (no draw).
 *
 * Data comes from MultisportMatch rows written by pipeline/. During the cold
 * start a row carries market odds but `model` is null — we say so instead of
 * inventing a pick.
 */

import prisma from '@/lib/db'
import { ACTIVE_MULTISPORT_KEYS, MULTISPORT, isMultisportKey } from '@/lib/multisport/sports'

// ─── Sport Configuration ────────────────────────────────────────────────────

/** short code ('nba' | 'nfl' | 'nhl') → { key, name, emoji }; drives the WhatsApp commands. */
export const SPORT_CONFIG: Record<string, { key: string; name: string; emoji: string }> = Object.fromEntries(
  ACTIVE_MULTISPORT_KEYS.map(k => [MULTISPORT[k].slug, { key: k, name: MULTISPORT[k].name, emoji: MULTISPORT[k].emoji }])
)

const DEFAULT_SHORT = MULTISPORT.basketball_nba.slug

function shortFor(sportKey: string | undefined): string {
  if (sportKey && isMultisportKey(sportKey)) return MULTISPORT[sportKey].slug
  return DEFAULT_SHORT
}

function configFor(sportKey: string | undefined) {
  return SPORT_CONFIG[shortFor(sportKey)] || SPORT_CONFIG[DEFAULT_SHORT]
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
  /** False during the cold start (row published with market data only). */
  hasModel: boolean
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

/**
 * Fetch multisport picks from the database (MultisportMatch table).
 */
export async function getMultisportPicks(
  sportKey: string,
  limit: number = 20
): Promise<MultisportWhatsAppPick[]> {
  try {
    const dbMatches = await prisma.multisportMatch.findMany({
      where: {
        sport: sportKey,
        status: 'upcoming',
        commenceTime: { gte: new Date() },
      },
      orderBy: { commenceTime: 'asc' },
      take: limit,
    })
    return dbMatches.map(m => transformDBMatch(m))
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

export function transformDBMatch(m: any): MultisportWhatsAppPick {
  const odds = (m.odds as any) || {}
  const consensus = odds.consensus || odds
  const model = (m.model as any) || null
  const predictions = model ? (model.predictions || model) : {}
  const config = configFor(m.sport)

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
    hasModel: !!model && predictions.pick != null,
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format a single multisport pick for WhatsApp display.
 */
export function formatMultisportPick(pick: MultisportWhatsAppPick, index?: number): string {
  const config = configFor(pick.sportKey)
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

  if (pick.hasModel && pick.model.pick) {
    // Model pick
    const pickTeam = pick.model.pick === 'H' ? pick.homeTeam : pick.awayTeam
    const conf = pick.model.confidence
      ? `${Math.round(pick.model.confidence * 100)}%`
      : '—'
    const tier = pick.model.convictionTier
      ? ` | ${pick.model.convictionTier.charAt(0).toUpperCase() + pick.model.convictionTier.slice(1)}`
      : ''
    lines.push(`📊 Pick: ${pickTeam}`)
    lines.push(`💡 Confidence: ${conf}${tier}`)

    // Model probabilities
    if (pick.model.homeWin && pick.model.awayWin) {
      const hPct = Math.round(pick.model.homeWin * 100)
      const aPct = Math.round(pick.model.awayWin * 100)
      lines.push(`📈 ${pick.homeTeam}: ${hPct}% | ${pick.awayTeam}: ${aPct}%`)
    }
  } else {
    // Cold start: no trained model for this sport yet — show the market line, no pick.
    lines.push(`📊 Market line only — no ${config.name} model pick yet`)
    if (pick.odds.homeProb != null && pick.odds.awayProb != null) {
      const hPct = Math.round(pick.odds.homeProb * 100)
      const aPct = Math.round(pick.odds.awayProb * 100)
      lines.push(`📈 Market: ${pick.homeTeam} ${hPct}% | ${pick.awayTeam} ${aPct}%`)
    }
  }

  // Spread (relative to the picked side when there is one, else the home team)
  if (pick.odds.homeSpread != null) {
    const homeSide = !pick.hasModel || pick.model.pick !== 'A'
    const spreadTeam = homeSide ? pick.homeTeam : pick.awayTeam
    const spreadVal = homeSide ? pick.odds.homeSpread : -(pick.odds.homeSpread)
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
  const config = SPORT_CONFIG[sportShortKey] || SPORT_CONFIG[DEFAULT_SHORT]
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

  if (displayPicks.every(p => !p.hasModel)) {
    lines.push('')
    lines.push(`ℹ️ Our ${config.name} model is still training — showing market lines, no picks yet.`)
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
  const result = lines.join('\n')
  if (result.length > 4000 && displayPicks.length > 1) {
    return formatMultisportPicksList(picks, sportShortKey, displayPicks.length - 1, isVIP)
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
  const config = configFor(pick.sportKey)
  const separator = '─'.repeat(28)
  const lines: string[] = []

  lines.push(`${config.emoji} ${pick.homeTeam} vs ${pick.awayTeam}`)
  lines.push(`🏆 ${pick.league}`)
  lines.push(separator)

  // Basic pick info
  lines.push(formatMultisportPick(pick))
  lines.push(separator)

  // Prediction data (pipeline predictionData payload)
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
      if (modelInfo.features_used || modelInfo.n_features) {
        lines.push(`Features: ${modelInfo.features_used || modelInfo.n_features}`)
      }
      const samples = modelInfo.n_training_samples ?? modelInfo.n_samples
      if (samples) {
        lines.push(`Training samples: ${Number(samples).toLocaleString()}`)
      }
    }

    // Honesty block
    const track = predictionData.model_track_record
    if (track) {
      lines.push('')
      lines.push(track.edge_validated
        ? '✅ Edge validated vs the market on a temporal holdout'
        : `⚠️ No demonstrated edge yet${track.validation ? ` — ${track.validation}` : ''}`)
    }

    // Value bet (only when the pipeline's gate allows it)
    const vb = predictionData.value?.value_bet
    if (vb && track?.edge_validated) {
      lines.push('')
      lines.push(`💎 Value: ${vb.bet === 'home_win' ? pick.homeTeam : pick.awayTeam} at ${vb.price}${vb.book ? ` (${vb.book})` : ''} — EV +${Math.round(vb.ev * 100)}%`)
      lines.push(`   Min acceptable odds: ${vb.min_acceptable_odds}`)
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
