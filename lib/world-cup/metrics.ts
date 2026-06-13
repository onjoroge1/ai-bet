/**
 * World Cup group analytics — pure, deterministic, unit-testable.
 *
 * The headline metric is each team's probability to ADVANCE from its group.
 * For a 4-team group there are exactly 6 round-robin matches, each with 3
 * outcomes (H/D/A) → 3^6 = 729 possible result combinations. We ENUMERATE
 * all 729 (no Monte-Carlo noise — exact), weight each by the product of its
 * per-match model probabilities, compute the final table, and accumulate the
 * probability mass where each team finishes in the top two (auto-advance).
 *
 * Tiebreaker (simplified, stated honestly in the UI): points → head-to-head
 * points among the tied set → pre-tournament model strength (Σ win prob).
 * We deliberately do NOT fake goal difference — we have no reliable scoreline
 * projections, so GD is omitted rather than invented.
 *
 * Inputs are model probabilities already on each fixture. When a fixture has
 * no model probs yet, the group is "partial" and we report coverage so the
 * UI can show a calibration caveat instead of a false-precision number.
 */
import type { WCTeam } from './tournament'

export interface GroupSimFixtureInput {
  homeSlug: string
  awaySlug: string
  /** H/D/A model probabilities (0..1, sum≈1). Null when no model has run. */
  probs: { home: number; draw: number; away: number } | null
  /** Settled outcome for FINISHED fixtures — pins that match instead of
   *  enumerating it. */
  result?: 'home' | 'away' | 'draw' | null
}

export interface TeamAdvanceMetric {
  slug: string
  name: string
  flagEmoji: string
  /** P(finish top-2 in group) — the auto-advance line. 0..1. */
  advanceProb: number
  /** P(finish 1st). 0..1. */
  winGroupProb: number
  /** Expected points across the 3 group games. */
  expectedPoints: number
}

export interface GroupSimResult {
  teams: TeamAdvanceMetric[]
  /** Fraction of the 6 fixtures that carry model probabilities (0..1). */
  coverage: number
  /** True when every fixture has data (or is settled). */
  complete: boolean
  fixturesWithData: number
  totalFixtures: number
}

type Side = 'home' | 'away' | 'draw'
const SIDES: Side[] = ['home', 'away', 'draw']

/**
 * Run the exact group simulation. `teams` must be the group's 4 teams;
 * `fixtures` the (up to) 6 round-robin matches keyed by team slug.
 */
export function simulateGroup(
  teams: WCTeam[],
  fixtures: GroupSimFixtureInput[],
): GroupSimResult {
  const slugs = teams.map(t => t.slug)
  const totalFixtures = fixtures.length

  // Pre-tournament strength prior for the final tiebreak: a team's mean win
  // probability across its fixtures (model where present, else neutral 0.4).
  const strength: Record<string, number> = {}
  for (const s of slugs) strength[s] = 0
  const strengthN: Record<string, number> = {}
  for (const s of slugs) strengthN[s] = 0
  for (const f of fixtures) {
    const hp = f.probs?.home ?? 0.4
    const ap = f.probs?.away ?? 0.4
    if (f.homeSlug in strength) { strength[f.homeSlug] += hp; strengthN[f.homeSlug]++ }
    if (f.awaySlug in strength) { strength[f.awaySlug] += ap; strengthN[f.awaySlug]++ }
  }
  for (const s of slugs) strength[s] = strengthN[s] > 0 ? strength[s] / strengthN[s] : 0.4

  // Enumerate outcomes. A settled fixture is pinned to its result (prob 1).
  // Each open fixture branches into H/D/A weighted by its probs (neutral
  // 0.40/0.27/0.33 prior when a fixture has no model yet, so the sim still
  // runs — coverage flags this to the UI).
  const advanceMass: Record<string, number> = {}
  const winMass: Record<string, number> = {}
  const expPoints: Record<string, number> = {}
  for (const s of slugs) { advanceMass[s] = 0; winMass[s] = 0; expPoints[s] = 0 }

  let fixturesWithData = 0
  const outcomeOptions: { side: Side; p: number }[][] = fixtures.map(f => {
    if (f.result) return [{ side: f.result, p: 1 }]
    if (f.probs) {
      fixturesWithData++
      return [
        { side: 'home', p: f.probs.home },
        { side: 'draw', p: f.probs.draw },
        { side: 'away', p: f.probs.away },
      ]
    }
    return [
      { side: 'home', p: 0.40 },
      { side: 'draw', p: 0.27 },
      { side: 'away', p: 0.33 },
    ]
  })

  // Recursive enumeration over fixtures.
  const n = fixtures.length
  const rec = (idx: number, weight: number, points: Record<string, number>) => {
    if (idx === n) {
      // Distribute the 2 advance slots + 1 winner slot, SPLITTING fairly
      // across any teams exactly tied at the boundary (so the metric carries
      // no alphabetical/schedule bias when teams are genuinely level).
      const { advance, winner } = advanceShares(slugs, points, fixtures, outcomeSelections, strength)
      for (const s of slugs) {
        expPoints[s] += weight * points[s]
        advanceMass[s] += weight * advance[s]
        winMass[s] += weight * winner[s]
      }
      return
    }
    const f = fixtures[idx]
    for (const opt of outcomeOptions[idx]) {
      if (opt.p <= 0) continue
      outcomeSelections[idx] = opt.side
      const np = { ...points }
      if (opt.side === 'home') np[f.homeSlug] += 3
      else if (opt.side === 'away') np[f.awaySlug] += 3
      else { np[f.homeSlug] += 1; np[f.awaySlug] += 1 }
      rec(idx + 1, weight * opt.p, np)
    }
  }
  const outcomeSelections: Side[] = new Array(n).fill('draw')
  const zero: Record<string, number> = {}
  for (const s of slugs) zero[s] = 0
  rec(0, 1, zero)

  const teamMetrics: TeamAdvanceMetric[] = teams.map(t => ({
    slug: t.slug,
    name: t.name,
    flagEmoji: t.flagEmoji,
    advanceProb: clamp01(advanceMass[t.slug]),
    winGroupProb: clamp01(winMass[t.slug]),
    expectedPoints: +(expPoints[t.slug]).toFixed(2),
  })).sort((a, b) => b.advanceProb - a.advanceProb || b.expectedPoints - a.expectedPoints)

  return {
    teams: teamMetrics,
    coverage: totalFixtures > 0 ? fixturesWithData / totalFixtures : 0,
    complete: fixturesWithData === totalFixtures && totalFixtures > 0,
    fixturesWithData,
    totalFixtures,
  }
}

