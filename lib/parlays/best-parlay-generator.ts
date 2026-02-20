/**
 * Curated Parlay Generator
 *
 * Generates a small set of high-quality, human-readable parlays from the
 * AdditionalMarketData table.  Replaces the old "brute-force combinations"
 * approach with a deliberate, rule-based strategy.
 *
 * Design principles
 * ─────────────────
 * 1.  Quality over quantity   – max ~12 parlays per run.
 * 2.  Each match used at most once per parlay.
 * 3.  No trivial legs         – Over 0.5 / Over 1.5 goals are banned.
 * 4.  Minimum probability per leg enforced per market type.
 * 5.  All previously-generated AI parlays are expired before creating new ones.
 *
 * Parlay types
 * ────────────
 *  A.  "Best Picks"   – 2-4 strongest match-winner picks (1X2 or DNB)
 *                        from different matches.
 *  B.  "Same-Game Parlay (SGP)" – 2-3 legs from the same match
 *                        (Match Winner + Totals/BTTS).
 *  C.  "Safe Combo"   – 2-4 high-probability picks (Double Chance ≥ 75%
 *                        or DNB ≥ 65%) from different matches.
 *  D.  "Mixed Market"  – best single-market pick from each of 2-3
 *                         different matches, any market type.
 */

import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// ── Public types ─────────────────────────────────────────────────────────────

export interface CandidateLeg {
  id: string
  matchId: string
  marketType: string
  marketSubtype: string | null
  line: number | null
  consensusProb: number
  consensusConfidence: number
  modelAgreement: number
  edgeConsensus: number
  riskLevel: string
  correlationTags: string[]
  decimalOdds: number | null
  impliedProb: number | null
  /** Attached match info for display labels */
  _matchInfo?: { homeTeam: string; awayTeam: string; league: string }
}

export interface ParlayCombination {
  legs: CandidateLeg[]
  legCount: number
  combinedProb: number
  correlationPenalty: number
  adjustedProb: number
  impliedOdds: number
  parlayEdge: number
  qualityScore: number
  confidenceTier: string
  parlayType: 'multi_game' | 'single_game'
  isMultiGame: boolean
  matchIds: string[]
}

export interface GenerationConfig {
  minLegEdge?: number
  minParlayEdge?: number
  minCombinedProb?: number
  maxLegCount?: number
  minModelAgreement?: number
  maxResults?: number
  parlayType?: 'multi_game' | 'single_game' | 'both'
}

// ── Internal constants ───────────────────────────────────────────────────────

/** Minimum probability required for a leg to be eligible, per market type. */
const MIN_PROB: Record<string, number> = {
  '1X2': 0.55,
  BTTS: 0.55,
  TOTALS: 0.50,
  DNB: 0.55,
  DOUBLE_CHANCE: 0.72,
}

/** Totals lines that are trivially high and add no value to parlays. */
const BANNED_TOTAL_LINES = new Set([0.5, 1.5])

// ── Data layer ───────────────────────────────────────────────────────────────

/**
 * Fetch all eligible legs for upcoming matches, applying strict quality filters.
 */
async function fetchEligibleLegs(): Promise<CandidateLeg[]> {
  const now = new Date()
  const cutoff = new Date(now.getTime() + 72 * 60 * 60 * 1000)

  const raw = await prisma.additionalMarketData.findMany({
    where: {
      match: {
        status: 'UPCOMING',
        kickoffDate: { gte: now, lte: cutoff },
        isActive: true,
      },
      consensusProb: { gte: 0.45 }, // broad pre-filter; tightened per-market below
    },
    include: {
      match: {
        select: {
          matchId: true,
          homeTeam: true,
          awayTeam: true,
          league: true,
          kickoffDate: true,
        },
      },
    },
    orderBy: { consensusProb: 'desc' },
    take: 600,
  })

  const legs: CandidateLeg[] = []

  for (const m of raw) {
    const prob = Number(m.consensusProb)
    const line = m.line ? Number(m.line) : null

    // ── Banned trivial totals ────────────────────────────────
    if (m.marketType === 'TOTALS' && line !== null && BANNED_TOTAL_LINES.has(line)) {
      continue
    }

    // ── Per-market minimum probability ───────────────────────
    const minProb = MIN_PROB[m.marketType] ?? 0.55
    if (prob < minProb) continue

    // ── Skip DRAW picks for 1X2 (too risky for parlays) ─────
    if (m.marketType === '1X2' && m.marketSubtype === 'DRAW') continue

    legs.push({
      id: m.id,
      matchId: m.matchId,
      marketType: m.marketType,
      marketSubtype: m.marketSubtype,
      line,
      consensusProb: prob,
      consensusConfidence: Number(m.consensusConfidence),
      modelAgreement: Number(m.modelAgreement),
      edgeConsensus: Number(m.edgeConsensus) * 100,
      riskLevel: m.riskLevel,
      correlationTags: m.correlationTags,
      decimalOdds: m.decimalOdds ? Number(m.decimalOdds) : null,
      impliedProb: m.impliedProb ? Number(m.impliedProb) : null,
      _matchInfo: {
        homeTeam: m.match.homeTeam,
        awayTeam: m.match.awayTeam,
        league: m.match.league,
      },
    })
  }

  return legs
}

