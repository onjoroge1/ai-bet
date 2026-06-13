/**
 * Extraction of edge-payload v1 blocks from STORED prediction data.
 *
 * The backend response is persisted verbatim into QuickPurchase.predictionData,
 * but callers see it through several historical nestings:
 *   - the raw response data:        { market, value, clv, model_track_record, predictions, … }
 *   - wrapped:                      { prediction: { …same… } }
 *   - some API mappers re-wrap as:  { data: { …same… } }
 * `edgeFromPredictionData()` resolves all three. Returns an all-null EdgeView
 * when the blocks are absent (pre-pivot rows) — case (a) of the nullability
 * matrix.
 *
 * Also here: `summarizeEdge()` → the compact shape list rows/chips consume,
 * and `v3ModelEdgeFields()` → the additive keys the predict route merges into
 * its MarketMatch.v3Model write so MarketMatch-driven surfaces (soccer hubs,
 * world-cup) can render edge without loading QuickPurchase.
 */
import type { EdgePayload, EdgeView, ValueRating, Outcome } from './types'
import { extractEdge } from './helpers'

// ─── Locate the blocks inside any stored nesting ────────────────────────

function looksLikeEdgeCarrier(obj: unknown): obj is EdgePayload {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return 'market' in o || 'value' in o || 'clv' in o || 'model_track_record' in o
}

/**
 * Resolve the edge blocks from a stored predictionData payload regardless of
 * nesting, then normalize via extractEdge(). Never throws.
 */
export function edgeFromPredictionData(raw: unknown): EdgeView {
  if (!raw || typeof raw !== 'object') return extractEdge(null)
  const o = raw as Record<string, unknown>
  const data = o.data as Record<string, unknown> | undefined

  // Collect every known nesting up front as `unknown`, THEN test each. Doing
  // it this way (rather than sequential `if (guard(o)) ... if (guard(o.x))`)
  // avoids TS narrowing `o` to `never` after the first type-guard returns —
  // EdgePayload's all-optional fields make the guard's negative branch `never`
  // under the worker tsconfig's stricter settings.
  const candidates: unknown[] = [
    o,
    o.prediction,
    o.data,
    // One more level: { data: { prediction: {…} } } seen in some mappers.
    data?.prediction,
  ]
  for (const c of candidates) {
    if (looksLikeEdgeCarrier(c)) return extractEdge(c)
  }
  return extractEdge(null)
}

// ─── Compact summary for list rows / chips ───────────────────────────────

export interface EdgeSummary {
  /** model_track_record.edge_validated === true */
  validated: boolean
  /** A value bet exists AND the model is validated — render as actionable. */
  actionable: boolean
  rating: ValueRating | null
  /** Value bet's EV at best price (fraction), when a value bet exists. */
  ev: number | null
  outcome: Outcome | null
  price: number | null
  book: string | null
  minAcceptableOdds: number | null
}

/** Collapse an EdgeView into the chip-sized summary. */
export function summarizeEdge(view: EdgeView): EdgeSummary {
  const vb = view.value?.value_bet ?? null
  return {
    validated: view.edgeValidated,
    actionable: view.actionable,
    rating: view.value?.rating ?? null,
    ev: vb?.ev ?? null,
    outcome: vb?.outcome ?? null,
    price: vb?.price ?? null,
    book: vb?.book ?? null,
    minAcceptableOdds: vb?.min_acceptable_odds ?? null,
  }
}

/** Convenience: predictionData → EdgeSummary in one hop. */
export function edgeSummaryFromPredictionData(raw: unknown): EdgeSummary {
  return summarizeEdge(edgeFromPredictionData(raw))
}

// Stale-price outlier guard. The value bet is computed against the BEST
// price across ~75 books; a single stale/trap quote at an obscure book
// produces absurd EV (observed: 63.0 odds → "+1353% EV"). Such prices are
// rarely actually obtainable, so we refuse to surface them as actionable.
// Tunable — revisit once the CLV ledger shows what realized prices look like.
const SUSPECT_EV_CEILING = 2.5      // > +250% EV → stale-price artifact
const SUSPECT_PRICE_CEILING = 25    // decimal odds above this → trap quote

/** True when a summary represents a renderable value bet (the chip test). */
export function hasActionableValue(s: EdgeSummary): boolean {
  if (!s.actionable || s.ev === null || s.ev <= 0) return false
  if (s.ev > SUSPECT_EV_CEILING) return false
  if (s.price !== null && s.price > SUSPECT_PRICE_CEILING) return false
  return true
}

// ─── Additive keys for the MarketMatch.v3Model write ─────────────────────

export interface V3ModelEdgeFields {
  edge_validated: boolean
  value_rating: ValueRating | null
  value_ev: number | null
  value_outcome: Outcome | null
  value_price: number | null
  value_book: string | null
  min_acceptable_odds: number | null
}

/**
 * Build the additive edge keys the predict route merges into the v3Model
 * JSON it writes onto MarketMatch. Keeps hub surfaces (soccer/today,
 * world-cup) edge-aware with zero schema change. Returns null when the
 * payload carries no edge blocks at all, so pre-pivot writes stay untouched.
 */
export function v3ModelEdgeFields(raw: unknown): V3ModelEdgeFields | null {
  const view = edgeFromPredictionData(raw)
  if (!view.market && !view.value && !view.trackRecord) return null
  const s = summarizeEdge(view)
  return {
    edge_validated: s.validated,
    value_rating: s.rating,
    value_ev: s.ev,
    value_outcome: s.outcome,
    value_price: s.price,
    value_book: s.book,
    min_acceptable_odds: s.minAcceptableOdds,
  }
}

/**
 * Read an EdgeSummary back off a stored v3Model JSON (the inverse of
 * v3ModelEdgeFields, used by hub surfaces). Tolerates legacy v3Model rows
 * without the keys → null.
 */
export function edgeSummaryFromV3Model(v3Model: unknown): EdgeSummary | null {
  if (!v3Model || typeof v3Model !== 'object') return null
  const o = v3Model as Record<string, unknown>
  if (!('edge_validated' in o)) return null
  const validated = o.edge_validated === true
  const rating = (typeof o.value_rating === 'string' ? o.value_rating : null) as ValueRating | null
  const ev = typeof o.value_ev === 'number' ? o.value_ev : null
  const outcome = (typeof o.value_outcome === 'string' ? o.value_outcome : null) as Outcome | null
  const price = typeof o.value_price === 'number' ? o.value_price : null
  const book = typeof o.value_book === 'string' ? o.value_book : null
  const minAcceptableOdds = typeof o.min_acceptable_odds === 'number' ? o.min_acceptable_odds : null
  return {
    validated,
    actionable: validated && ev !== null && ev > 0 && outcome !== null,
    rating,
    ev,
    outcome,
    price,
    book,
    minAcceptableOdds,
  }
}
