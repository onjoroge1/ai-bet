/**
 * Edge-payload v1 (2026-06-12) — the four new top-level blocks served on
 * /predict and /predict-wc. Additive and backward-compatible: every block
 * is nullable; render gracefully when null.
 *
 * Source of truth: docs/EDGE_PIVOT_FRONTEND.md §2. These interfaces mirror
 * the backend contract field-for-field. Do not "improve" the shapes — they
 * must match what the backend serves.
 */

export type Outcome = 'home' | 'draw' | 'away'
export type CanonicalBet = 'home_win' | 'draw' | 'away_win'
export type ValueRating = 'no_value' | 'marginal' | 'value' | 'strong_value'
export type MarketSegment = 'thin_market' | 'efficient_market' | 'unknown'

/** Per-outcome numeric map (probabilities, edges, EVs, …).
 *  ⚠ 2-way sports (NBA/NHL/MLB): the `draw` key is ABSENT everywhere —
 *  it's optional here so the same types serve 3-way soccer and 2-way
 *  multisport payloads (QA plan §1). */
export interface OutcomeTriple {
  home: number
  draw?: number
  away: number
}

// ─── 2.1 market — the de-vigged line (null when no odds collected) ──────

export interface BestPriceEntry {
  odds: number
  book: string
}

export interface MarketBlock {
  /** FAIR probabilities, vig removed, sum = 1.0. */
  implied: OutcomeTriple
  /** Raw market sum; (overround - 1) = the vig (e.g. 1.053 → ~5.3%). */
  overround: number
  /** Bookmaker count behind the line. */
  n_books: number
  /** Best available decimal odds per outcome. Each entry is nullable;
   *  `draw` is absent entirely on 2-way sports. */
  best_price: {
    home: BestPriceEntry | null
    draw?: BestPriceEntry | null
    away: BestPriceEntry | null
  }
}

// ─── 2.2 value — the edge analysis (null when market is null) ───────────

export interface ValueBet {
  outcome: Outcome
  /** Canonical bet code. */
  bet: CanonicalBet
  /** Expected value per 1u at best price (fraction, 0.516 = +51.6%). */
  ev: number
  price: number
  book: string
  /** Below this price the edge is GONE. */
  min_acceptable_odds: number
  /** Stake fractions of bankroll. */
  kelly_full: number
  kelly_quarter: number
}

export interface ValueBlock {
  /** p_model − p_market, in probability points (fraction, 0.1108 = +11.08pts). */
  edge: OutcomeTriple
  /** Expected value per 1u at best price, per outcome (fraction). */
  ev_at_best: OutcomeTriple
  /** ⚠ NULLABLE — null = "no bet" (common, correct). */
  value_bet: ValueBet | null
  rating: ValueRating
  /** Break-even price floor per outcome (1 / p_model). */
  min_acceptable_odds: OutcomeTriple
}

// ─── 2.3 clv — the verification ledger (fills in over time) ─────────────

export interface ClvBlock {
  /** The value-bet price captured at predict time. */
  bet_time_odds: number | null
  /** Sampled at kickoff by the closing sampler. */
  closing_odds: number | null
  /** bet_odds/close − 1. > 0 = beat the close = proof of edge. */
  realized_clv: number | null
}

// ─── 2.4 model_track_record — the honesty block ─────────────────────────

export interface ModelTrackRecord {
  model: string
  segment: MarketSegment
  /** Passed a temporal holdout vs baseline. THE GATING FLAG. */
  edge_validated: boolean
  validation: string
  /** Populates once the CLV loop is live. */
  median_clv_90d: number | null
  n_settled: number | null
}

// ─── Composite ──────────────────────────────────────────────────────────

/**
 * The edge blocks as they arrive nested on a /predict(-wc) response. Pull
 * these off the raw payload with `extractEdge()` — all four are optional
 * and independently nullable.
 */
export interface EdgePayload {
  market?: MarketBlock | null
  value?: ValueBlock | null
  clv?: ClvBlock | null
  model_track_record?: ModelTrackRecord | null
}

/**
 * Normalized, render-ready edge view produced by `extractEdge()`. Booleans
 * collapse the gating rules so components don't re-derive them.
 */
export interface EdgeView {
  market: MarketBlock | null
  value: ValueBlock | null
  clv: ClvBlock | null
  trackRecord: ModelTrackRecord | null
  /** model_track_record.edge_validated === true. The license to render CTAs. */
  edgeValidated: boolean
  /** A value bet exists AND the model is edge-validated. The only "actionable" state. */
  actionable: boolean
  /** market present but no actionable value bet — render the no-value state. */
  noValue: boolean
}

// ─── Parlay (§4.7) — mirrors backend utils/edge.parlay_metrics ──────────

export interface ParlayLegInput {
  /** Per-leg model probability for the chosen outcome (0..1). */
  pModel: number
  /** Offered decimal odds for the leg. */
  price: number
  /** Per-leg EV at price (fraction). */
  ev: number
  /** The leg's model must be edge-validated to be eligible. */
  edgeValidated: boolean
}

export interface ParlayMetrics {
  /** True only if every leg is +EV and edge-validated, and 2..3 legs. */
  eligible: boolean
  /** Compounded EV of the ticket (fraction). */
  ev: number
  /** No-margin combined price (∏ 1/pModel). */
  fair_odds: number
  /** Combined offered price (∏ price). */
  offered_odds: number
  rating: ValueRating
  /** Quarter-Kelly stake fraction for the ticket. */
  kelly_quarter: number
  /** Reasons a ticket is ineligible (empty when eligible). */
  reasons: string[]
}