// ── Grouping helpers ─────────────────────────────────────────────────────────

interface MatchMarkets {
  matchId: string
  matchInfo: { homeTeam: string; awayTeam: string; league: string }
  /** Best leg per market type */
  markets: Map<string, CandidateLeg>
}

/**
 * Group eligible legs by matchId, pick the single best leg per market type.
 * For TOTALS, prefer line = 2.5 when available.
 */
function groupAndPickBest(legs: CandidateLeg[]): Map<string, MatchMarkets> {
  const map = new Map<string, MatchMarkets>()

  for (const leg of legs) {
    if (!map.has(leg.matchId)) {
      map.set(leg.matchId, {
        matchId: leg.matchId,
        matchInfo: leg._matchInfo ?? { homeTeam: '?', awayTeam: '?', league: '?' },
        markets: new Map(),
      })
    }

    const mm = map.get(leg.matchId)!
    const key = leg.marketType
    const current = mm.markets.get(key)

    if (!current) {
      mm.markets.set(key, leg)
    } else if (key === 'TOTALS') {
      // Prefer line 2.5 (the standard over/under line)
      if (leg.line === 2.5 && current.line !== 2.5) {
        mm.markets.set(key, leg)
      } else if (leg.line === 2.5 && current.line === 2.5 && leg.consensusProb > current.consensusProb) {
        mm.markets.set(key, leg)
      } else if (current.line !== 2.5 && leg.consensusProb > current.consensusProb) {
        mm.markets.set(key, leg)
      }
    } else {
      if (leg.consensusProb > current.consensusProb) {
        mm.markets.set(key, leg)
      }
    }
  }

  return map
}

// ── Parlay maths ─────────────────────────────────────────────────────────────

function calcCombined(
  legs: CandidateLeg[],
  isSameGame: boolean
): { combinedProb: number; adjustedProb: number; correlationPenalty: number } {
  const combinedProb = legs.reduce((p, l) => p * l.consensusProb, 1)

  const penalty = isSameGame
    ? legs.length === 2 ? 0.88 : legs.length === 3 ? 0.82 : 0.75
    : legs.length === 2 ? 0.95 : legs.length === 3 ? 0.92 : legs.length === 4 ? 0.88 : 0.85

  return { combinedProb, adjustedProb: combinedProb * penalty, correlationPenalty: penalty }
}

function qualityScore(legs: CandidateLeg[], adjustedProb: number): number {
  const avgProb = legs.reduce((s, l) => s + l.consensusProb, 0) / legs.length
  const probScore = avgProb * 40
  const combinedScore = Math.min(adjustedProb * 100, 30)
  const legBonus = legs.length >= 2 && legs.length <= 3 ? 10 : 5
  const uniqueMarkets = new Set(legs.map(l => l.marketType)).size
  const diversityScore = (uniqueMarkets / Math.max(legs.length, 1)) * 20
  return probScore + combinedScore + legBonus + diversityScore
}

