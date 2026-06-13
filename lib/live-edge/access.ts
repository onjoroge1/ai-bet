/**
 * Live Edge freemium gate — the SINGLE place that decides whether a user
 * sees the actionable detail (live price, edge %, best book, price-guard
 * floor, the "why").
 *
 * Free vs premium split:
 *   - FREE: the board + match intelligence (minute/score/pressure/status) and
 *     a "live value detected" teaser on BETTABLE cards — the hook.
 *   - PREMIUM: the actionable numbers + reasoning behind those teasers.
 *
 * Gate is set to "any paid tier" (not VIP-only) deliberately: Live Edge is a
 * top-of-funnel hook and conversions are scarce, so the cheapest paid tier
 * should unlock it. Change the one predicate below to retune (e.g. require
 * `features.clv_tracker` for VIP-only).
 */

export interface PremiumCheckResponse {
  tier?: string
  features?: Record<string, boolean>
}

/** True when the user may see Live Edge actionable detail. */
export function liveEdgeDetailUnlocked(data: PremiumCheckResponse | null | undefined): boolean {
  if (!data) return false
  const tier = data.tier ?? 'free'
  if (tier === 'admin') return true
  // Any paid tier unlocks. (Tighten to `data.features?.clv_tracker === true`
  // for VIP-only.)
  return tier !== 'free'
}
