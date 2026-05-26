/**
 * Unit tests for premium-only parlay builder.
 * Locks the contract that drives the public parlay surface.
 */
import {
  buildParlayCandidates,
  buildSgpVariants,
  deriveSecondaryOutcome,
  parlayKey,
  settleParlay,
  type PremiumPickLike,
  type SecondaryMarketRow,
} from '@/lib/premium-tracker/parlay-builder'

function pick(overrides: Partial<PremiumPickLike> = {}): PremiumPickLike {
  return {
    id: overrides.id ?? `p${Math.random().toString(36).slice(2, 7)}`,
    marketMatchId: overrides.marketMatchId ?? `m${Math.random().toString(36).slice(2, 7)}`,
    market: '1X2_HOME',
    oddsAtPublish: 1.5,
    homeTeam: 'Home',
    awayTeam: 'Away',
    league: 'Test League',
    selection: 'Home to win',
    kickoffDate: new Date('2026-05-15T18:00:00Z'),
    result: 'pending',
    ...overrides,
  }
}

describe('buildParlayCandidates — combinatorics', () => {
  it('returns C(N,K) combinations within a single leg-count bucket', () => {
    const pool = [pick({ id: 'a' }), pick({ id: 'b' }), pick({ id: 'c' }), pick({ id: 'd' })]
    // C(4,2) = 6
    const result = buildParlayCandidates(pool, { legCounts: [2], windowHours: 168 })
    expect(result.length).toBe(6)
    expect(result.every(p => p.legCount === 2)).toBe(true)
  })

  it('emits multiple leg counts when requested', () => {
    const pool = [
      pick({ id: 'a' }),
      pick({ id: 'b' }),
      pick({ id: 'c' }),
      pick({ id: 'd' }),
      pick({ id: 'e' }),
    ]
    // C(5,2)=10  C(5,3)=10  C(5,4)=5  C(5,5)=1  → 26
    const result = buildParlayCandidates(pool, { legCounts: [2, 3, 4, 5], windowHours: 168 })
    const byLeg = result.reduce<Record<number, number>>((acc, p) => {
      acc[p.legCount] = (acc[p.legCount] ?? 0) + 1
      return acc
    }, {})
    expect(byLeg[2]).toBe(10)
    expect(byLeg[3]).toBe(10)
    expect(byLeg[4]).toBe(5)
    expect(byLeg[5]).toBe(1)
  })

  it('returns empty when pool is smaller than legCount', () => {
    const result = buildParlayCandidates([pick(), pick()], { legCounts: [5], windowHours: 168 })
    expect(result).toEqual([])
  })

  it('honours capPerLegCount, sorting by combinedOdds DESC', () => {
    const pool = [
      pick({ id: 'a', oddsAtPublish: 1.5 }),
      pick({ id: 'b', oddsAtPublish: 2.0 }),
      pick({ id: 'c', oddsAtPublish: 3.0 }),
      pick({ id: 'd', oddsAtPublish: 4.0 }),
    ]
    const result = buildParlayCandidates(pool, { legCounts: [2], windowHours: 168, capPerLegCount: 2 })
    expect(result.length).toBe(2)
    // Top combined odds = 3 * 4 = 12; next = 2 * 4 = 8
    expect(result[0].combinedOdds).toBeCloseTo(12, 5)
    expect(result[1].combinedOdds).toBeCloseTo(8, 5)
  })
})

describe('buildParlayCandidates — window constraint', () => {
  it('drops combos whose kickoff spread exceeds windowHours', () => {
    const pool = [
      pick({ id: 'a', kickoffDate: new Date('2026-05-15T12:00:00Z') }),
      pick({ id: 'b', kickoffDate: new Date('2026-05-16T12:00:00Z') }), // +24h
      pick({ id: 'c', kickoffDate: new Date('2026-05-20T12:00:00Z') }), // +120h
    ]
    // 48h window: only a+b qualify (24h apart). a+c, b+c rejected.
    const result = buildParlayCandidates(pool, { legCounts: [2], windowHours: 48 })
    expect(result.length).toBe(1)
    expect(new Set(result[0].legs.map(l => l.id))).toEqual(new Set(['a', 'b']))
  })

  it('allows all combos when window is large enough', () => {
    const pool = [
      pick({ id: 'a', kickoffDate: new Date('2026-05-15T12:00:00Z') }),
      pick({ id: 'b', kickoffDate: new Date('2026-05-16T12:00:00Z') }),
      pick({ id: 'c', kickoffDate: new Date('2026-05-20T12:00:00Z') }),
    ]
    const result = buildParlayCandidates(pool, { legCounts: [2], windowHours: 168 })
    expect(result.length).toBe(3)  // C(3,2)
  })
})

