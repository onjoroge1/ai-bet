import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

interface MarketData {
  dnb?: { home: number; away: number }
  btts?: { yes: number; no: number }
  totals?: Record<string, { over: number; under: number }>
  asian_handicap?: {
    home?: Record<string, { win: number; lose: number; push?: number }>
    away?: Record<string, { win: number; lose: number; push?: number }>
  }
  double_chance?: { "12": number; "1X": number; "X2": number }
  win_to_nil?: { home: number; away: number }
  clean_sheet?: { home: number; away: number }
  team_totals?: {
    home?: Record<string, { over: number; under: number }>
    away?: Record<string, { over: number; under: number }>
  }
  winning_margin?: Record<string, number>
  odd_even_total?: { odd: number; even: number }
}

interface PredictionData {
  predicted_winner?: string // "H", "D", "A"
  confidence_score?: number
  additional_markets_v2?: MarketData
  // V1 fields
  home_win_prob?: number
  draw_prob?: number
  away_win_prob?: number
}

interface SGPLeg {
  market: string
  side: string
  probability: number
  description: string
  outcome: string
  /** Tags for logical grouping: e.g. ["home_scores", "high_scoring"] */
  tags: string[]
}

interface SGP {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: Date
  legs: SGPLeg[]
  combinedProb: number
  fairOdds: number
  confidence: 'high' | 'medium' | 'low'
  narrative: string // e.g. "Home Dominant", "High-Scoring Draw", etc.
}

// ────────────────────────────────────────────────────────────────────────────
// Contradiction rules: pairs of tags that CANNOT coexist in the same parlay
// ────────────────────────────────────────────────────────────────────────────
const CONTRADICTIONS: [string, string][] = [
  // Win-to-Nil means the winner doesn't concede → incompatible with BTTS Yes
  ['home_clean_sheet', 'btts_yes'],
  ['away_clean_sheet', 'btts_yes'],
  ['home_win_to_nil', 'btts_yes'],
  ['away_win_to_nil', 'btts_yes'],

  // Clean sheet means 0 goals conceded → incompatible with opponent scoring
  ['home_clean_sheet', 'away_scores'],
  ['away_clean_sheet', 'home_scores'],

  // Win-to-Nil HOME means away scores 0 → incompatible with away scoring
  ['home_win_to_nil', 'away_scores'],
  ['away_win_to_nil', 'home_scores'],

  // Under 0.5 total means 0 goals → incompatible with any scoring
  ['under_0_5', 'btts_yes'],
  ['under_0_5', 'home_scores'],
  ['under_0_5', 'away_scores'],
  ['under_0_5', 'over_1_5'],
  ['under_0_5', 'over_2_5'],
  ['under_0_5', 'over_3_5'],
  ['under_0_5', 'over_4_5'],

  // Under 1.5 total (max 1 goal) → incompatible with BTTS Yes (needs ≥2 goals)
  ['under_1_5', 'btts_yes'],
  ['under_1_5', 'over_2_5'],
  ['under_1_5', 'over_3_5'],
  ['under_1_5', 'over_4_5'],

  // Under 2.5 vs Over 2.5+
  ['under_2_5', 'over_2_5'],
  ['under_2_5', 'over_3_5'],
  ['under_2_5', 'over_4_5'],

  // Under 3.5 vs Over 3.5+
  ['under_3_5', 'over_3_5'],
  ['under_3_5', 'over_4_5'],

  // Under 4.5 vs Over 4.5
  ['under_4_5', 'over_4_5'],

  // BTTS No + high-scoring expectations
  ['btts_no', 'over_3_5'],
  ['btts_no', 'over_4_5'],

  // DNB HOME vs Double Chance X2 (contradictory pick directions)
  ['dnb_home', 'dc_x2'],
  // DNB AWAY vs Double Chance 1X
  ['dnb_away', 'dc_1x'],

  // Home team totals contradictions
  ['home_under_0_5', 'home_scores'],
  ['away_under_0_5', 'away_scores'],

  // Team total over vs clean sheet
  ['home_over_0_5', 'away_clean_sheet'],
  ['home_over_1_5', 'away_clean_sheet'],
  ['away_over_0_5', 'home_clean_sheet'],
  ['away_over_1_5', 'home_clean_sheet'],
]

// Pre-build a fast lookup set
const CONTRADICTION_SET = new Set(CONTRADICTIONS.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]))

/**
 * Check if two sets of tags contain a contradiction
 */
function hasContradiction(tags1: string[], tags2: string[]): boolean {
  for (const t1 of tags1) {
    for (const t2 of tags2) {
      if (CONTRADICTION_SET.has(`${t1}|${t2}`)) return true
    }
  }
  return false
}

