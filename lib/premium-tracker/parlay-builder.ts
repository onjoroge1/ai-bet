/**
 * Pure helpers for premium-only parlay construction.
 *
 * Selection rules (kept narrow so the public product reflects high-confidence
 * combinations only):
 *   - Source: PremiumPickHistory rows where tier='premium' and result='pending'
 *     (settled rows can also be used by the backfill script for diagnostic
 *     parlays; the live cron filters to pending)
 *   - Window: configurable rolling kickoff window (default 48h). All legs in
 *     a single parlay must kick off within this window of EACH OTHER.
 *   - Leg counts: 2, 3, 4, 5 (configurable).
 *   - No duplicates: same match-market pair can only appear once.
 *
 * Output: ParlayCandidate[] — ready for upsert by callers. Pure, no DB.
 */

import { settlePick } from './capture-helpers'

export interface PremiumPickLike {
  id: string                  // PremiumPickHistory.id
  marketMatchId: string
  market: string
  oddsAtPublish: number
  homeTeam: string
  awayTeam: string
  league: string | null
  selection: string           // the human-readable pick label
  kickoffDate: Date
  result: 'pending' | 'win' | 'loss' | 'push' | 'void'
}

export interface ParlayCandidate {
  legCount: number
  combinedOdds: number
  earliestKickoff: Date
  latestKickoff: Date
  legs: PremiumPickLike[]
  /** When all legs settled, the simulated parlay result. */
  result: 'pending' | 'win' | 'loss' | 'void'
  /** Net $ at the given stake. Null until result computed. */
  netDollars: number | null
}

export interface BuilderOpts {
  legCounts: number[]            // e.g. [2, 3, 4, 5]
  windowHours: number            // max time delta between earliest + latest kickoff in same parlay
  /** Cap on parlays per leg-count emitted by this call. Prevents combinatorial
   *  explosion when the pool is large. Default = unlimited. */
  capPerLegCount?: number
  /** Stake assumption for P/L math. Default $10. */
  stakeDollars?: number
}

/**
 * Generate all valid parlay combinations from the input pool.
 * Combinations are emitted sorted by combined odds DESC (highest-payout first)
 * within each leg count.
 *
 * Idempotent and pure.
 */
export function buildParlayCandidates(
  pool: PremiumPickLike[],
  opts: BuilderOpts,
): ParlayCandidate[] {
  const stake = opts.stakeDollars ?? 10
  const windowMs = opts.windowHours * 3600 * 1000
  const sorted = [...pool].sort((a, b) => a.kickoffDate.getTime() - b.kickoffDate.getTime())

  const results: ParlayCandidate[] = []

  for (const legCount of opts.legCounts) {
    if (legCount < 2) continue
    if (sorted.length < legCount) continue

    const buckets: ParlayCandidate[] = []
    // Enumerate combinations of `legCount` from `sorted`
    const combo: number[] = []
    function dfs(start: number) {
      if (combo.length === legCount) {
        const legs = combo.map(i => sorted[i])
        // Window check: latest - earliest <= windowMs
        const earliest = legs[0].kickoffDate
        const latest = legs[legs.length - 1].kickoffDate
        if (latest.getTime() - earliest.getTime() > windowMs) return

        // Reject if any two legs share the same marketMatchId (avoid SGP shape)
        const seen = new Set<string>()
        for (const l of legs) {
          if (seen.has(l.marketMatchId)) return
          seen.add(l.marketMatchId)
        }

        const combinedOdds = legs.reduce((p, l) => p * l.oddsAtPublish, 1)

        // Compute hypothetical settled result if all legs already settled
        let result: ParlayCandidate['result'] = 'pending'
        let netDollars: number | null = null
        if (legs.every(l => l.result === 'win' || l.result === 'loss')) {
          const allWin = legs.every(l => l.result === 'win')
          if (allWin) {
            result = 'win'
            netDollars = +(stake * (combinedOdds - 1)).toFixed(2)
          } else {
            result = 'loss'
            netDollars = -stake
          }
        } else if (legs.some(l => l.result === 'push' || l.result === 'void')) {
          // Push/void on any leg — for v1 we treat as void at parlay level
          result = 'void'
          netDollars = 0
        }

        buckets.push({
          legCount,
          combinedOdds: +combinedOdds.toFixed(4),
          earliestKickoff: earliest,
          latestKickoff: latest,
          legs,
          result,
          netDollars,
        })
        return
      }
      for (let i = start; i < sorted.length; i++) {
        combo.push(i)
        dfs(i + 1)
        combo.pop()
      }
    }
    dfs(0)

    buckets.sort((a, b) => b.combinedOdds - a.combinedOdds)
    const limited = opts.capPerLegCount ? buckets.slice(0, opts.capPerLegCount) : buckets
    results.push(...limited)
  }

  return results
}

/**
 * Generate a stable key for a parlay so the cron is idempotent.
 * Key = sorted-by-pickId leg IDs joined with '|'.
 */