function confidenceTier(score: number): string {
  if (score >= 50) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

function buildParlay(
  legs: CandidateLeg[],
  type: 'multi_game' | 'single_game'
): ParlayCombination {
  const isSameGame = type === 'single_game'
  const { combinedProb, adjustedProb, correlationPenalty } = calcCombined(legs, isSameGame)
  const impliedOdds = adjustedProb > 0 ? 1 / adjustedProb : 999
  const fairOdds = combinedProb > 0 ? 1 / combinedProb : 999
  const parlayEdge = fairOdds > 0 ? Math.max(((impliedOdds - fairOdds) / fairOdds) * 100, 0) : 0
  const score = qualityScore(legs, adjustedProb)

  return {
    legs,
    legCount: legs.length,
    combinedProb,
    correlationPenalty,
    adjustedProb,
    impliedOdds,
    parlayEdge,
    qualityScore: score,
    confidenceTier: confidenceTier(score),
    parlayType: type,
    isMultiGame: type === 'multi_game',
    matchIds: legs.map(l => l.matchId),
  }
}

// ── Parlay type generators ───────────────────────────────────────────────────

/**
 * Type A: "Best Picks" — strongest match-winner picks (1X2 or DNB)
 * from different matches. 2-4 legs.
 */
function generateBestPicks(
  matches: Map<string, MatchMarkets>,
  max: number
): ParlayCombination[] {
  const picks: Array<{ matchId: string; leg: CandidateLeg }> = []

  for (const [matchId, mm] of matches) {
    // Prefer 1X2 over DNB
    const leg1x2 = mm.markets.get('1X2')
    const legDnb = mm.markets.get('DNB')

    const best = leg1x2 && leg1x2.consensusProb >= 0.55
      ? leg1x2
      : legDnb && legDnb.consensusProb >= 0.55
        ? legDnb
        : null

    if (best) picks.push({ matchId, leg: best })
  }

  picks.sort((a, b) => b.leg.consensusProb - a.leg.consensusProb)

  const parlays: ParlayCombination[] = []
  for (const legCount of [2, 3, 4]) {
    if (picks.length < legCount || parlays.length >= max) continue
    const selected = picks.slice(0, legCount)
    const parlay = buildParlay(selected.map(s => s.leg), 'multi_game')
    if (parlay.adjustedProb >= 0.08) parlays.push(parlay)
  }

  return parlays
}

/**
 * Type B: "SGP" — same-game parlays. Match winner + secondary market.
 */
function generateSGPs(
  matches: Map<string, MatchMarkets>,
  max: number
): ParlayCombination[] {
  const parlays: ParlayCombination[] = []

  for (const [, mm] of matches) {
    if (parlays.length >= max) break

    // Anchor: 1X2 (>= 55%) or DNB (>= 55%)
    const anchor = (mm.markets.get('1X2')?.consensusProb ?? 0) >= 0.55
      ? mm.markets.get('1X2')!
      : (mm.markets.get('DNB')?.consensusProb ?? 0) >= 0.55
        ? mm.markets.get('DNB')!
        : null

    if (!anchor) continue

    const totals = mm.markets.get('TOTALS')
    const btts = mm.markets.get('BTTS')

    // 3-leg: Anchor + Totals + BTTS
    if (totals && btts && totals.consensusProb >= 0.50 && btts.consensusProb >= 0.55) {
      const p = buildParlay([anchor, totals, btts], 'single_game')
      if (p.adjustedProb >= 0.06) { parlays.push(p); continue }
    }

    // 2-leg: Anchor + Totals
    if (totals && totals.consensusProb >= 0.50) {
      const p = buildParlay([anchor, totals], 'single_game')
      if (p.adjustedProb >= 0.10) { parlays.push(p); continue }
    }

    // 2-leg: Anchor + BTTS
    if (btts && btts.consensusProb >= 0.55) {
      const p = buildParlay([anchor, btts], 'single_game')
      if (p.adjustedProb >= 0.10) { parlays.push(p); continue }
    }
  }

  return parlays
}

/**
 * Type C: "Safe Combo" — high-probability picks (Double Chance ≥ 75%
 * or DNB ≥ 65%) from different matches. Lower odds but higher win rate.
 */
function generateSafeCombos(
  matches: Map<string, MatchMarkets>,
  usedMatchIds: Set<string>,
  max: number
): ParlayCombination[] {
  const picks: Array<{ matchId: string; leg: CandidateLeg }> = []

  for (const [matchId, mm] of matches) {
    if (usedMatchIds.has(matchId)) continue

    const dc = mm.markets.get('DOUBLE_CHANCE')
    const dnb = mm.markets.get('DNB')

    // Prefer DC at >= 75% (covers 2 of 3 outcomes), else DNB at >= 65%
    const best = dc && dc.consensusProb >= 0.75
      ? dc
      : dnb && dnb.consensusProb >= 0.65
        ? dnb
        : null

    if (best) picks.push({ matchId, leg: best })
  }

  picks.sort((a, b) => b.leg.consensusProb - a.leg.consensusProb)

  const parlays: ParlayCombination[] = []
  for (const legCount of [3, 4]) {
    if (picks.length < legCount || parlays.length >= max) continue
    const selected = picks.slice(0, legCount)
    const parlay = buildParlay(selected.map(s => s.leg), 'multi_game')
    if (parlay.adjustedProb >= 0.15) parlays.push(parlay)
  }

  return parlays
}

/**
 * Type D: "Mixed Market" — best single-market pick from each of 2-3
 * different matches. Excludes DOUBLE_CHANCE for better odds.
 */
function generateMixed(
  matches: Map<string, MatchMarkets>,
  usedMatchIds: Set<string>,
  max: number
): ParlayCombination[] {
  const picks: Array<{ matchId: string; leg: CandidateLeg }> = []

  for (const [matchId, mm] of matches) {
    if (usedMatchIds.has(matchId)) continue

    let best: CandidateLeg | null = null
    for (const [, leg] of mm.markets) {
      if (leg.marketType === 'DOUBLE_CHANCE') continue // exclude DC for mixed
      if (!best || leg.consensusProb > best.consensusProb) {
        best = leg
      }
    }

    if (best && best.consensusProb >= 0.55) {
      picks.push({ matchId, leg: best })
    }
  }

  picks.sort((a, b) => b.leg.consensusProb - a.leg.consensusProb)

  const parlays: ParlayCombination[] = []
  for (const legCount of [2, 3]) {
    if (picks.length < legCount || parlays.length >= max) continue
    const selected = picks.slice(0, legCount)
    const parlay = buildParlay(selected.map(s => s.leg), 'multi_game')
    if (parlay.adjustedProb >= 0.10) parlays.push(parlay)

    // Alternative: skip the #1 pick and use #2..N+1
    if (picks.length > legCount && parlays.length < max) {
      const alt = picks.slice(1, 1 + legCount)
      if (alt.length === legCount) {
        const p = buildParlay(alt.map(s => s.leg), 'multi_game')
        if (p.adjustedProb >= 0.10) parlays.push(p)
      }
    }
  }

  return parlays
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generate curated, high-quality parlays.
 *
 * @returns Up to ~12 parlays across all types.
 */
export async function generateBestParlays(
  config: GenerationConfig = {}
): Promise<ParlayCombination[]> {
  logger.info('Starting curated parlay generation', {
    tags: ['parlays', 'generator'],
    data: { config },
  })

  // Step 1 — fetch & filter
  const allLegs = await fetchEligibleLegs()
  logger.info(`Fetched ${allLegs.length} eligible legs`, { tags: ['parlays', 'generator'] })

  if (allLegs.length === 0) return []

  // Step 2 — group by match, best per market
  const matchMap = groupAndPickBest(allLegs)
  logger.info(`${matchMap.size} unique matches after grouping`, { tags: ['parlays', 'generator'] })

  // Step 3 — generate each type
  const allParlays: ParlayCombination[] = []
  const usedMatchIds = new Set<string>()

  // A. Best Picks (match-winner cross-match)
  const bestPicks = generateBestPicks(matchMap, 3)
  allParlays.push(...bestPicks)
  logger.info(`Type A (Best Picks): ${bestPicks.length}`, { tags: ['parlays', 'generator'] })

  // B. Same-Game Parlays
  const sgps = generateSGPs(matchMap, 5)
  allParlays.push(...sgps)
  // Mark SGP matches so Safe/Mixed don't reuse them
  for (const sgp of sgps) {
    for (const id of sgp.matchIds) usedMatchIds.add(id)
  }
  logger.info(`Type B (SGP): ${sgps.length}`, { tags: ['parlays', 'generator'] })

  // C. Safe Combos (high-prob, lower odds)
  const safes = generateSafeCombos(matchMap, usedMatchIds, 2)
  allParlays.push(...safes)
  for (const s of safes) {
    for (const id of s.matchIds) usedMatchIds.add(id)
  }
  logger.info(`Type C (Safe Combo): ${safes.length}`, { tags: ['parlays', 'generator'] })

  // D. Mixed Market
  const mixed = generateMixed(matchMap, usedMatchIds, 3)
  allParlays.push(...mixed)
  logger.info(`Type D (Mixed): ${mixed.length}`, { tags: ['parlays', 'generator'] })

  // Step 4 — sort by quality, cap at maxResults
  allParlays.sort((a, b) => b.qualityScore - a.qualityScore)
  const maxResults = config.maxResults ?? 15
  const results = allParlays.slice(0, maxResults)

  logger.info(`Returning ${results.length} curated parlays`, {
    tags: ['parlays', 'generator'],
    data: {
      bestPicks: bestPicks.length,
      sgps: sgps.length,
      safes: safes.length,
      mixed: mixed.length,
      total: results.length,
    },
  })

  return results
}