/**
 * Check if adding a new leg to existing legs creates a contradiction
 */
function hasAnyContradiction(existingLegs: SGPLeg[], newLeg: SGPLeg): boolean {
  for (const existing of existingLegs) {
    if (hasContradiction(existing.tags, newLeg.tags)) return true
  }
  return false
}

// ────────────────────────────────────────────────────────────────────────────
// Narrative templates: coherent stories for parlay combinations
// ────────────────────────────────────────────────────────────────────────────
interface NarrativeTemplate {
  name: string
  description: string
  /** Required tag patterns — at least one leg must match each entry */
  requiredPatterns: string[][]
  /** Boost factor (1.0 = neutral, 1.1 = +10% quality) */
  boost: number
}

const NARRATIVES: NarrativeTemplate[] = [
  {
    name: 'Home Dominant',
    description: 'Strong home win with goals',
    requiredPatterns: [['dnb_home', 'dc_1x'], ['over_1_5', 'over_2_5', 'home_scores']],
    boost: 1.15,
  },
  {
    name: 'Away Upset',
    description: 'Away team wins with clean defense',
    requiredPatterns: [['dnb_away', 'dc_x2'], ['away_scores']],
    boost: 1.10,
  },
  {
    name: 'Goal Fest',
    description: 'High-scoring match expected',
    requiredPatterns: [['over_2_5', 'over_3_5'], ['btts_yes']],
    boost: 1.20,
  },
  {
    name: 'Low Scoring',
    description: 'Tight defensive match',
    requiredPatterns: [['under_2_5', 'under_3_5'], ['btts_no']],
    boost: 1.15,
  },
  {
    name: 'Home Shutout',
    description: 'Home team wins without conceding',
    requiredPatterns: [['dnb_home', 'dc_1x'], ['home_clean_sheet', 'home_win_to_nil']],
    boost: 1.10,
  },
]

/**
 * Determine the narrative for a combination of legs, if any
 */
function matchNarrative(legs: SGPLeg[]): { name: string; boost: number } | null {
  const allTags = new Set(legs.flatMap(l => l.tags))

  for (const narrative of NARRATIVES) {
    const matches = narrative.requiredPatterns.every(patterns =>
      patterns.some(tag => allTags.has(tag))
    )
    if (matches) return { name: narrative.name, boost: narrative.boost }
  }

  return null
}

// ────────────────────────────────────────────────────────────────────────────
// Extract potential legs from prediction data
// ────────────────────────────────────────────────────────────────────────────

