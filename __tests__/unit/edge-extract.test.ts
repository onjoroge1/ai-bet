/**
 * Unit tests for lib/edge/extract.ts — the layer between STORED prediction
 * payloads and the edge UI.
 *
 * Contracts pinned here:
 *  1. edgeFromPredictionData resolves the edge blocks from every historical
 *     nesting (top-level, .prediction, .data, .data.prediction) and never
 *     throws on garbage.
 *  2. summarizeEdge/hasActionableValue collapse the gating rule for chips.
 *  3. v3ModelEdgeFields returns null for pre-pivot payloads (so legacy
 *     v3Model writes are untouched) and the additive keys otherwise.
 *  4. edgeSummaryFromV3Model round-trips the keys and returns null for
 *     legacy v3Model rows.
 */
import {
  edgeFromPredictionData,
  edgeSummaryFromPredictionData,
  summarizeEdge,
  hasActionableValue,
  v3ModelEdgeFields,
  edgeSummaryFromV3Model,
} from '@/lib/edge/extract'
import type { EdgePayload } from '@/lib/edge/types'

// Worked-example shapes (§8 — USA vs Paraguay)
const blocks: EdgePayload = {
  market: {
    implied: { home: 0.4946, draw: 0.2793, away: 0.2261 },
    overround: 1.053,
    n_books: 75,
    best_price: {
      home: { odds: 2.02, book: 'betfair_ex_au' },
      draw: { odds: 3.6, book: 'onexbet' },
      away: { odds: 4.5, book: 'unibet_nl' },
    },
  },
  value: {
    edge: { home: -0.1128, draw: 0.002, away: 0.1108 },
    ev_at_best: { home: -0.2288, draw: 0.0127, away: 0.516 },
    value_bet: {
      outcome: 'away', bet: 'away_win', ev: 0.516, price: 4.5, book: 'unibet_nl',
      min_acceptable_odds: 2.968, kelly_full: 0.1474, kelly_quarter: 0.0369,
    },
    rating: 'strong_value',
    min_acceptable_odds: { home: 2.619, draw: 3.555, away: 2.968 },
  },
  clv: { bet_time_odds: 4.5, closing_odds: null, realized_clv: null },
  model_track_record: {
    model: 'wc_elo', segment: 'thin_market', edge_validated: true,
    validation: 'temporal holdout +15.3pp vs baseline (n=765)',
    median_clv_90d: null, n_settled: null,
  },
}

// A realistic legacy payload (pre-pivot) — predictions only, no edge blocks
const legacyPayload = {
  predictions: { home_win: 0.45, draw: 0.28, away_win: 0.27, confidence: 0.62, recommended_bet: 'home_win' },
  analysis: { ai_summary: 'text' },
}

describe('edgeFromPredictionData — nesting resolution', () => {
  it('finds blocks at top level', () => {
    const v = edgeFromPredictionData({ ...legacyPayload, ...blocks })
    expect(v.market).not.toBeNull()
    expect(v.actionable).toBe(true)
  })

  it('finds blocks under .prediction', () => {
    const v = edgeFromPredictionData({ prediction: { ...legacyPayload, ...blocks } })
    expect(v.actionable).toBe(true)
  })

  it('finds blocks under .data', () => {
    const v = edgeFromPredictionData({ data: { ...blocks } })
    expect(v.actionable).toBe(true)
  })

  it('finds blocks under .data.prediction', () => {
    const v = edgeFromPredictionData({ data: { prediction: { ...blocks } } })
    expect(v.actionable).toBe(true)
  })

  it('legacy payload (no blocks) → all-null view, not actionable, not no-value', () => {
    const v = edgeFromPredictionData(legacyPayload)
    expect(v.market).toBeNull()
    expect(v.actionable).toBe(false)
    expect(v.noValue).toBe(false)
  })

  it('never throws on garbage', () => {
    expect(() => edgeFromPredictionData(null)).not.toThrow()
    expect(() => edgeFromPredictionData(undefined)).not.toThrow()
    expect(() => edgeFromPredictionData('a string')).not.toThrow()
    expect(() => edgeFromPredictionData(42)).not.toThrow()
    expect(() => edgeFromPredictionData([])).not.toThrow()
    expect(edgeFromPredictionData(null).actionable).toBe(false)
  })
})