export function parlayKey(candidate: { legs: Array<{ id: string }> }): string {
  return [...candidate.legs.map(l => l.id)].sort().join('|')
}

// ─── SGP overlay builder ──────────────────────────────────────────────
// Same-Game-Parlay variants: base premium 1X2 + same-match secondary
// markets (Over/Under, BTTS). Per 2026-05-15 backtest these can carry
// strong ROI in the data we have, though n=18 is thin.

export interface SecondaryMarketRow {
  matchId: string                   // external match id; same as PremiumPickHistory.externalMatchId
  marketType: string                // '1X2' | 'TOTALS' | 'BTTS' | 'DNB' | 'DOUBLE_CHANCE'
  marketSubtype: string | null      // 'HOME' | 'OVER' | 'YES' | etc.
  line: number | null
  consensusProb: number
}

export type SgpLegType = 'premium_1x2' | 'sgp_overlay'

export interface SgpLeg {
  legType: SgpLegType
  homeTeam: string
  awayTeam: string
  league: string | null
  marketMatchId: string             // internal MarketMatch.id for settlement
  externalMatchId: string
  market: string                    // '1X2_HOME' | 'TOTALS' | 'BTTS'
  selection: string                 // 'Arsenal to win' | 'OVER' | 'YES'
  line: number | null
  oddsAtPublish: number             // 1 / consensusProb
  consensusProb: number
  kickoffDate: Date
  /** Only set when legType='premium_1x2' — id of the source PremiumPickHistory row. */
  pickId: string | null
  result: 'pending' | 'win' | 'loss' | 'push' | 'void'
}

export interface SgpCandidate {
  archetype: string                 // 'sgp_o25' | 'sgp_o25_btts' | 'sgp_o15_o25_btts' | etc.
  legs: SgpLeg[]
  legCount: number
  combinedOdds: number
  earliestKickoff: Date
  latestKickoff: Date
  result: 'pending' | 'win' | 'loss' | 'void'
  netDollars: number | null
}

/**
 * Derive whether a secondary market hit, given the final score.
 */
export function deriveSecondaryOutcome(
  market: string,
  selection: string,
  line: number | null,
  score: { home: number; away: number } | null,
): 'win' | 'loss' | 'void' | null {
  if (!score) return null
  const total = score.home + score.away
  if (market === 'TOTALS') {
    if (line === null) return null
    if (selection === 'OVER') {
      if (total === line) return 'void'
      return total > line ? 'win' : 'loss'
    }
    if (selection === 'UNDER') {
      if (total === line) return 'void'
      return total < line ? 'win' : 'loss'
    }
  }
  if (market === 'BTTS') {
    if (selection === 'YES') return score.home > 0 && score.away > 0 ? 'win' : 'loss'
    if (selection === 'NO') return score.home === 0 || score.away === 0 ? 'win' : 'loss'
  }
  return null
}

/** Find a secondary market row in the pool by type + selection + (optional) line. */
function findSecondary(
  rows: SecondaryMarketRow[],
  marketType: string,
  selection: string,
  line: number | null,
): SecondaryMarketRow | null {
  return rows.find(r =>
    r.marketType === marketType &&
    r.marketSubtype === selection &&
    (line === null || (r.line !== null && r.line === line))
  ) ?? null
}

interface SgpArchetypeDef {
  name: string
  legs: Array<{ market: string; selection: string; line: number | null }>
}

const SGP_ARCHETYPES: SgpArchetypeDef[] = [
  { name: 'sgp_o25',           legs: [{ market: 'TOTALS', selection: 'OVER', line: 2.5 }] },
  { name: 'sgp_o15',           legs: [{ market: 'TOTALS', selection: 'OVER', line: 1.5 }] },
  { name: 'sgp_btts',          legs: [{ market: 'BTTS',   selection: 'YES',  line: null }] },
  { name: 'sgp_o25_btts',      legs: [{ market: 'TOTALS', selection: 'OVER', line: 2.5 }, { market: 'BTTS', selection: 'YES', line: null }] },
  { name: 'sgp_o15_o25_btts',  legs: [
    { market: 'TOTALS', selection: 'OVER', line: 1.5 },
    { market: 'TOTALS', selection: 'OVER', line: 2.5 },
    { market: 'BTTS',   selection: 'YES',  line: null },
  ] },
]

export interface SgpBuilderOpts {
  /** Optional final score so we can settle hypotheticals at build-time (backfill).
   *  Null/undefined for live capture (settle later). */
  score?: { home: number; away: number } | null
  stakeDollars?: number
  /** Only emit archetypes where the base premium pick is still pending if true.
   *  Backfill passes false to also emit settled variants. */
  pendingOnly?: boolean
}

/**
 * Generate every SGP variant from a single premium pick + its same-match
 * secondary market rows.
 *
 * If `score` is provided, each candidate is fully settled at build time.
 * Otherwise the candidate's result is 'pending'.
 */
