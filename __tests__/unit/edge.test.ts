/**
 * Unit tests for the pure edge logic (lib/edge/helpers.ts).
 *
 * The contract (docs/EDGE_PIVOT_FRONTEND.md) demands four things the UI
 * must never get wrong:
 *   1. The nullability matrix — all four payload combinations occur in prod.
 *   2. The gating rule — CTAs only when edge_validated === true.
 *   3. Rating tiers keyed on EV-at-best.
 *   4. The price guard — flip to "edge gone" below min_acceptable_odds.
 * Plus stake-cap, formatters, and parlay eligibility.
 */
import {
  extractEdge,
  isActionable,
  ratingFromEv,
  ratingAtLeast,
  priceGuard,
  displayStakeFraction,
  stakeFromBankroll,
  STAKE_DISPLAY_CAP,
  ev,
  minAcceptableOdds,
  fairOdds,
  vigFromOverround,
  formatEvPct,
  formatEdgePoints,
  edgeMeterRows,
  parlayMetrics,
  formatEvDollars,
  whyThisBet,
} from '@/lib/edge/helpers'
import type { MarketBlock, ValueBlock, ModelTrackRecord, ClvBlock } from '@/lib/edge/types'

// ─── Fixtures (worked example A — USA vs Paraguay, match 1489370) ─────────

const market: MarketBlock = {
  implied: { home: 0.4946, draw: 0.2793, away: 0.2261 },
  overround: 1.053,
  n_books: 75,
  best_price: {
    home: { odds: 2.02, book: 'betfair_ex_au' },
    draw: { odds: 3.6, book: 'onexbet' },
    away: { odds: 4.5, book: 'unibet_nl' },
  },
}

const valueWithBet: ValueBlock = {
  edge: { home: -0.1128, draw: 0.002, away: 0.1108 },
  ev_at_best: { home: -0.2288, draw: 0.0127, away: 0.516 },
  value_bet: {
    outcome: 'away',
    bet: 'away_win',
    ev: 0.516,
    price: 4.5,
    book: 'unibet_nl',
    min_acceptable_odds: 2.968,
    kelly_full: 0.1474,
    kelly_quarter: 0.0369,
  },
  rating: 'strong_value',
  min_acceptable_odds: { home: 2.619, draw: 3.555, away: 2.968 },
}

const valueNoBet: ValueBlock = { ...valueWithBet, value_bet: null, rating: 'no_value' }

const validated: ModelTrackRecord = {
  model: 'wc_elo',
  segment: 'thin_market',
  edge_validated: true,
  validation: 'temporal holdout +15.3pp vs baseline (n=765)',
  median_clv_90d: null,
  n_settled: null,
}
const unvalidated: ModelTrackRecord = {
  model: 'v3_sharp_lgbm',
  segment: 'efficient_market',
  edge_validated: false,
  validation: 'failed holdout 45.3% vs 50.9% baseline',
  median_clv_90d: null,
  n_settled: null,
}

// ─── 1. Nullability matrix (§7) ───────────────────────────────────────────

describe('extractEdge — nullability matrix', () => {
  it('(a) all blocks null → all-null view, not actionable, not no-value', () => {
    const v = extractEdge(null)
    expect(v.market).toBeNull()
    expect(v.value).toBeNull()
    expect(v.edgeValidated).toBe(false)
    expect(v.actionable).toBe(false)
    expect(v.noValue).toBe(false) // no market → nothing to say "no value" about
  })

  it('(a) empty object behaves like all-null', () => {
    const v = extractEdge({})
    expect(v.actionable).toBe(false)
    expect(v.noValue).toBe(false)
  })

  it('(b) market only (no value block) → no-value, not actionable', () => {
    const v = extractEdge({ market, model_track_record: validated })
    expect(v.market).not.toBeNull()
    expect(v.value).toBeNull()
    expect(v.actionable).toBe(false)
    expect(v.noValue).toBe(true)
  })

  it('(c) full blocks but value_bet null → no-value', () => {
    const v = extractEdge({ market, value: valueNoBet, model_track_record: validated })
    expect(v.actionable).toBe(false)
    expect(v.noValue).toBe(true)
  })

  it('(d) full blocks with a value bet from a validated model → actionable', () => {
    const v = extractEdge({ market, value: valueWithBet, model_track_record: validated })
    expect(v.actionable).toBe(true)
    expect(v.noValue).toBe(false)
    expect(isActionable(v)).toBe(true)
  })
})

// ─── 2. The gating rule ───────────────────────────────────────────────────

describe('gating on edge_validated', () => {
  it('a value bet from an UNVALIDATED model is never actionable', () => {
    const v = extractEdge({ market, value: valueWithBet, model_track_record: unvalidated })
    expect(v.edgeValidated).toBe(false)
    expect(v.actionable).toBe(false)
    // It still counts as no-value (market exists, nothing actionable) → show info, no CTA.
    expect(v.noValue).toBe(true)
  })

  it('missing track record defaults to not-validated', () => {
    const v = extractEdge({ market, value: valueWithBet })
    expect(v.edgeValidated).toBe(false)
    expect(v.actionable).toBe(false)
  })
})

