/**
 * Multisport rollup helpers — NBA, NHL, NCAAB.
 *
 * Diverges from lib/team-stats/rollup.ts (soccer) on three things:
 *   - 2-way market (no draws): pick is 'H' | 'A', mapped to 'home' | 'away'
 *   - Score-based stats: points instead of goals; BTTS doesn't apply
 *   - Model prediction lives in `model.predictions.pick` ('H'/'A') with
 *     `home_win` / `away_win` probabilities — different shape from soccer's
 *     v1Model / v3Model
 *
 * Same contract though: pure helpers, no DB writes, jsdom-testable.
 */

export type MultisportSide = 'home' | 'away'

export interface MultisportMatchRow {
  eventId: string
  sport: string
  league: string | null
  commenceTime: Date
  homeTeam: string
  awayTeam: string
  status: string
  // Score + outcome
  finalResult: unknown   // { score: { home, away }, result, ... }
  // Model prediction — `model.predictions.pick: 'H'|'A'`, plus probs
  model: unknown
  // Odds — `odds.consensus.home_prob / away_prob`
  odds: unknown
}

/** Which side a team plays on for this match. */
export function teamSideIn(match: MultisportMatchRow, teamName: string): MultisportSide | null {
  if (match.homeTeam === teamName) return 'home'
  if (match.awayTeam === teamName) return 'away'
  return null
}

/**
 * Extract the outcome side from MultisportMatch.finalResult.
 *
 * Upstream stores finalResult as a plain string ('H' / 'A') — no scoreline.
 * (Schema comment was aspirational; probed 2026-05-22.)
 */
export function outcomeSide(match: MultisportMatchRow): MultisportSide | null {
  const fr = match.finalResult
  if (typeof fr === 'string') {
    const up = fr.toUpperCase()
    if (up === 'H' || up === 'HOME') return 'home'
    if (up === 'A' || up === 'AWAY') return 'away'
    return null
  }
  // Future-proof: if upstream ever sends an object with score, derive from it
  const obj = fr as { score?: { home?: number; away?: number }; result?: string } | null
  if (obj?.result) {
    const up = obj.result.toUpperCase()
    if (up === 'H' || up === 'HOME') return 'home'
    if (up === 'A' || up === 'AWAY') return 'away'
  }
  if (obj?.score && typeof obj.score.home === 'number' && typeof obj.score.away === 'number') {
    return obj.score.home > obj.score.away ? 'home' : 'away'
  }
  return null
}

/** W or L from team perspective. Returns null if outcome can't be parsed. */
export function teamResult(match: MultisportMatchRow, side: MultisportSide): 'W' | 'L' | null {
  const outcome = outcomeSide(match)
  if (!outcome) return null
  return outcome === side ? 'W' : 'L'
}

/** Map model pick ('H'|'A') → 'home'|'away'. */
export function modelPickToSide(model: unknown): MultisportSide | null {
  const m = (model || {}) as { predictions?: { pick?: string } }
  const p = m.predictions?.pick
  if (typeof p !== 'string') return null
  const up = p.toUpperCase()
  if (up === 'H' || up === 'HOME') return 'home'
  if (up === 'A' || up === 'AWAY') return 'away'
  return null
}

/** Model's confidence on its pick (0..1). */
export function modelConfidence(model: unknown): number | null {
  const m = (model || {}) as { predictions?: { confidence?: number } }
  const c = m.predictions?.confidence
  if (typeof c !== 'number') return null
  return c
}

// ─── Form (last 10) ────────────────────────────────────────────────────

export function encodeForm(matches: MultisportMatchRow[], teamName: string, n = 10): string {
  const sorted = [...matches].sort((a, b) => b.commenceTime.getTime() - a.commenceTime.getTime())
  const out: string[] = []
  for (const m of sorted) {
    const side = teamSideIn(m, teamName)
    if (!side) continue
    const r = teamResult(m, side)
    if (r) out.push(r)
    if (out.length >= n) break
  }
  return out.join('')
}