export function buildSgpVariants(
  basePick: PremiumPickLike,
  secondaryMarkets: SecondaryMarketRow[],
  opts: SgpBuilderOpts = {},
): SgpCandidate[] {
  const stake = opts.stakeDollars ?? 10
  const score = opts.score ?? null

  if (opts.pendingOnly && basePick.result !== 'pending') return []

  // Find the 1X2 secondary row that matches the premium pick's side, so we
  // can use the ACTUAL consensus odds at publish time for the base leg too
  // (rather than oddsAtPublish — they should be equivalent but use the
  // ADM-derived value for parity with overlay legs which all come from ADM).
  const sideFromLabel = basePick.selection.includes('Draw') ? 'DRAW'
    : basePick.selection.includes(basePick.homeTeam) ? 'HOME'
    : basePick.selection.includes(basePick.awayTeam) ? 'AWAY'
    : null
  if (!sideFromLabel) return []

  // Build the base premium leg
  const baseLeg: SgpLeg = {
    legType: 'premium_1x2',
    homeTeam: basePick.homeTeam,
    awayTeam: basePick.awayTeam,
    league: basePick.league,
    marketMatchId: basePick.marketMatchId,
    externalMatchId: '',  // caller's responsibility to populate from PremiumPickHistory.externalMatchId
    market: basePick.market,
    selection: basePick.selection,
    line: null,
    oddsAtPublish: basePick.oddsAtPublish,
    consensusProb: 1 / basePick.oddsAtPublish,
    kickoffDate: basePick.kickoffDate,
    pickId: basePick.id,
    result: basePick.result,
  }

  const candidates: SgpCandidate[] = []

  for (const archetype of SGP_ARCHETYPES) {
    const overlayLegs: SgpLeg[] = []
    let allFound = true

    for (const def of archetype.legs) {
      const row = findSecondary(secondaryMarkets, def.market, def.selection, def.line)
      if (!row || row.consensusProb <= 0 || row.consensusProb >= 1) {
        allFound = false
        break
      }
      const odds = 1 / row.consensusProb
      const outcome = score
        ? (deriveSecondaryOutcome(def.market, def.selection, def.line, score) ?? 'void')
        : 'pending'
      overlayLegs.push({
        legType: 'sgp_overlay',
        homeTeam: basePick.homeTeam,
        awayTeam: basePick.awayTeam,
        league: basePick.league,
        marketMatchId: basePick.marketMatchId,
        externalMatchId: '',
        market: def.market,
        selection: def.selection,
        line: def.line,
        oddsAtPublish: +odds.toFixed(3),
        consensusProb: row.consensusProb,
        kickoffDate: basePick.kickoffDate,
        pickId: null,
        result: outcome,
      })
    }
    if (!allFound) continue

    const legs = [baseLeg, ...overlayLegs]
    const combinedOdds = +legs.reduce((p, l) => p * l.oddsAtPublish, 1).toFixed(4)

    // Settlement
    let result: SgpCandidate['result'] = 'pending'
    let netDollars: number | null = null
    if (legs.every(l => l.result === 'win' || l.result === 'loss')) {
      const anyLoss = legs.some(l => l.result === 'loss')
      if (anyLoss) { result = 'loss'; netDollars = -stake }
      else { result = 'win'; netDollars = +(stake * (combinedOdds - 1)).toFixed(2) }
    } else if (legs.some(l => l.result === 'push' || l.result === 'void')) {
      result = 'void'
      netDollars = 0
    }

    candidates.push({
      archetype: archetype.name,
      legs,
      legCount: legs.length,
      combinedOdds,
      earliestKickoff: legs[0].kickoffDate,
      latestKickoff: legs[legs.length - 1].kickoffDate,
      result,
      netDollars,
    })
  }

  return candidates
}

/**
 * Settle a parlay candidate given the latest results of its legs.
 * Used by the settle cron. Returns null if any leg is still pending.
 */
export function settleParlay(
  legs: Array<{ result: PremiumPickLike['result']; oddsAtPublish: number }>,
  stakeDollars = 10,
): { result: 'win' | 'loss' | 'void'; netDollars: number } | null {
  if (legs.some(l => l.result === 'pending')) return null
  // void on any leg → void the parlay
  if (legs.some(l => l.result === 'push' || l.result === 'void')) {
    return { result: 'void', netDollars: 0 }
  }
  const allWin = legs.every(l => l.result === 'win')
  if (allWin) {
    const combinedOdds = legs.reduce((p, l) => p * l.oddsAtPublish, 1)
    const net = +(stakeDollars * (combinedOdds - 1)).toFixed(2)
    return { result: 'win', netDollars: net }
  }
  // Same flat-stake math as settlePick (reused for parity)
  void settlePick  // keep import meaningful
  return { result: 'loss', netDollars: -stakeDollars }
}