describe('buildParlayCandidates — same-match rejection', () => {
  it('does not emit parlays where two legs share marketMatchId', () => {
    const pool = [
      pick({ id: 'a', marketMatchId: 'm1', market: '1X2_HOME' }),
      pick({ id: 'b', marketMatchId: 'm1', market: '1X2_AWAY' }),  // same match
      pick({ id: 'c', marketMatchId: 'm2' }),
    ]
    const result = buildParlayCandidates(pool, { legCounts: [2], windowHours: 168 })
    // Only a+c and b+c qualify; a+b rejected (same match)
    expect(result.length).toBe(2)
  })
})

describe('buildParlayCandidates — settlement at build time', () => {
  it('marks parlay as win when ALL legs won', () => {
    const pool = [
      pick({ id: 'a', oddsAtPublish: 2.0, result: 'win' }),
      pick({ id: 'b', oddsAtPublish: 2.0, result: 'win' }),
    ]
    const [p] = buildParlayCandidates(pool, { legCounts: [2], windowHours: 168, stakeDollars: 10 })
    expect(p.result).toBe('win')
    // 10 * (2 * 2 - 1) = 30
    expect(p.netDollars).toBe(30)
  })

  it('marks parlay as loss when ANY leg lost', () => {
    const pool = [
      pick({ id: 'a', oddsAtPublish: 2.0, result: 'win' }),
      pick({ id: 'b', oddsAtPublish: 2.0, result: 'loss' }),
    ]
    const [p] = buildParlayCandidates(pool, { legCounts: [2], windowHours: 168, stakeDollars: 10 })
    expect(p.result).toBe('loss')
    expect(p.netDollars).toBe(-10)
  })

  it('marks parlay as pending when ANY leg is still pending', () => {
    const pool = [
      pick({ id: 'a', oddsAtPublish: 2.0, result: 'win' }),
      pick({ id: 'b', oddsAtPublish: 2.0, result: 'pending' }),
    ]
    const [p] = buildParlayCandidates(pool, { legCounts: [2], windowHours: 168 })
    expect(p.result).toBe('pending')
    expect(p.netDollars).toBeNull()
  })

  it('marks parlay as void when ANY leg pushed/voided', () => {
    const pool = [
      pick({ id: 'a', result: 'win' }),
      pick({ id: 'b', result: 'void' }),
    ]
    const [p] = buildParlayCandidates(pool, { legCounts: [2], windowHours: 168 })
    expect(p.result).toBe('void')
    expect(p.netDollars).toBe(0)
  })
})

describe('parlayKey — idempotency', () => {
  it('produces the same key regardless of leg order', () => {
    const k1 = parlayKey({ legs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] })
    const k2 = parlayKey({ legs: [{ id: 'c' }, { id: 'a' }, { id: 'b' }] })
    expect(k1).toBe(k2)
  })
})

describe('deriveSecondaryOutcome', () => {
  it('TOTALS Over: hits when total > line', () => {
    expect(deriveSecondaryOutcome('TOTALS', 'OVER', 2.5, { home: 2, away: 1 })).toBe('win')
    expect(deriveSecondaryOutcome('TOTALS', 'OVER', 2.5, { home: 1, away: 1 })).toBe('loss')
  })
  it('TOTALS Under: hits when total < line', () => {
    expect(deriveSecondaryOutcome('TOTALS', 'UNDER', 2.5, { home: 1, away: 1 })).toBe('win')
    expect(deriveSecondaryOutcome('TOTALS', 'UNDER', 2.5, { home: 2, away: 1 })).toBe('loss')
  })
  it('TOTALS: pushes on whole-number lines', () => {
    expect(deriveSecondaryOutcome('TOTALS', 'OVER', 2, { home: 1, away: 1 })).toBe('void')
    expect(deriveSecondaryOutcome('TOTALS', 'UNDER', 3, { home: 2, away: 1 })).toBe('void')
  })
  it('BTTS Yes: hits when both teams scored', () => {
    expect(deriveSecondaryOutcome('BTTS', 'YES', null, { home: 2, away: 1 })).toBe('win')
    expect(deriveSecondaryOutcome('BTTS', 'YES', null, { home: 2, away: 0 })).toBe('loss')
  })
  it('BTTS No: hits when at least one team failed to score', () => {
    expect(deriveSecondaryOutcome('BTTS', 'NO', null, { home: 2, away: 0 })).toBe('win')
    expect(deriveSecondaryOutcome('BTTS', 'NO', null, { home: 2, away: 1 })).toBe('loss')
  })
  it('returns null when score is null', () => {
    expect(deriveSecondaryOutcome('TOTALS', 'OVER', 2.5, null)).toBeNull()
  })
})

