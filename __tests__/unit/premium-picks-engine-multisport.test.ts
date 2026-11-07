/**
 * Multisport pick selection (PR-3): cold-start rows are never picks, an
 * edge-validated value bet wins over confidence buckets, NFL gates are
 * provisional, and the legacy NBA/NHL buckets still behave.
 */
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: { multisportMatch: { findMany: jest.fn() }, marketMatch: { findMany: jest.fn() }, quickPurchase: { findMany: jest.fn() } },
}))

import { MULTISPORT_CONF_GATES, evaluateMultisportPick, multisportShort } from '@/lib/premium-picks-engine'

const model = (pick: 'H' | 'A', confidence: number, extra: Record<string, unknown> = {}) => ({
  predictions: {
    home_win: pick === 'H' ? confidence : 1 - confidence,
    away_win: pick === 'H' ? 1 - confidence : confidence,
    pick, confidence, ...extra,
  },
  source: 'v3_multisport', no_draw: true,
})

const edgePayload = (validated: boolean, outcome: 'home' | 'away', ev = 0.06, price = 2.1) => ({
  market: { implied: { home: 0.5, away: 0.5 }, overround: 1.04, n_books: 8, best_price: {} },
  value: {
    edge: { home: 0.05, away: -0.05 }, ev_at_best: { home: ev, away: -0.1 },
    value_bet: { outcome, bet: outcome === 'home' ? 'home_win' : 'away_win', ev, price, book: 'draftkings',
                 min_acceptable_odds: 1.8, kelly_full: 0.08, kelly_quarter: 0.02 },
    rating: 'value', min_acceptable_odds: { home: 1.8, away: 2.4 },
  },
  clv: { bet_time_odds: price, closing_odds: null, realized_clv: null },
  model_track_record: { model: 'v3_multisport_football', segment: 'efficient_market', edge_validated: validated,
                        validation: 'test', median_clv_90d: null, n_settled: 150 },
})

describe('evaluateMultisportPick', () => {
  it('maps sport keys to the short codes used by the picks UI', () => {
    expect(multisportShort('americanfootball_nfl')).toBe('nfl')
    expect(multisportShort('basketball_nba')).toBe('nba')
    expect(multisportShort('icehockey_nhl')).toBe('nhl')
    expect(MULTISPORT_CONF_GATES.nfl).toBeGreaterThan(0.5)
  })

  it('never picks during the cold start (no model block)', () => {
    const r = evaluateMultisportPick('nfl', { model: null, predictionData: { market: { implied: { home: 0.6, away: 0.4 } } } })
    expect(r.qualifies).toBe(false)
    expect(r.pick).toBeNull()
  })

  it('an edge-validated value bet becomes a value pick on the bet outcome, even against the model argmax', () => {
    // model favours home at 0.56 (below every gate) but the market overpays the away side
    const r = evaluateMultisportPick('nba', { model: model('H', 0.56), predictionData: edgePayload(true, 'away') })
    expect(r.qualifies).toBe(true)
    expect(r.tier).toBe('value')
    expect(r.pick).toBe('A')
    expect(r.edgeActionable).toBe(true)
    expect(r.edgePrice).toBe(2.1)
    expect(r.reasons[0]).toMatch(/Edge-validated value bet: \+6% EV at 2.1 \(draftkings\)/)
  })

  it('ignores a value bet when the model is not edge-validated', () => {
    const r = evaluateMultisportPick('nba', { model: model('H', 0.56), predictionData: edgePayload(false, 'away') })
    expect(r.qualifies).toBe(false)
    expect(r.edgeActionable).toBe(false)
  })

  it('NFL gates are provisional: strong favourite ≥0.75, standard ≥0.65, nothing below, no premium', () => {
    expect(evaluateMultisportPick('nfl', { model: model('H', 0.78), predictionData: null })).toMatchObject({
      qualifies: true, tier: 'strong', pick: 'H',
    })
    const std = evaluateMultisportPick('nfl', { model: model('A', 0.68), predictionData: null })
    expect(std).toMatchObject({ qualifies: true, tier: 'standard', pick: 'A' })
    expect(std.reasons[0]).toMatch(/provisional/)
    expect(evaluateMultisportPick('nfl', { model: model('H', 0.6), predictionData: null }).qualifies).toBe(false)
    // conviction_tier premium from the model must not promote NFL to premium
    expect(evaluateMultisportPick('nfl', { model: model('H', 0.9, { conviction_tier: 'premium' }), predictionData: null }).tier).toBe('strong')
  })

  it('NFL underdog calls are skipped without evidence', () => {
    const m = { predictions: { home_win: 0.42, away_win: 0.58, pick: 'H', confidence: 0.7 } }
    expect(evaluateMultisportPick('nfl', { model: m, predictionData: null }).qualifies).toBe(false)
  })

  it('keeps the legacy NBA buckets', () => {
    expect(evaluateMultisportPick('nba', { model: model('H', 0.9, { conviction_tier: 'premium' }), predictionData: null }).tier).toBe('premium')
    expect(evaluateMultisportPick('nba', { model: model('A', 0.86), predictionData: null }).tier).toBe('strong')
    expect(evaluateMultisportPick('nba', { model: model('A', 0.78), predictionData: null }).tier).toBe('value')
    expect(evaluateMultisportPick('nba', { model: model('A', 0.7), predictionData: null }).qualifies).toBe(false)
  })

  it('keeps the legacy NHL buckets (≥0.85 suppressed, 65-75 sweet spot)', () => {
    expect(evaluateMultisportPick('nhl', { model: model('H', 0.9), predictionData: null }).qualifies).toBe(false)
    expect(evaluateMultisportPick('nhl', { model: model('H', 0.7), predictionData: null })).toMatchObject({ qualifies: true, tier: 'value' })
    expect(evaluateMultisportPick('nhl', { model: model('H', 0.8), predictionData: null }).tier).toBe('strong')
  })
})