function extractLegs(
  marketsV2: MarketData,
  match: { homeTeam: string; awayTeam: string },
  prediction: PredictionData,
  minProb: number
): SGPLeg[] {
  const legs: SGPLeg[] = []

  // Determine predicted direction for smart filtering
  const predictedWinner = prediction.predicted_winner // "H", "D", "A"
  const isHomeFavored = predictedWinner === 'H'
  const isAwayFavored = predictedWinner === 'A'

  // DNB (Draw No Bet)
  if (marketsV2.dnb) {
    if (marketsV2.dnb.home >= minProb) {
      legs.push({
        market: 'DNB', side: 'HOME', probability: marketsV2.dnb.home,
        description: `${match.homeTeam} Draw No Bet`, outcome: 'DNB_H',
        tags: ['dnb_home', 'home_favored'],
      })
    }
    if (marketsV2.dnb.away >= minProb) {
      legs.push({
        market: 'DNB', side: 'AWAY', probability: marketsV2.dnb.away,
        description: `${match.awayTeam} Draw No Bet`, outcome: 'DNB_A',
        tags: ['dnb_away', 'away_favored'],
      })
    }
  }

  // Totals
  if (marketsV2.totals) {
    const totalLines = ['0_5', '1_5', '2_5', '3_5', '4_5'] as const
    for (const line of totalLines) {
      const total = marketsV2.totals[line]
      if (!total) continue
      const displayLine = line.replace('_', '.')
      const tagLine = line // "2_5" etc.

      if (total.over >= minProb) {
        const scoringTags = [`over_${tagLine}`]
        if (parseFloat(displayLine) >= 2.5) scoringTags.push('high_scoring')
        legs.push({
          market: 'TOTALS', side: 'OVER', probability: total.over,
          description: `Over ${displayLine} Goals`, outcome: `OVER_${line}`,
          tags: scoringTags,
        })
      }
      if (total.under >= minProb) {
        const scoringTags = [`under_${tagLine}`]
        if (parseFloat(displayLine) <= 2.5) scoringTags.push('low_scoring')
        legs.push({
          market: 'TOTALS', side: 'UNDER', probability: total.under,
          description: `Under ${displayLine} Goals`, outcome: `UNDER_${line}`,
          tags: scoringTags,
        })
      }
    }
  }

  // BTTS (Both Teams to Score)
  if (marketsV2.btts) {
    if (marketsV2.btts.yes >= minProb) {
      legs.push({
        market: 'BTTS', side: 'YES', probability: marketsV2.btts.yes,
        description: 'Both Teams to Score', outcome: 'BTTS_YES',
        tags: ['btts_yes', 'home_scores', 'away_scores', 'high_scoring'],
      })
    }
    if (marketsV2.btts.no >= minProb) {
      legs.push({
        market: 'BTTS', side: 'NO', probability: marketsV2.btts.no,
        description: 'Both Teams NOT to Score', outcome: 'BTTS_NO',
        tags: ['btts_no'],
      })
    }
  }

  // Double Chance
  if (marketsV2.double_chance) {
    if (marketsV2.double_chance['1X'] >= minProb) {
      legs.push({
        market: 'DOUBLE_CHANCE', side: '1X', probability: marketsV2.double_chance['1X'],
        description: `${match.homeTeam} or Draw`, outcome: 'DC_1X',
        tags: ['dc_1x', 'home_favored'],
      })
    }
    if (marketsV2.double_chance['X2'] >= minProb) {
      legs.push({
        market: 'DOUBLE_CHANCE', side: 'X2', probability: marketsV2.double_chance['X2'],
        description: `Draw or ${match.awayTeam}`, outcome: 'DC_X2',
        tags: ['dc_x2', 'away_favored'],
      })
    }
    if (marketsV2.double_chance['12'] >= minProb) {
      legs.push({
        market: 'DOUBLE_CHANCE', side: '12', probability: marketsV2.double_chance['12'],
        description: `${match.homeTeam} or ${match.awayTeam} to Win`, outcome: 'DC_12',
        tags: ['dc_12', 'no_draw'],
      })
    }
  }

  // Win to Nil
  if (marketsV2.win_to_nil) {
    if (marketsV2.win_to_nil.home >= minProb) {
      legs.push({
        market: 'WIN_TO_NIL', side: 'HOME', probability: marketsV2.win_to_nil.home,
        description: `${match.homeTeam} Win to Nil`, outcome: 'WTN_H',
        tags: ['home_win_to_nil', 'home_clean_sheet', 'home_favored'],
      })
    }
    if (marketsV2.win_to_nil.away >= minProb) {
      legs.push({
        market: 'WIN_TO_NIL', side: 'AWAY', probability: marketsV2.win_to_nil.away,
        description: `${match.awayTeam} Win to Nil`, outcome: 'WTN_A',
        tags: ['away_win_to_nil', 'away_clean_sheet', 'away_favored'],
      })
    }
  }

  // Clean Sheet
  if (marketsV2.clean_sheet) {
    if (marketsV2.clean_sheet.home >= minProb) {
      legs.push({
        market: 'CLEAN_SHEET', side: 'HOME', probability: marketsV2.clean_sheet.home,
        description: `${match.homeTeam} Clean Sheet`, outcome: 'CS_H',
        tags: ['home_clean_sheet'],
      })
    }
    if (marketsV2.clean_sheet.away >= minProb) {
      legs.push({
        market: 'CLEAN_SHEET', side: 'AWAY', probability: marketsV2.clean_sheet.away,
        description: `${match.awayTeam} Clean Sheet`, outcome: 'CS_A',
        tags: ['away_clean_sheet'],
      })
    }
  }

  // Team Totals (Home)
  if (marketsV2.team_totals?.home) {
    const lines = ['0_5', '1_5', '2_5'] as const
    for (const line of lines) {
      const total = marketsV2.team_totals.home[line]
      if (!total) continue
      const displayLine = line.replace('_', '.')
      if (total.over >= minProb) {
        legs.push({
          market: 'TEAM_TOTALS', side: 'HOME_OVER', probability: total.over,
          description: `${match.homeTeam} Over ${displayLine} Goals`, outcome: `TT_H_OVER_${line}`,
          tags: [`home_over_${line}`, 'home_scores'],
        })
      }
      if (total.under >= minProb) {
        legs.push({
          market: 'TEAM_TOTALS', side: 'HOME_UNDER', probability: total.under,
          description: `${match.homeTeam} Under ${displayLine} Goals`, outcome: `TT_H_UNDER_${line}`,
          tags: [`home_under_${line}`],
        })
      }
    }
  }

  // Team Totals (Away)
  if (marketsV2.team_totals?.away) {
    const lines = ['0_5', '1_5', '2_5'] as const
    for (const line of lines) {
      const total = marketsV2.team_totals.away[line]
      if (!total) continue
      const displayLine = line.replace('_', '.')
      if (total.over >= minProb) {
        legs.push({
          market: 'TEAM_TOTALS', side: 'AWAY_OVER', probability: total.over,
          description: `${match.awayTeam} Over ${displayLine} Goals`, outcome: `TT_A_OVER_${line}`,
          tags: [`away_over_${line}`, 'away_scores'],
        })
      }
      if (total.under >= minProb) {
        legs.push({
          market: 'TEAM_TOTALS', side: 'AWAY_UNDER', probability: total.under,
          description: `${match.awayTeam} Under ${displayLine} Goals`, outcome: `TT_A_UNDER_${line}`,
          tags: [`away_under_${line}`],
        })
      }
    }
  }

  // Odd/Even Total Goals
  if (marketsV2.odd_even_total) {
    if (marketsV2.odd_even_total.odd >= minProb) {
      legs.push({
        market: 'ODD_EVEN', side: 'ODD', probability: marketsV2.odd_even_total.odd,
        description: 'Odd Total Goals', outcome: 'ODD',
        tags: ['odd_total'],
      })
    }
    if (marketsV2.odd_even_total.even >= minProb) {
      legs.push({
        market: 'ODD_EVEN', side: 'EVEN', probability: marketsV2.odd_even_total.even,
        description: 'Even Total Goals', outcome: 'EVEN',
        tags: ['even_total'],
      })
    }
  }

  // ── Smart filtering: boost legs aligned with predicted winner ─────────
  // Sort by a weighted score: probability * directionBoost
  return legs.map(leg => {
    let directionBoost = 1.0
    if (isHomeFavored && leg.tags.includes('home_favored')) directionBoost = 1.15
    if (isAwayFavored && leg.tags.includes('away_favored')) directionBoost = 1.15
    // If predicting draw, boost no-draw as anti-value
    if (predictedWinner === 'D' && leg.tags.includes('no_draw')) directionBoost = 0.8
    return { ...leg, _score: leg.probability * directionBoost }
  }).sort((a, b) => (b as any)._score - (a as any)._score)
}

