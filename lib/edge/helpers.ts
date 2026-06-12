/**
 * Pure edge logic — zero React, zero IO, fully unit-testable. These
 * helpers encode the rules from docs/EDGE_PIVOT_FRONTEND.md so the UI
 * components never re-derive them.
 *
 * Conventions: EV and edge are FRACTIONS in the payload (0.058 = 5.8%).
 * Display helpers convert to percentage points.
 */
import type {
  EdgePayload,
  EdgeView,
  MarketBlock,
  ValueBlock,
  ValueRating,
  Outcome,
  ParlayLegInput,
  ParlayMetrics,
} from './types'

// ─── Extraction / gating ────────────────────────────────────────────────

/**
 * Normalize the four nullable blocks off a raw prediction payload into a
 * render-ready EdgeView, collapsing the gating rules. Safe on any object
 * (including {} or null) — returns an all-null view.
 */
export function extractEdge(payload: EdgePayload | null | undefined): EdgeView {
  const market = payload?.market ?? null
  const value = payload?.value ?? null
  const clv = payload?.clv ?? null
  const trackRecord = payload?.model_track_record ?? null

  const edgeValidated = trackRecord?.edge_validated === true
  const hasValueBet = !!value?.value_bet
  const actionable = edgeValidated && hasValueBet
  // No-value = we have a de-vigged market but nothing actionable to bet.
  const noValue = !!market && !actionable

  return { market, value, clv, trackRecord, edgeValidated, actionable, noValue }
}

/**
 * THE GATING RULE. A value bet / parlay leg may render as actionable (with
 * a CTA) only when the model is edge-validated. When false, callers must
 * show probabilities as information, never a recommendation.
 */
export function isActionable(view: EdgeView): boolean {
  return view.actionable
}

// ─── Rating tiers ─────────────────────────────────────────────────────────

/**
 * Rating from EV-at-best-price (fraction). Tiers per §2.2:
 *   ≤0 → no_value · <3% → marginal · <8% → value · ≥8% → strong_value
 * The backend already sends `value.rating`; use this to derive client-side
 * (e.g. for parlay tickets) or to validate the payload.
 */
export function ratingFromEv(ev: number): ValueRating {
  if (!Number.isFinite(ev) || ev <= 0) return 'no_value'
  if (ev < 0.03) return 'marginal'
  if (ev < 0.08) return 'value'
  return 'strong_value'
}

const RATING_ORDER: Record<ValueRating, number> = {
  no_value: 0,
  marginal: 1,
  value: 2,
  strong_value: 3,
}

export function ratingAtLeast(rating: ValueRating, floor: ValueRating): boolean {
  return RATING_ORDER[rating] >= RATING_ORDER[floor]
}

// ─── Price Guard (§4.3) ────────────────────────────────────────────────────

export interface PriceGuardState {
  /** Live price still clears the floor — bet is live. */
  live: boolean
  /** Live price dropped below min_acceptable_odds — edge gone, don't bet. */
  edgeGone: boolean
  minAcceptable: number
  livePrice: number | null
}

/**
 * Compare a live price against the value bet's break-even floor. When
 * livePrice is null (no live quote), we treat the bet as live at the
 * captured price (caller decides whether to show "stale").
 */
export function priceGuard(minAcceptableOdds: number, livePrice: number | null): PriceGuardState {
  if (livePrice == null) {
    return { live: true, edgeGone: false, minAcceptable: minAcceptableOdds, livePrice: null }
  }
  const edgeGone = livePrice < minAcceptableOdds
  return { live: !edgeGone, edgeGone, minAcceptable: minAcceptableOdds, livePrice }
}

// ─── Stake Suggester (§4.4) ────────────────────────────────────────────────

/** Display cap — never suggest staking more than this fraction, even if Kelly says more. */
export const STAKE_DISPLAY_CAP = 0.05

/**
 * Quarter-Kelly stake fraction for display, capped at STAKE_DISPLAY_CAP.
 * Quarter is always the default surface; full Kelly is an advanced opt-in.
 */
export function displayStakeFraction(kellyQuarter: number): number {
  if (!Number.isFinite(kellyQuarter) || kellyQuarter <= 0) return 0
  return Math.min(kellyQuarter, STAKE_DISPLAY_CAP)
}

/** Convert a stake fraction + bankroll into a monetary stake (rounded to cents). */
export function stakeFromBankroll(fraction: number, bankroll: number): number {
  if (!Number.isFinite(fraction) || !Number.isFinite(bankroll) || fraction <= 0 || bankroll <= 0) return 0
  return Math.round(fraction * bankroll * 100) / 100
}

// ─── Math primitives ───────────────────────────────────────────────────────

/** Expected value per 1u: p × odds − 1. */
export function ev(pModel: number, odds: number): number {
  return pModel * odds - 1
}

/** Break-even price floor for a bet: 1 / p_model. */
export function minAcceptableOdds(pModel: number): number {
  return pModel > 0 ? 1 / pModel : Infinity
}