// ─── 3. Rating tiers ──────────────────────────────────────────────────────

describe('ratingFromEv', () => {
  it('≤0 → no_value', () => {
    expect(ratingFromEv(0)).toBe('no_value')
    expect(ratingFromEv(-0.2288)).toBe('no_value')
  })
  it('<3% → marginal', () => {
    expect(ratingFromEv(0.0127)).toBe('marginal')
    expect(ratingFromEv(0.0299)).toBe('marginal')
  })
  it('<8% → value', () => {
    expect(ratingFromEv(0.03)).toBe('value')
    expect(ratingFromEv(0.0799)).toBe('value')
  })
  it('≥8% → strong_value', () => {
    expect(ratingFromEv(0.08)).toBe('strong_value')
    expect(ratingFromEv(0.516)).toBe('strong_value')
  })
  it('ratingAtLeast compares tiers', () => {
    expect(ratingAtLeast('strong_value', 'value')).toBe(true)
    expect(ratingAtLeast('marginal', 'value')).toBe(false)
  })
})

// ─── 4. Price guard ───────────────────────────────────────────────────────

describe('priceGuard', () => {
  const floor = 2.968
  it('live price above floor → live', () => {
    const g = priceGuard(floor, 4.5)
    expect(g.live).toBe(true)
    expect(g.edgeGone).toBe(false)
  })
  it('live price below floor → edge gone', () => {
    const g = priceGuard(floor, 2.5)
    expect(g.live).toBe(false)
    expect(g.edgeGone).toBe(true)
  })
  it('live price exactly at floor → still live (not strictly below)', () => {
    const g = priceGuard(floor, floor)
    expect(g.edgeGone).toBe(false)
  })
  it('no live quote → treated as live at captured price', () => {
    const g = priceGuard(floor, null)
    expect(g.live).toBe(true)
    expect(g.livePrice).toBeNull()
  })
})

// ─── Stake helpers ────────────────────────────────────────────────────────

describe('stake helpers', () => {
  it('quarter-Kelly passes through under the cap', () => {
    expect(displayStakeFraction(0.0369)).toBeCloseTo(0.0369, 4)
  })
  it('caps display at 5% even if Kelly says more', () => {
    expect(displayStakeFraction(0.20)).toBe(STAKE_DISPLAY_CAP)
  })
  it('non-positive Kelly → 0', () => {
    expect(displayStakeFraction(0)).toBe(0)
    expect(displayStakeFraction(-0.1)).toBe(0)
  })
  it('stakeFromBankroll multiplies + rounds to cents', () => {
    expect(stakeFromBankroll(0.0369, 1000)).toBe(36.9)
    expect(stakeFromBankroll(0.05, 250)).toBe(12.5)
  })
  it('stakeFromBankroll guards bad input', () => {
    expect(stakeFromBankroll(0.05, 0)).toBe(0)
    expect(stakeFromBankroll(0, 1000)).toBe(0)
  })
})

// ─── Math primitives + formatters ─────────────────────────────────────────

describe('math + formatters', () => {
  it('ev = p*odds - 1', () => {
    expect(ev(0.337, 4.5)).toBeCloseTo(0.5165, 3)
  })
  it('minAcceptableOdds = 1/p', () => {
    expect(minAcceptableOdds(0.337)).toBeCloseTo(2.967, 2)
  })
  it('fairOdds = 1/pFair', () => {
    expect(fairOdds(0.2261)).toBeCloseTo(4.423, 2)
  })
  it('vig from overround', () => {
    expect(vigFromOverround(1.053)).toBeCloseTo(0.053, 3)
  })
  it('formatEvPct signs correctly', () => {
    expect(formatEvPct(0.058)).toBe('+5.8%')
    expect(formatEvPct(-0.2288)).toBe('−22.9%')
    expect(formatEvPct(0)).toBe('0.0%')
  })
  it('formatEdgePoints signs correctly', () => {
    expect(formatEdgePoints(0.1108)).toBe('+11.1')
    expect(formatEdgePoints(-0.1128)).toBe('−11.3')
  })
})

// ─── Edge meter rows ──────────────────────────────────────────────────────

describe('edgeMeterRows', () => {
  it('builds H/D/A rows with edge = model − market, flags value outcome', () => {
    const rows = edgeMeterRows(
      market,
      { home: 0.38, draw: 0.28, away: 0.337 },
      valueWithBet,
    )
    expect(rows).toHaveLength(3)
    const away = rows.find(r => r.outcome === 'away')!
    expect(away.edge).toBeCloseTo(0.337 - 0.2261, 4)
    expect(away.isValueOutcome).toBe(true)
    expect(rows.find(r => r.outcome === 'home')!.isValueOutcome).toBe(false)
  })
})

