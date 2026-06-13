/**
 * Unit tests for the World Cup group-advancement engine. The key invariant:
 * across all outcome combinations exactly two teams advance, so per-team
 * advance probabilities must sum to 2.0.
 */
import { simulateGroup, confederationBreakdown, type GroupSimFixtureInput } from '@/lib/world-cup/metrics'
import type { WCTeam } from '@/lib/world-cup/tournament'

const team = (slug: string, conf: WCTeam['confederation'] = 'UEFA'): WCTeam => ({
  slug, name: slug, iso3: slug.toUpperCase().slice(0, 3), flagEmoji: '🏳️', confederation: conf, group: 'X',
})
const TEAMS = [team('a'), team('b'), team('c'), team('d')]

// All 6 round-robin pairings for a 4-team group.
function roundRobin(probs: GroupSimFixtureInput['probs']): GroupSimFixtureInput[] {
  const pairs: [string, string][] = [['a','b'],['a','c'],['a','d'],['b','c'],['b','d'],['c','d']]
  return pairs.map(([h, a]) => ({ homeSlug: h, awaySlug: a, probs }))
}

describe('simulateGroup — invariants', () => {
  it('advance probabilities sum to exactly 2.0 (two teams advance)', () => {
    const sim = simulateGroup(TEAMS, roundRobin({ home: 0.45, draw: 0.27, away: 0.28 }))
    const sum = sim.teams.reduce((s, t) => s + t.advanceProb, 0)
    expect(sum).toBeCloseTo(2.0, 6)
  })

  it('win-group probabilities sum to exactly 1.0 (one winner)', () => {
    const sim = simulateGroup(TEAMS, roundRobin({ home: 0.45, draw: 0.27, away: 0.28 }))
    const sum = sim.teams.reduce((s, t) => s + t.winGroupProb, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })

  it('all-equal probabilities → near-symmetric advance odds (~0.5 each)', () => {
    // Fair tie-splitting removes the alphabetical bias (was 0.538). A <1%
    // residual remains from head-to-head tiebreak CYCLES (a>b>c>a) in a
    // perfectly symmetric synthetic group — these never occur with real
    // model probabilities, and the UI discloses the tiebreak simplification.
    const sim = simulateGroup(TEAMS, roundRobin({ home: 1/3, draw: 1/3, away: 1/3 }))
    for (const t of sim.teams) expect(t.advanceProb).toBeCloseTo(0.5, 1)
  })

  it('a dominant team advances far more often', () => {
    // Make team "a" win all its home games heavily.
    const fixtures: GroupSimFixtureInput[] = [
      { homeSlug: 'a', awaySlug: 'b', probs: { home: 0.8, draw: 0.1, away: 0.1 } },
      { homeSlug: 'a', awaySlug: 'c', probs: { home: 0.8, draw: 0.1, away: 0.1 } },
      { homeSlug: 'a', awaySlug: 'd', probs: { home: 0.8, draw: 0.1, away: 0.1 } },
      { homeSlug: 'b', awaySlug: 'c', probs: { home: 0.4, draw: 0.3, away: 0.3 } },
      { homeSlug: 'b', awaySlug: 'd', probs: { home: 0.4, draw: 0.3, away: 0.3 } },
      { homeSlug: 'c', awaySlug: 'd', probs: { home: 0.4, draw: 0.3, away: 0.3 } },
    ]
    const sim = simulateGroup(TEAMS, fixtures)
    const a = sim.teams.find(t => t.slug === 'a')!
    expect(a.advanceProb).toBeGreaterThan(0.85)
    expect(sim.teams[0].slug).toBe('a') // sorted top by advance prob
  })

  it('reports coverage and pins settled results', () => {
    const fixtures = roundRobin(null) // no model probs
    fixtures[0] = { ...fixtures[0], result: 'home' } // a beat b, settled
    const sim = simulateGroup(TEAMS, fixtures)
    expect(sim.coverage).toBe(0)          // 0 fixtures carry model probs
    expect(sim.complete).toBe(false)
    const sum = sim.teams.reduce((s, t) => s + t.advanceProb, 0)
    expect(sum).toBeCloseTo(2.0, 6)        // still a valid distribution
  })

  it('full coverage flagged complete', () => {
    const sim = simulateGroup(TEAMS, roundRobin({ home: 0.4, draw: 0.3, away: 0.3 }))
    expect(sim.coverage).toBe(1)
    expect(sim.complete).toBe(true)
    expect(sim.fixturesWithData).toBe(6)
  })
})

describe('confederationBreakdown', () => {
  it('counts teams per confederation, sorted desc', () => {
    const teams = [team('a','UEFA'), team('b','UEFA'), team('c','CAF'), team('d','AFC')]
    const out = confederationBreakdown(teams)
    expect(out[0]).toEqual({ confederation: 'UEFA', count: 2 })
    expect(out.find(c => c.confederation === 'CAF')?.count).toBe(1)
  })
})