/** Fair (no-margin) odds: 1 / fair prob. */
export function fairOdds(pFair: number): number {
  return pFair > 0 ? 1 / pFair : Infinity
}

/** Vig as a fraction from overround (1.053 → 0.053). */
export function vigFromOverround(overround: number): number {
  return Math.max(0, overround - 1)
}

// ─── Display formatters ────────────────────────────────────────────────────

/** "+5.8%" / "−22.9%" from a fraction. */
export function formatEvPct(fraction: number, digits = 1): string {
  const pct = fraction * 100
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  return `${sign}${Math.abs(pct).toFixed(digits)}%`
}

/** Edge points "+11.1" / "−11.3" from a probability-point fraction. */
export function formatEdgePoints(fraction: number, digits = 1): string {
  const pts = fraction * 100
  const sign = pts > 0 ? '+' : pts < 0 ? '−' : ''
  return `${sign}${Math.abs(pts).toFixed(digits)}`
}

/** "33.7%" from a 0..1 probability. */
export function formatProbPct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`
}

/** "3.7%" stake-fraction label. */
export function formatStakePct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

const RATING_LABELS: Record<ValueRating, string> = {
  no_value: 'No value',
  marginal: 'Marginal',
  value: 'Value',
  strong_value: 'Strong value',
}
export function ratingLabel(rating: ValueRating): string {
  return RATING_LABELS[rating]
}

const OUTCOME_LABELS: Record<Outcome, string> = { home: 'Home', draw: 'Draw', away: 'Away' }
export function outcomeLabel(o: Outcome): string {
  return OUTCOME_LABELS[o]
}

// ─── Edge Meter rows (§4.2) ─────────────────────────────────────────────────

export interface EdgeMeterRow {
  outcome: Outcome
  label: string
  marketProb: number      // de-vigged fair prob
  modelProb: number       // model probability
  edge: number            // modelProb − marketProb (fraction)
  isValueOutcome: boolean // the value bet's outcome, if any
}

/**
 * Build the three H/D/A rows for the Edge Meter from the market block and
 * the model's probabilities. `modelProbs` come from the legacy predictions
 * block (home_win/draw/away_win) so the meter works even pre-pivot.
 */
export function edgeMeterRows(
  market: MarketBlock,
  modelProbs: { home: number; draw: number; away: number },
  value: ValueBlock | null,
): EdgeMeterRow[] {
  const valueOutcome = value?.value_bet?.outcome ?? null
  const outcomes: Outcome[] = ['home', 'draw', 'away']
  return outcomes.map(o => {
    const marketProb = market.implied[o]
    const modelProb = modelProbs[o]
    return {
      outcome: o,
      label: OUTCOME_LABELS[o],
      marketProb,
      modelProb,
      edge: modelProb - marketProb,
      isValueOutcome: o === valueOutcome,
    }
  })
}

// ─── Parlay metrics (§4.7) — mirrors backend utils/edge.parlay_metrics ──────

const PARLAY_MIN_LEGS = 2
const PARLAY_MAX_LEGS = 3

/**
 * Compound a set of legs into a ticket. Eligibility rules:
 *   - 2..3 legs
 *   - every leg edge-validated
 *   - every leg strictly +EV (an EV≤0 "anchor favorite" poisons the ticket)
 * When a backend parlay endpoint serves utils/edge.parlay_metrics, prefer
 * its eligible/ev/fair_odds/rating verbatim; this is the client-side mirror
 * for the builder preview.
 */
export function parlayMetrics(legs: ParlayLegInput[]): ParlayMetrics {
  const reasons: string[] = []

  if (legs.length < PARLAY_MIN_LEGS) reasons.push(`Need at least ${PARLAY_MIN_LEGS} legs`)
  if (legs.length > PARLAY_MAX_LEGS) reasons.push(`Max ${PARLAY_MAX_LEGS} legs — variance compounds`)
  if (legs.some(l => !l.edgeValidated)) reasons.push('A leg comes from an unvalidated model')
  if (legs.some(l => l.ev <= 0)) reasons.push('A leg has EV ≤ 0 — it removes the ticket’s edge')

  // Combined offered price = ∏ price; combined model prob = ∏ pModel.
  const offered_odds = legs.reduce((acc, l) => acc * l.price, 1)
  const pCombined = legs.reduce((acc, l) => acc * l.pModel, 1)
  const fair_odds = pCombined > 0 ? 1 / pCombined : Infinity
  // Ticket EV at offered odds: pCombined × offered − 1.
  const ticketEv = pCombined * offered_odds - 1

  // Quarter-Kelly on the combined market: f* = (b·p − q)/b, b = offered−1.
  const b = offered_odds - 1
  const q = 1 - pCombined
  const kellyFull = b > 0 ? Math.max(0, (b * pCombined - q) / b) : 0
  const kelly_quarter = kellyFull / 4

  const eligible = reasons.length === 0
  return {
    eligible,
    ev: ticketEv,
    fair_odds,
    offered_odds,
    rating: ratingFromEv(ticketEv),
    kelly_quarter,
    reasons,
  }
}
