/**
 * Pure Live Edge logic — zero React, zero IO, fully unit-testable. Encodes
 * the status machine, the TTL/expiry rule, and the (non-negotiable) price
 * guard from the Live Edge manual (§4–§5).
 *
 * Conventions: edge/ev are FRACTIONS (0.082 = +8.2%). Odds are decimal.
 */
import type { LiveEdgeCard, LiveEdgeStatus } from './types'

/** Has a BETTABLE card's TTL passed? (now > expires_at). */
export function isExpired(card: Pick<LiveEdgeCard, 'expires_at'>, now: Date): boolean {
  if (!card.expires_at) return false
  const exp = Date.parse(card.expires_at)
  if (Number.isNaN(exp)) return false
  return now.getTime() > exp
}

/**
 * The status to ACTUALLY render. The backend's status can go stale between
 * polls, so a BETTABLE card whose TTL has passed is treated as EXPIRED
 * client-side immediately — never leave a stale BETTABLE on screen (§5).
 * Other statuses pass through unchanged.
 */
export function effectiveStatus(card: LiveEdgeCard, now: Date): LiveEdgeStatus {
  if (card.status === 'BETTABLE' && isExpired(card, now)) return 'EXPIRED'
  return card.status
}

/** True when the card carries real in-play odds (Phase-3 dependency). */
export function hasLiveOdds(card: Pick<LiveEdgeCard, 'best_price' | 'market_implied'>): boolean {
  return card.best_price != null && typeof card.best_price.odds === 'number'
}

/**
 * THE PRICE GUARD (§5, single most important rule). A bet may be offered only
 * when the displayed best price is at or above the break-even floor. Missing
 * odds or floor → not bettable (never fabricate). `livePrice` overrides the
 * card's captured best_price when a fresher quote is available.
 */
export function priceGuardOk(
  card: Pick<LiveEdgeCard, 'best_price' | 'min_acceptable_odds'>,
  livePrice?: number | null,
): boolean {
  const floor = card.min_acceptable_odds
  if (floor == null) return false
  const price = livePrice ?? card.best_price?.odds ?? null
  if (price == null) return false
  return price >= floor
}

/**
 * Should the card render its bet CTA + value numbers? Only when the rendered
 * status is BETTABLE, odds exist, AND the price guard passes.
 */
export function canRenderBet(card: LiveEdgeCard, now: Date, livePrice?: number | null): boolean {
  return effectiveStatus(card, now) === 'BETTABLE'
    && hasLiveOdds(card)
    && priceGuardOk(card, livePrice)
}

/** Whole seconds since an ISO timestamp (for "updated Ns ago"). */
export function secondsAgo(iso: string, now: Date): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.round((now.getTime() - t) / 1000))
}

/** Seconds until expiry (0 once passed); null when no TTL. */
export function secondsUntilExpiry(card: Pick<LiveEdgeCard, 'expires_at'>, now: Date): number | null {
  if (!card.expires_at) return null
  const exp = Date.parse(card.expires_at)
  if (Number.isNaN(exp)) return null
  return Math.max(0, Math.round((exp - now.getTime()) / 1000))
}

// ─── Board ordering ──────────────────────────────────────────────────────

const STATUS_RANK: Record<LiveEdgeStatus, number> = {
  BETTABLE: 0, WATCHLIST: 1, SUSPENDED: 2, EXPIRED: 3,
}

/**
 * Sort cards for the board: actionable first (BETTABLE by descending edge),
 * then WATCHLIST by pressure, then suspended/expired. Uses effective status so
 * client-expired BETTABLEs sink. Pure — returns a new array.
 */
export function sortBoard(cards: LiveEdgeCard[], now: Date): LiveEdgeCard[] {
  return [...cards].sort((a, b) => {
    const sa = STATUS_RANK[effectiveStatus(a, now)]
    const sb = STATUS_RANK[effectiveStatus(b, now)]
    if (sa !== sb) return sa - sb
    // Within BETTABLE: higher edge first.
    if (sa === 0) return (b.edge ?? 0) - (a.edge ?? 0)
    // Within WATCHLIST: higher pressure first.
    if (sa === 1) return (b.pressure?.total ?? 0) - (a.pressure?.total ?? 0)
    return a.minute - b.minute
  })
}

// ─── Math sanity (QA §"Math sanity") ─────────────────────────────────────

/** edge ≈ model_prob − market_implied (within tol). Null-safe → null. */
export function edgeMatches(card: LiveEdgeCard, tol = 0.005): boolean | null {
  if (card.edge == null || card.market_implied == null) return null
  return Math.abs(card.edge - (card.model_prob - card.market_implied)) <= tol
}

/** ev ≈ model_prob × best_price.odds − 1 (within tol). Null-safe → null. */
export function evMatches(card: LiveEdgeCard, tol = 0.01): boolean | null {
  if (card.ev == null || card.best_price == null) return null
  return Math.abs(card.ev - (card.model_prob * card.best_price.odds - 1)) <= tol
}

/** min_acceptable_odds ≈ 1 / model_prob (within tol). Null-safe → null. */
export function minOddsMatches(card: LiveEdgeCard, tol = 0.02): boolean | null {
  if (card.min_acceptable_odds == null || card.model_prob <= 0) return null
  return Math.abs(card.min_acceptable_odds - 1 / card.model_prob) <= tol
}
