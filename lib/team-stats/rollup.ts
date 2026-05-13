/**
 * Pure rollup helpers for the team-stats nightly cron.
 *
 * Callers select MarketMatch rows + outcomes from the DB and pass plain
 * objects in. Zero Prisma dependency so jsdom-based jest can exercise
 * the math without the full dep graph.
 *
 * Contract: every helper here is deterministic and side-effect free.
 * Same inputs → same outputs. No DB writes.
 *
 * See plan at ~/.claude/plans/indexed-bouncing-chipmunk.md "Chunk B".
 */

import { outcomeFromFinalResult } from '../premium-tracker/capture-helpers'

export type TeamSide = 'home' | 'away'

/**
 * A FINISHED match relevant to a given team, with everything we need to
 * roll up. Pulled by the cron via prisma.marketMatch.findMany() with
 * status: FINISHED and the team appearing on either side.
 */
export interface TeamMatchRow {
  matchId: string                                  // external API id
  league: string | null
  kickoffDate: Date
  homeTeam: string
  awayTeam: string
  homeTeamId: string | null
  awayTeamId: string | null
  finalResult: unknown                             // JSON { score, outcome, ... }
  v1Model: unknown                                 // JSON { pick: 'home'|'away'|'draw', confidence }
  v3Model: unknown                                 // JSON { pick, confidence } (from MarketMatch directly)
}

/** Which side this team is on for a given match. */
export function teamSideIn(match: TeamMatchRow, externalTeamId: string): TeamSide | null {
  if (match.homeTeamId === externalTeamId) return 'home'
  if (match.awayTeamId === externalTeamId) return 'away'
  return null
}

/**
 * Did the team WIN/DRAW/LOSE this match? Returns null if the outcome
 * can't be determined from finalResult.
 */
export function teamResult(match: TeamMatchRow, side: TeamSide): 'W' | 'D' | 'L' | null {
  const outcome = outcomeFromFinalResult(match.finalResult)
  if (!outcome) return null
  if (outcome === 'draw') return 'D'
  if (outcome === side) return 'W'
  return 'L'
}

/** Goals scored by each side for this match. Returns null if score missing. */
export function matchScore(match: TeamMatchRow): { home: number; away: number } | null {
  const fr = match.finalResult as { score?: { home?: number; away?: number } } | null
  const s = fr?.score
  if (!s || typeof s.home !== 'number' || typeof s.away !== 'number') return null
  return { home: s.home, away: s.away }
}

// ─── Form (last 10) ────────────────────────────────────────────────────

/**
 * Encode the team's last N (default 10) matches as a 'WWDLW…' string.
 * Most recent match first.
 */
export function encodeForm(
  matches: TeamMatchRow[],
  externalTeamId: string,
  n = 10,
): string {
  const sorted = [...matches].sort((a, b) => b.kickoffDate.getTime() - a.kickoffDate.getTime())
  const out: string[] = []
  for (const m of sorted) {
    const side = teamSideIn(m, externalTeamId)
    if (!side) continue
    const r = teamResult(m, side)
    if (r) out.push(r)
    if (out.length >= n) break
  }
  return out.join('')
}

// ─── Goal stats ────────────────────────────────────────────────────────

export interface GoalStats {
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  bttsCount: number          // both teams scored
  over25Count: number        // total goals > 2.5
  homeGoalsFor: number       // avg goals scored at home
  awayGoalsFor: number       // avg goals scored away
}

export function aggregateGoalStats(matches: TeamMatchRow[], externalTeamId: string): GoalStats {
  let mp = 0, wins = 0, draws = 0, losses = 0
  let gf = 0, ga = 0, btts = 0, over25 = 0
  let homeGfSum = 0, homeMatches = 0
  let awayGfSum = 0, awayMatches = 0

  for (const m of matches) {
    const side = teamSideIn(m, externalTeamId)
    if (!side) continue
    const score = matchScore(m)
    if (!score) continue
    mp++

    const teamGf = side === 'home' ? score.home : score.away
    const teamGa = side === 'home' ? score.away : score.home

    gf += teamGf
    ga += teamGa
    if (score.home > 0 && score.away > 0) btts++
    if (score.home + score.away > 2.5) over25++

    if (teamGf > teamGa) wins++
    else if (teamGf < teamGa) losses++
    else draws++

    if (side === 'home') {
      homeGfSum += teamGf
      homeMatches++
    } else {
      awayGfSum += teamGf
      awayMatches++
    }
  }

  return {
    matchesPlayed: mp,
    wins, draws, losses,
    goalsFor: gf,
    goalsAgainst: ga,
    bttsCount: btts,
    over25Count: over25,
    homeGoalsFor: homeMatches > 0 ? +(homeGfSum / homeMatches).toFixed(3) : 0,
    awayGoalsFor: awayMatches > 0 ? +(awayGfSum / awayMatches).toFixed(3) : 0,
  }
}