/**
 * For one fully-resolved outcome set, return each team's share of the 2
 * advance slots and 1 winner slot. Teams that are EXACTLY tied on all
 * criteria (points → H2H → strength) split the contested slots evenly — this
 * removes the alphabetical bias a strict sort would inject when teams are
 * genuinely level (e.g. an all-equal-probability group is now symmetric).
 */
function advanceShares(
  slugs: string[],
  points: Record<string, number>,
  fixtures: GroupSimFixtureInput[],
  selections: Side[],
  strength: Record<string, number>,
): { advance: Record<string, number>; winner: Record<string, number> } {
  // Build tiers: consecutive teams that compare equal form one tier.
  const sorted = [...slugs].sort((a, b) => cmpTeams(a, b, points, fixtures, selections, strength))
  const tiers: string[][] = []
  for (const s of sorted) {
    const last = tiers[tiers.length - 1]
    if (last && cmpTeams(last[0], s, points, fixtures, selections, strength) === 0) last.push(s)
    else tiers.push([s])
  }

  const advance: Record<string, number> = {}
  const winner: Record<string, number> = {}
  for (const s of slugs) { advance[s] = 0; winner[s] = 0 }

  // Winner slot (1) goes to the top tier, split if tied.
  for (const s of tiers[0]) winner[s] = 1 / tiers[0].length

  // Advance slots (2) fill down the tiers; a straddling tier splits its share.
  let slotsLeft = 2
  for (const tier of tiers) {
    if (slotsLeft <= 0) break
    const share = Math.min(1, slotsLeft / tier.length)
    for (const s of tier) advance[s] = share
    slotsLeft -= tier.length
  }
  return { advance, winner }
}

/** Comparator: points → head-to-head → strength prior. 0 = exact tie. */
function cmpTeams(
  a: string, b: string,
  points: Record<string, number>,
  fixtures: GroupSimFixtureInput[],
  selections: Side[],
  strength: Record<string, number>,
): number {
  if (points[b] !== points[a]) return points[b] - points[a]
  const h2h = headToHeadPoints(a, b, fixtures, selections)
  if (h2h !== 0) return -h2h
  return strength[b] - strength[a]
}

/** Net head-to-head points of a minus b across their direct meeting(s). */
function headToHeadPoints(
  a: string, b: string,
  fixtures: GroupSimFixtureInput[],
  selections: Side[],
): number {
  let pa = 0, pb = 0
  fixtures.forEach((f, i) => {
    const isAB = (f.homeSlug === a && f.awaySlug === b) || (f.homeSlug === b && f.awaySlug === a)
    if (!isAB) return
    const side = selections[i]
    if (side === 'draw') { pa += 1; pb += 1 }
    else {
      const winnerSlug = side === 'home' ? f.homeSlug : f.awaySlug
      if (winnerSlug === a) pa += 3; else pb += 3
    }
  })
  return pa - pb
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

// ─── Tournament-wide aggregates (hub) ────────────────────────────────────

export interface ConfederationCount {
  confederation: string
  count: number
}

/** Count teams per confederation across all groups (static, exact). */
export function confederationBreakdown(teams: WCTeam[]): ConfederationCount[] {
  const counts: Record<string, number> = {}
  for (const t of teams) counts[t.confederation] = (counts[t.confederation] ?? 0) + 1
  return Object.entries(counts)
    .map(([confederation, count]) => ({ confederation, count }))
    .sort((a, b) => b.count - a.count)
}