// ─── W-L stats + home/away splits (no score data upstream) ──────────────

export interface MultisportStats {
  matchesPlayed: number
  wins: number
  losses: number
  homeMatches: number
  homeWins: number
  awayMatches: number
  awayWins: number
}

export function aggregateStats(matches: MultisportMatchRow[], teamName: string): MultisportStats {
  let mp = 0, wins = 0, losses = 0
  let homeMatches = 0, homeWins = 0
  let awayMatches = 0, awayWins = 0

  for (const m of matches) {
    const side = teamSideIn(m, teamName)
    if (!side) continue
    const result = teamResult(m, side)
    if (!result) continue
    mp++
    if (result === 'W') wins++
    else losses++

    if (side === 'home') {
      homeMatches++
      if (result === 'W') homeWins++
    } else {
      awayMatches++
      if (result === 'W') awayWins++
    }
  }

  return {
    matchesPlayed: mp,
    wins,
    losses,
    homeMatches,
    homeWins,
    awayMatches,
    awayWins,
  }
}

// ─── Model accuracy ────────────────────────────────────────────────────

/**
 * Model hit-rate on this team's recent matches. windowSize = how many
 * recent matches to consider; defaults to 30.
 */
export function modelAccuracyForTeam(
  matches: MultisportMatchRow[],
  teamName: string,
  windowSize = 30,
): { accuracy: number; sampleN: number } | null {
  const team = matches
    .filter(m => teamSideIn(m, teamName) !== null)
    .sort((a, b) => b.commenceTime.getTime() - a.commenceTime.getTime())
    .slice(0, windowSize)

  let correct = 0
  let n = 0
  for (const m of team) {
    const actualSide = outcomeSide(m)
    if (!actualSide) continue
    const pickedSide = modelPickToSide(m.model)
    if (!pickedSide) continue
    n++
    if (pickedSide === actualSide) correct++
  }
  if (n === 0) return null
  return { accuracy: +(correct / n).toFixed(4), sampleN: n }
}

// ─── H2H grid ──────────────────────────────────────────────────────────

export interface MultisportH2H {
  opponent: string
  matchesPlayed: number
  wins: number
  losses: number
  last5: string
  lastResult: string | null
  lastDate: string | null
}

export function buildH2HGrid(
  matches: MultisportMatchRow[],
  teamName: string,
  topN = 5,
): MultisportH2H[] {
  const byOpponent = new Map<string, MultisportMatchRow[]>()
  for (const m of matches) {
    const side = teamSideIn(m, teamName)
    if (!side) continue
    const opp = side === 'home' ? m.awayTeam : m.homeTeam
    const arr = byOpponent.get(opp) || []
    arr.push(m)
    byOpponent.set(opp, arr)
  }

  const sorted = [...byOpponent.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, topN)

  return sorted.map(([opp, rows]) => {
    let wins = 0, losses = 0
    for (const m of rows) {
      const side = teamSideIn(m, teamName)
      if (!side) continue
      const r = teamResult(m, side)
      if (r === 'W') wins++
      else if (r === 'L') losses++
    }
    const recent = [...rows].sort((a, b) => b.commenceTime.getTime() - a.commenceTime.getTime())
    const last5 = recent.slice(0, 5).map(m => {
      const side = teamSideIn(m, teamName)
      return side ? (teamResult(m, side) ?? '?') : '?'
    }).join('')

    let lastResult: string | null = null
    let lastDate: string | null = null
    for (const m of recent) {
      const side = teamSideIn(m, teamName)
      if (!side) continue
      const r = teamResult(m, side)
      if (!r) continue
      // No score data upstream — just record W/L outcome.
      lastResult = r === 'W' ? 'Win' : 'Loss'
      lastDate = m.commenceTime.toISOString().slice(0, 10)
      break
    }

    return {
      opponent: opp,
      matchesPlayed: rows.length,
      wins,
      losses,
      last5,
      lastResult,
      lastDate,
    }
  })
}
