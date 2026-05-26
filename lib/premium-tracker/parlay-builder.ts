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