// ─── Model accuracy ───────────────────────────────────────────────────

interface ModelPick { pick?: string; confidence?: number }

/**
 * For a given model (v1 or v3), what fraction of matches in this team's
 * sample did the model pick correctly? Returns null if sample is empty.
 *
 * For team-page display we use the LAST `windowSize` settled matches the
 * team has played (default 30) — recent form matters more than ancient
 * predictions.
 */
export function modelAccuracyForTeam(
  matches: TeamMatchRow[],
  externalTeamId: string,
  model: 'v1' | 'v3',
  windowSize = 30,
): { accuracy: number; sampleN: number } | null {
  const team = matches
    .filter(m => teamSideIn(m, externalTeamId) !== null)
    .sort((a, b) => b.kickoffDate.getTime() - a.kickoffDate.getTime())
    .slice(0, windowSize)

  let correct = 0
  let n = 0
  for (const m of team) {
    const outcome = outcomeFromFinalResult(m.finalResult)
    if (!outcome) continue
    const modelPick = (model === 'v1' ? m.v1Model : m.v3Model) as ModelPick | null
    if (!modelPick?.pick) continue
    n++
    if (modelPick.pick.toLowerCase() === outcome) correct++
  }
  if (n === 0) return null
  return { accuracy: +(correct / n).toFixed(4), sampleN: n }
}

/**
 * Pick the recommended model for a team based on which is empirically
 * more accurate on its matches. Honest rule:
 *   - Both need ≥10 sample size to be eligible
 *   - Winner must lead by ≥5 percentage points
 *   - Otherwise null (no clear winner, show both)
 */
export function recommendedModelForTeam(
  v1: { accuracy: number; sampleN: number } | null,
  v3: { accuracy: number; sampleN: number } | null,
): 'v1' | 'v3' | null {
  const MIN_N = 10
  const MIN_GAP = 0.05
  if (!v1 || v1.sampleN < MIN_N) {
    if (v3 && v3.sampleN >= MIN_N) return 'v3'
    return null
  }
  if (!v3 || v3.sampleN < MIN_N) return 'v1'
  if (v3.accuracy >= v1.accuracy + MIN_GAP) return 'v3'
  if (v1.accuracy >= v3.accuracy + MIN_GAP) return 'v1'
  return null
}

// ─── H2H grid ─────────────────────────────────────────────────────────

export interface H2HEntry {
  opponent: string
  externalOpponentId: string
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  last5: string                                    // 'WDWLD' (most recent first)
  lastResult: string | null                        // 'W 2-1' / 'L 0-1' / 'D 1-1'
  lastDate: string | null                          // ISO yyyy-mm-dd
}

/**
 * Build top-N H2H entries — opponents the team has played most, with
 * record + form against them.
 */
export function buildH2HGrid(
  matches: TeamMatchRow[],
  externalTeamId: string,
  topN = 5,
): H2HEntry[] {
  const byOpponent = new Map<string, { name: string; rows: TeamMatchRow[] }>()
  for (const m of matches) {
    const side = teamSideIn(m, externalTeamId)
    if (!side) continue
    const oppName = side === 'home' ? m.awayTeam : m.homeTeam
    const oppId = (side === 'home' ? m.awayTeamId : m.homeTeamId) || oppName
    const entry = byOpponent.get(oppId) || { name: oppName, rows: [] }
    entry.rows.push(m)
    byOpponent.set(oppId, entry)
  }

  const sorted = [...byOpponent.entries()]
    .sort((a, b) => b[1].rows.length - a[1].rows.length)
    .slice(0, topN)

  return sorted.map(([oppId, { name, rows }]) => {
    let wins = 0, draws = 0, losses = 0
    for (const m of rows) {
      const side = teamSideIn(m, externalTeamId)
      if (!side) continue
      const r = teamResult(m, side)
      if (r === 'W') wins++
      else if (r === 'D') draws++
      else if (r === 'L') losses++
    }
    const recent = [...rows].sort((a, b) => b.kickoffDate.getTime() - a.kickoffDate.getTime())
    const last5 = recent.slice(0, 5).map(m => {
      const side = teamSideIn(m, externalTeamId)
      return side ? (teamResult(m, side) ?? '?') : '?'
    }).join('')

    let lastResult: string | null = null
    let lastDate: string | null = null
    for (const m of recent) {
      const side = teamSideIn(m, externalTeamId)
      if (!side) continue
      const r = teamResult(m, side)
      const score = matchScore(m)
      if (!r || !score) continue
      const teamScore = side === 'home' ? score.home : score.away
      const oppScore = side === 'home' ? score.away : score.home
      lastResult = `${r} ${teamScore}-${oppScore}`
      lastDate = m.kickoffDate.toISOString().slice(0, 10)
      break
    }

    return {
      opponent: name,
      externalOpponentId: oppId,
      matchesPlayed: rows.length,
      wins, draws, losses,
      last5,
      lastResult,
      lastDate,
    }
  })
}