// ─── Parlay metrics (§4.7, worked example C) ──────────────────────────────

describe('parlayMetrics', () => {
  it('two +EV validated legs → eligible, compounded EV positive', () => {
    const m = parlayMetrics([
      { pModel: 0.55, price: 2.0, ev: 0.10, edgeValidated: true },
      { pModel: 0.52, price: 2.15, ev: 0.12, edgeValidated: true },
    ])
    expect(m.eligible).toBe(true)
    expect(m.ev).toBeGreaterThan(0)
    expect(m.offered_odds).toBeCloseTo(4.3, 5)
    expect(m.reasons).toHaveLength(0)
  })

  it('a −EV anchor favorite poisons the ticket → ineligible', () => {
    const m = parlayMetrics([
      { pModel: 0.55, price: 2.0, ev: 0.10, edgeValidated: true },
      { pModel: 0.52, price: 2.15, ev: 0.12, edgeValidated: true },
      { pModel: 0.78, price: 1.4, ev: -0.09, edgeValidated: true },
    ])
    expect(m.eligible).toBe(false)
    expect(m.reasons.some(r => /EV ≤ 0/.test(r))).toBe(true)
  })

  it('an unvalidated leg makes the ticket ineligible', () => {
    const m = parlayMetrics([
      { pModel: 0.55, price: 2.0, ev: 0.10, edgeValidated: true },
      { pModel: 0.52, price: 2.15, ev: 0.12, edgeValidated: false },
    ])
    expect(m.eligible).toBe(false)
    expect(m.reasons.some(r => /unvalidated/.test(r))).toBe(true)
  })

  it('1 leg or 4 legs → ineligible (2..3 only)', () => {
    expect(parlayMetrics([{ pModel: 0.55, price: 2, ev: 0.1, edgeValidated: true }]).eligible).toBe(false)
    const four = Array.from({ length: 4 }, () => ({ pModel: 0.55, price: 2, ev: 0.1, edgeValidated: true }))
    expect(parlayMetrics(four).eligible).toBe(false)
  })
})

// ─── CLV passthrough sanity ───────────────────────────────────────────────

describe('clv block passthrough', () => {
  it('extractEdge surfaces the clv block untouched', () => {
    const clv: ClvBlock = { bet_time_odds: 4.5, closing_odds: null, realized_clv: null }
    const v = extractEdge({ market, value: valueWithBet, clv, model_track_record: validated })
    expect(v.clv).toEqual(clv)
  })
})

// ─── 2-way sports (no draw key) — QA plan §1/§3 ───────────────────────────

describe('2-way payloads (NBA/NHL — draw key absent)', () => {
  const market2way: MarketBlock = {
    implied: { home: 0.587, away: 0.413 },
    overround: 1.041,
    n_books: 12,
    best_price: {
      home: { odds: 1.78, book: 'fanduel' },
      away: { odds: 2.46, book: 'draftkings' },
    },
  }

  it('edgeMeterRows omits the draw row → 2-outcome grid', () => {
    const rows = edgeMeterRows(market2way, { home: 0.55, away: 0.45 }, null)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.outcome)).toEqual(['home', 'away'])
  })

  it('implied probs sum to 1.0 across 2 outcomes', () => {
    const sum = (market2way.implied.home ?? 0) + (market2way.implied.draw ?? 0) + (market2way.implied.away ?? 0)
    expect(sum).toBeCloseTo(1.0, 3)
  })

  it('extractEdge handles a 2-way payload without throwing', () => {
    const v = extractEdge({ market: market2way, value: null, clv: null, model_track_record: null })
    expect(v.market).not.toBeNull()
    expect(v.actionable).toBe(false)
    expect(v.noValue).toBe(true)
  })
})

// ─── Presentation helpers (WhyThisBet / dollar EV) ─────────────────────────

describe('formatEvDollars + whyThisBet', () => {
  it('formats EV as dollars per $100 staked', () => {
    expect(formatEvDollars(0.415)).toBe('+$42 per $100 staked')
    expect(formatEvDollars(-0.229)).toBe('−$23 per $100 staked')
    expect(formatEvDollars(0)).toBe('$0 per $100 staked')
  })

  it('builds the full plain-English sentence when all pieces are present', () => {
    const s = whyThisBet({
      sideLabel: 'Paraguay', marketProb: 0.2261, modelProb: 0.337,
      price: 4.5, book: 'unibet_nl', ev: 0.516,
    })
    expect(s).toBe(
      'The market prices Paraguay at 23% — our model makes it 34%. At 4.50 (unibet_nl), that\'s about +$52 per $100 staked over the long run.'
    )
  })

  it('degrades gracefully without market/model probs or price', () => {
    const s = whyThisBet({ sideLabel: 'the draw', marketProb: null, modelProb: null, price: null, book: null, ev: 0.1 })
    expect(s).toBe('Our model prices the draw above the market. That\'s about +$10 per $100 staked over the long run.')
  })
})
