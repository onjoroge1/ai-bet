/**
 * Derive the V2 surface gate from the backend `recommended_bet` string.
 *
 * Background: backend's V3 model (with specialists + league multipliers,
 * deployed April 27 2026) computes `should_surface` / `surface_reason` /
 * `specialist_check` / `league_multiplier` internally — but those structured
 * fields are not yet exposed in the /predict JSON response. Only
 * `recommended_bet` reflects the gate, via three documented formats:
 *
 *   "home" / "home_win" / "draw" / "away" / "away_win"   → clean commit (surface)
 *   "Lean: home (small stake)" / "Lean: away ..." / etc.  → low conviction
 *   "No bet - Info only"                                  → suppressed
 *
 * This helper turns the string into structured fields. When backend ships the
 * explicit JSON fields, swap this function's body to read them directly —
 * call sites won't change.
 */

export type SurfacePick = 'home' | 'draw' | 'away' | null
export type SurfaceTone = 'commit' | 'lean' | 'skip'
export type SurfaceReason =
  | 'clean_pick'         // shouldSurface=true
  | 'low_conviction'     // "Lean:" — backend marked sub-threshold
  | 'suppressed'         // "No bet" — backend explicitly skipped
  | 'unknown_format'     // string didn't match — suppress defensively

export interface SurfaceDecision {
  shouldSurface: boolean
  surfaceReason: SurfaceReason
  pick: SurfacePick
  tone: SurfaceTone
}

const CLEAN_HOME = new Set(['home', 'home_win'])
const CLEAN_AWAY = new Set(['away', 'away_win'])
const CLEAN_DRAW = new Set(['draw'])

export function deriveSurface(recommendedBet?: string | null): SurfaceDecision {
  const r = String(recommendedBet ?? '').trim().toLowerCase()

  if (!r) {
    return { shouldSurface: false, surfaceReason: 'unknown_format', pick: null, tone: 'skip' }
  }

  if (CLEAN_HOME.has(r)) return { shouldSurface: true, surfaceReason: 'clean_pick', pick: 'home', tone: 'commit' }
  if (CLEAN_AWAY.has(r)) return { shouldSurface: true, surfaceReason: 'clean_pick', pick: 'away', tone: 'commit' }
  if (CLEAN_DRAW.has(r)) return { shouldSurface: true, surfaceReason: 'clean_pick', pick: 'draw', tone: 'commit' }

  if (r.startsWith('lean')) {
    let pick: SurfacePick = null
    if (r.includes('home')) pick = 'home'
    else if (r.includes('away')) pick = 'away'
    else if (r.includes('draw')) pick = 'draw'
    return { shouldSurface: false, surfaceReason: 'low_conviction', pick, tone: 'lean' }
  }

  if (r.startsWith('no bet')) {
    return { shouldSurface: false, surfaceReason: 'suppressed', pick: null, tone: 'skip' }
  }

  // Unknown format — suppress defensively. We'd rather hide than surface
  // garbage if backend ever changes the string format unexpectedly.
  return { shouldSurface: false, surfaceReason: 'unknown_format', pick: null, tone: 'skip' }
}

/**
 * Convenience: pull `recommended_bet` from a predictionData JSON blob and run
 * deriveSurface on it. Centralised so callers don't re-implement extraction.
 */
export function deriveSurfaceFromPrediction(predictionData: unknown): SurfaceDecision {
  const recommendedBet = (predictionData as any)?.predictions?.recommended_bet
    ?? (predictionData as any)?.recommended_bet
    ?? null
  return deriveSurface(recommendedBet)
}
