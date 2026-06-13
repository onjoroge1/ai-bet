/**
 * Live Edge contract types — the in-game betting board.
 *
 * Source of truth: "Frontend Manual — Snapbet Live Edge" (2026-06-13).
 * Mirrors the backend `GET /live-edge/board` and `/live-edge/match/{id}`
 * responses field-for-field. The VALUE semantics (edge/ev/min_acceptable_odds/
 * model_track_record) are identical to the pre-match edge pivot — reuse those
 * components; only transport (polling) + TTL/expiry are new.
 *
 * CRITICAL nullability: market_implied, edge, ev, best_price,
 * min_acceptable_odds may all be null when in-play odds aren't collected yet
 * (Phase 3). model_prob and pressure are always present. A card with null
 * odds must render as WATCHLIST and never fabricate an edge.
 */

/** Drives the entire card UI. Do not invent thresholds — render from this. */
export type LiveEdgeStatus = 'WATCHLIST' | 'BETTABLE' | 'EXPIRED' | 'SUSPENDED'

export type LiveConfidence = 'low' | 'medium' | 'medium_high' | 'high'

export interface LiveBestPrice {
  odds: number
  book: string
}

export interface LivePressure {
  home: number
  away: number
  total: number
}

export interface LiveTrackRecord {
  model: string
  /** Same gating rule as pre-match: false → "experimental", no "beats market". */
  edge_validated: boolean
  validation?: string | null
  median_clv_90d?: number | null
  n_settled?: number | null
}

export interface LiveSide {
  name: string
  score: number
}

/** One board card — per live match (or per (match, market) once >1 market). */
export interface LiveEdgeCard {
  match_id: number
  minute: number
  period: string
  home: LiveSide
  away: LiveSide
  status: LiveEdgeStatus
  market: string
  pick: string
  /** Snapbet calibrated probability — ALWAYS present. */
  model_prob: number
  /** De-vigged live price — NULL when in-play odds unavailable. */
  market_implied: number | null
  /** model_prob − market_implied — NULL when odds unavailable. */
  edge: number | null
  /** EV at best price — NULL when odds unavailable. */
  ev: number | null
  /** Best available live odds — NULL when odds unavailable. */
  best_price: LiveBestPrice | null
  /** Break-even floor (1/model_prob) — NULL when odds unavailable. */
  min_acceptable_odds: number | null
  confidence: LiveConfidence
  /** Live pressure index — ALWAYS present. */
  pressure: LivePressure
  /** ISO timestamp — when the BETTABLE edge expires (TTL). */
  expires_at: string | null
  model_track_record: LiveTrackRecord
}

export interface LiveEdgeBoard {
  generated_at: string
  active_matches: number
  matches: LiveEdgeCard[]
}

// ─── Detail (GET /live-edge/match/{id}) ──────────────────────────────────

export interface LiveSnapshot {
  minute: number
  home_score?: number
  away_score?: number
  [key: string]: unknown
}

export interface LiveOddsMovement {
  last_5min: number[]
  drifting: boolean
}

export interface LiveAlertHistoryEntry {
  minute: number
  status: LiveEdgeStatus
}

/** Board card + detail extras. */
export interface LiveEdgeMatchDetail extends LiveEdgeCard {
  snapshots: LiveSnapshot[]
  /** The trust-builder — render as bullets. */
  why: string[]
  odds_movement: LiveOddsMovement | null
  alert_history: LiveAlertHistoryEntry[]
}