// ────────────────────────────────────────────────────────────────────────────
// Main SGP generation
// ────────────────────────────────────────────────────────────────────────────

async function generateSGPs(): Promise<SGP[]> {
  const upcomingMatches = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      kickoffDate: { gte: new Date() },
      isActive: true,
    },
    select: {
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
      kickoffDate: true,
    },
  })

  const upcomingMatchIdSet = new Set(upcomingMatches.map(m => m.matchId))
  const quickPurchases = await prisma.quickPurchase.findMany({
    where: {
      matchId: { in: Array.from(upcomingMatchIdSet) },
      isActive: true,
      isPredictionActive: true,
      predictionData: { not: null },
    },
    select: {
      matchId: true,
      predictionData: true,
    },
  })

  const sgps: SGP[] = []
  const MIN_PROB = 0.55

  for (const qp of quickPurchases) {
    const match = upcomingMatches.find(m => m.matchId === qp.matchId)
    if (!match) continue

    const predictionData = qp.predictionData as PredictionData
    const marketsV2 = predictionData?.additional_markets_v2
    if (!marketsV2) continue

    // Extract all valid legs with tags
    const allLegs = extractLegs(
      marketsV2,
      { homeTeam: match.homeTeam, awayTeam: match.awayTeam },
      predictionData,
      MIN_PROB
    )

    if (allLegs.length < 2) continue

    // Limit to top 12 legs by probability to avoid combinatorial explosion
    const topLegs = allLegs.slice(0, 12)
    const seenCombinations = new Set<string>()

    // ── 2-leg combinations ─────────────────────────────────────────────
    for (let i = 0; i < topLegs.length - 1; i++) {
      for (let j = i + 1; j < topLegs.length; j++) {
        const leg1 = topLegs[i]
        const leg2 = topLegs[j]

        // Skip if same exact outcome
        if (leg1.outcome === leg2.outcome) continue

        // Skip contradictory combinations (tag-based)
        if (hasContradiction(leg1.tags, leg2.tags)) continue

        // Skip same market opposite sides (redundant with tag check, but fast)
        if (leg1.market === leg2.market && leg1.side !== leg2.side) continue

        // Dedup
        const comboKey = [leg1.outcome, leg2.outcome].sort().join('|')
        if (seenCombinations.has(comboKey)) continue
        seenCombinations.add(comboKey)

        const combinedProb = leg1.probability * leg2.probability
        if (combinedProb < 0.15) continue // Skip very unlikely combos

        const narrative = matchNarrative([leg1, leg2])

        sgps.push({
          matchId: match.matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          league: match.league,
          kickoffDate: match.kickoffDate,
          legs: [leg1, leg2],
          combinedProb,
          fairOdds: 1 / combinedProb,
          confidence: combinedProb >= 0.35 ? 'high' : combinedProb >= 0.25 ? 'medium' : 'low',
          narrative: narrative?.name || 'Custom',
        })
      }
    }

    // ── 3-leg combinations ─────────────────────────────────────────────
    // Only use top 8 legs to keep the count manageable
    const topLegs3 = topLegs.slice(0, 8)
    if (topLegs3.length >= 3) {
      for (let i = 0; i < topLegs3.length - 2; i++) {
        for (let j = i + 1; j < topLegs3.length - 1; j++) {
          for (let k = j + 1; k < topLegs3.length; k++) {
            const leg1 = topLegs3[i]
            const leg2 = topLegs3[j]
            const leg3 = topLegs3[k]

            // Skip duplicate outcomes
            if (leg1.outcome === leg2.outcome || leg1.outcome === leg3.outcome || leg2.outcome === leg3.outcome) continue

            // Skip any contradictory pair
            if (hasContradiction(leg1.tags, leg2.tags)) continue
            if (hasContradiction(leg1.tags, leg3.tags)) continue
            if (hasContradiction(leg2.tags, leg3.tags)) continue

            // Skip same market opposite sides
            if (leg1.market === leg2.market && leg1.side !== leg2.side) continue
            if (leg1.market === leg3.market && leg1.side !== leg3.side) continue
            if (leg2.market === leg3.market && leg2.side !== leg3.side) continue

            // Dedup
            const comboKey = [leg1.outcome, leg2.outcome, leg3.outcome].sort().join('|')
            if (seenCombinations.has(comboKey)) continue
            seenCombinations.add(comboKey)

            const combinedProb = leg1.probability * leg2.probability * leg3.probability
            if (combinedProb < 0.10) continue // Skip very unlikely 3-leg combos

            const narrative = matchNarrative([leg1, leg2, leg3])

            sgps.push({
              matchId: match.matchId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              league: match.league,
              kickoffDate: match.kickoffDate,
              legs: [leg1, leg2, leg3],
              combinedProb,
              fairOdds: 1 / combinedProb,
              confidence: combinedProb >= 0.20 ? 'medium' : 'low',
              narrative: narrative?.name || 'Custom',
            })
          }
        }
      }
    }
  }

  // Final dedup by match + outcomes
  const finalSgps: SGP[] = []
  const finalSeen = new Set<string>()

  for (const sgp of sgps) {
    const outcomes = sgp.legs.map(l => l.outcome).sort().join('|')
    const key = `${sgp.matchId}:${outcomes}`
    if (!finalSeen.has(key)) {
      finalSeen.add(key)
      finalSgps.push(sgp)
    }
  }

  // Sort: narrative matches first, then by combined probability
  return finalSgps.sort((a, b) => {
    // Narrative matches get priority
    const aHasNarrative = a.narrative !== 'Custom' ? 1 : 0
    const bHasNarrative = b.narrative !== 'Custom' ? 1 : 0
    if (aHasNarrative !== bHasNarrative) return bHasNarrative - aHasNarrative
    // Then by probability
    return b.combinedProb - a.combinedProb
  })
}

/**
 * POST /api/admin/parlays/generate - Generate parlays from predictionData
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Generating parlays from predictionData', {
      tags: ['api', 'admin', 'parlays', 'generate'],
    })

    const sgps = await generateSGPs()

    // Group by narrative for stats
    const narrativeCounts: Record<string, number> = {}
    for (const sgp of sgps) {
      narrativeCounts[sgp.narrative] = (narrativeCounts[sgp.narrative] || 0) + 1
    }

    logger.info(`Generated ${sgps.length} SGPs`, {
      tags: ['api', 'admin', 'parlays', 'generate'],
      data: { count: sgps.length, narratives: narrativeCounts },
    })

    return NextResponse.json({
      success: true,
      count: sgps.length,
      narratives: narrativeCounts,
      parlays: sgps,
    })
  } catch (error) {
    logger.error('Error generating parlays', {
      tags: ['api', 'admin', 'parlays', 'generate'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    return NextResponse.json(
      { error: 'Failed to generate parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