describe('summarizeEdge / hasActionableValue', () => {
  it('actionable value bet → full summary', () => {
    const s = edgeSummaryFromPredictionData(blocks)
    expect(s.validated).toBe(true)
    expect(s.actionable).toBe(true)
    expect(s.rating).toBe('strong_value')
    expect(s.ev).toBeCloseTo(0.516, 3)
    expect(s.outcome).toBe('away')
    expect(s.book).toBe('unibet_nl')
    expect(hasActionableValue(s)).toBe(true)
  })

  it('unvalidated model → summary present but NOT actionable (the gating rule)', () => {
    const unval = {
      ...blocks,
      model_track_record: { ...blocks.model_track_record!, edge_validated: false },
    }
    const s = edgeSummaryFromPredictionData(unval)
    expect(s.validated).toBe(false)
    expect(s.actionable).toBe(false)
    expect(hasActionableValue(s)).toBe(false)
  })

  it('value_bet null → not actionable', () => {
    const noBet = { ...blocks, value: { ...blocks.value!, value_bet: null, rating: 'no_value' as const } }
    const s = edgeSummaryFromPredictionData(noBet)
    expect(s.actionable).toBe(false)
    expect(s.ev).toBeNull()
    expect(hasActionableValue(s)).toBe(false)
  })

  it('legacy payload → empty summary', () => {
    const s = edgeSummaryFromPredictionData(legacyPayload)
    expect(s.validated).toBe(false)
    expect(s.rating).toBeNull()
    expect(hasActionableValue(s)).toBe(false)
  })

  it('stale-price outliers are NOT actionable (suspect guard)', () => {
    // Observed in production: 63.0 odds at an obscure book → "+1353% EV".
    const outlierEv = {
      ...blocks,
      value: {
        ...blocks.value!,
        value_bet: { ...blocks.value!.value_bet!, ev: 13.53, price: 63, book: 'mybookieag' },
      },
    }
    expect(hasActionableValue(edgeSummaryFromPredictionData(outlierEv))).toBe(false)

    // Absurd price alone also trips the guard even with moderate EV
    const outlierPrice = {
      ...blocks,
      value: {
        ...blocks.value!,
        value_bet: { ...blocks.value!.value_bet!, ev: 0.9, price: 40, book: 'smarkets' },
      },
    }
    expect(hasActionableValue(edgeSummaryFromPredictionData(outlierPrice))).toBe(false)

    // The manual's worked example (+51.6% at 4.50) stays actionable
    expect(hasActionableValue(edgeSummaryFromPredictionData(blocks))).toBe(true)
  })
})

describe('v3ModelEdgeFields — additive persistence keys', () => {
  it('returns null for pre-pivot payloads so legacy writes stay untouched', () => {
    expect(v3ModelEdgeFields(legacyPayload)).toBeNull()
    expect(v3ModelEdgeFields(null)).toBeNull()
    expect(v3ModelEdgeFields({})).toBeNull()
  })

  it('returns the additive keys for an edge payload', () => {
    const f = v3ModelEdgeFields(blocks)!
    expect(f).not.toBeNull()
    expect(f.edge_validated).toBe(true)
    expect(f.value_rating).toBe('strong_value')
    expect(f.value_ev).toBeCloseTo(0.516, 3)
    expect(f.value_outcome).toBe('away')
    expect(f.value_price).toBe(4.5)
    expect(f.value_book).toBe('unibet_nl')
    expect(f.min_acceptable_odds).toBeCloseTo(2.968, 3)
  })

  it('market-only payload (no value bet) still produces fields with nulls', () => {
    const f = v3ModelEdgeFields({ market: blocks.market, model_track_record: blocks.model_track_record })!
    expect(f).not.toBeNull()
    expect(f.edge_validated).toBe(true)
    expect(f.value_rating).toBeNull()
    expect(f.value_ev).toBeNull()
  })
})

describe('edgeSummaryFromV3Model — hub-surface read path', () => {
  it('round-trips through a simulated v3Model write', () => {
    // Simulate the predict route: legacy v3 fields + merged edge keys
    const v3Model = {
      pick: 'away', confidence: 0.34, probs: { home: 0.38, draw: 0.28, away: 0.34 },
      source: 'wc_elo',
      ...v3ModelEdgeFields(blocks)!,
    }
    const s = edgeSummaryFromV3Model(v3Model)!
    expect(s).not.toBeNull()
    expect(s.validated).toBe(true)
    expect(s.actionable).toBe(true)
    expect(s.rating).toBe('strong_value')
    expect(s.ev).toBeCloseTo(0.516, 3)
    expect(hasActionableValue(s)).toBe(true)
  })

  it('legacy v3Model rows (no edge keys) → null', () => {
    expect(edgeSummaryFromV3Model({ pick: 'home', confidence: 0.62 })).toBeNull()
    expect(edgeSummaryFromV3Model(null)).toBeNull()
    expect(edgeSummaryFromV3Model('junk')).toBeNull()
  })

  it('unvalidated edge keys → present but not actionable', () => {
    const v3Model = {
      pick: 'away',
      ...v3ModelEdgeFields({
        ...blocks,
        model_track_record: { ...blocks.model_track_record!, edge_validated: false },
      })!,
    }
    const s = edgeSummaryFromV3Model(v3Model)!
    expect(s.validated).toBe(false)
    expect(s.actionable).toBe(false)
  })
})