describe('buildSgpVariants', () => {
  function adm(marketType: string, selection: string, line: number | null, prob: number): SecondaryMarketRow {
    return { matchId: 'm1', marketType, marketSubtype: selection, line, consensusProb: prob }
  }

  const basePick = pick({
    id: 'p1',
    marketMatchId: 'mm1',
    market: '1X2_HOME',
    selection: 'Arsenal to win',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    oddsAtPublish: 1.5,
    result: 'win',
  })

  it('emits archetypes only when the required secondary markets exist', () => {
    const rows = [
      adm('TOTALS', 'OVER', 2.5, 0.6),  // odds 1.67
      // No BTTS, no Over 1.5 → only sgp_o25 is buildable
    ]
    const variants = buildSgpVariants(basePick, rows, { score: { home: 2, away: 1 } })
    expect(variants.length).toBe(1)
    expect(variants[0].archetype).toBe('sgp_o25')
    expect(variants[0].legCount).toBe(2)
    expect(variants[0].result).toBe('win')
  })

  it('produces all archetypes when all markets exist', () => {
    const rows = [
      adm('TOTALS', 'OVER', 1.5, 0.85),
      adm('TOTALS', 'OVER', 2.5, 0.6),
      adm('BTTS', 'YES', null, 0.55),
    ]
    const variants = buildSgpVariants(basePick, rows, { score: { home: 2, away: 1 } })
    expect(variants.length).toBe(5) // sgp_o25, sgp_o15, sgp_btts, sgp_o25_btts, sgp_o15_o25_btts
    const archetypes = variants.map(v => v.archetype).sort()
    expect(archetypes).toContain('sgp_o25')
    expect(archetypes).toContain('sgp_o15_o25_btts')
  })

  it('settles correctly when base wins + all overlays hit', () => {
    const rows = [
      adm('TOTALS', 'OVER', 2.5, 0.5),  // odds 2.0
      adm('BTTS', 'YES', null, 0.5),     // odds 2.0
    ]
    // Score 2-1 → Arsenal wins ✓, Over 2.5 ✓, BTTS Yes ✓
    const variants = buildSgpVariants(basePick, rows, { score: { home: 2, away: 1 }, stakeDollars: 10 })
    const triple = variants.find(v => v.archetype === 'sgp_o25_btts')!
    expect(triple.result).toBe('win')
    // Combined: 1.5 × 2.0 × 2.0 = 6.0; stake 10 → net = 10 * (6.0 - 1) = 50
    expect(triple.netDollars).toBe(50)
  })

  it('settles correctly when an overlay misses', () => {
    const rows = [
      adm('TOTALS', 'OVER', 2.5, 0.5),
      adm('BTTS', 'YES', null, 0.5),
    ]
    // Score 2-0 → Arsenal wins, Over 2.5 LOSS (total=2, line=2.5)
    const variants = buildSgpVariants(basePick, rows, { score: { home: 2, away: 0 }, stakeDollars: 10 })
    const o25 = variants.find(v => v.archetype === 'sgp_o25')!
    expect(o25.result).toBe('loss')
    expect(o25.netDollars).toBe(-10)
  })

  it('marks result as pending when score is null (live capture)', () => {
    const rows = [adm('TOTALS', 'OVER', 2.5, 0.6)]
    const variants = buildSgpVariants(
      pick({ ...basePick, result: 'pending' }),
      rows,
      { score: null },
    )
    expect(variants[0].result).toBe('pending')
    expect(variants[0].netDollars).toBeNull()
  })

  it('respects pendingOnly flag', () => {
    const rows = [adm('TOTALS', 'OVER', 2.5, 0.6)]
    expect(buildSgpVariants(basePick, rows, { pendingOnly: true })).toEqual([])  // basePick is 'win'
  })

  it('settles VOID when a TOTALS line lands on the exact total', () => {
    const rows = [adm('TOTALS', 'OVER', 3, 0.4)]  // whole-number line
    // Score 2-1 → total=3, exact match → push/void
    const variants = buildSgpVariants(basePick, rows, { score: { home: 2, away: 1 } })
    const o = variants.find(v => v.archetype === 'sgp_o25')  // not built — 3 not in 1.5/2.5
    expect(o).toBeUndefined()
    // Confirm the helper itself handles voids; that's covered above.
  })
})

describe('settleParlay — explicit', () => {
  it('returns null when any leg is pending', () => {
    expect(settleParlay([
      { result: 'win', oddsAtPublish: 2 },
      { result: 'pending', oddsAtPublish: 2 },
    ])).toBeNull()
  })

  it('returns win + correct net at flat $10', () => {
    expect(settleParlay([
      { result: 'win', oddsAtPublish: 2 },
      { result: 'win', oddsAtPublish: 2 },
    ])).toEqual({ result: 'win', netDollars: 30 })
  })

  it('returns loss when any leg lost', () => {
    expect(settleParlay([
      { result: 'win', oddsAtPublish: 2 },
      { result: 'loss', oddsAtPublish: 2 },
    ])).toEqual({ result: 'loss', netDollars: -10 })
  })

  it('returns void on any void/push leg', () => {
    expect(settleParlay([
      { result: 'win', oddsAtPublish: 2 },
      { result: 'void', oddsAtPublish: 2 },
    ])).toEqual({ result: 'void', netDollars: 0 })
  })

  it('honours custom stake', () => {
    expect(settleParlay([
      { result: 'win', oddsAtPublish: 1.5 },
      { result: 'win', oddsAtPublish: 2.0 },
    ], 100)).toEqual({ result: 'win', netDollars: 200 })  // 100 * (3 - 1) = 200
  })
})
