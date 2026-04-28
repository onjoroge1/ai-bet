/**
 * V2 surface gate — read explicit backend fields when present, otherwise
 * derive from the `recommended_bet` string.
 *
 * Backend (commit faceefd, branch claude/frosty-saha) ships explicit fields:
 *   predictions.should_surface       (boolean)
 *   predictions.surface_reason       ("ok" | "coin_flip" | "away_low_conf" |
 *                                     "draw_low_conf" | "specialist_disagreement" |
 *                                     "low_conviction")
 *   predictions.recommendation_tone  ("commit" | "lean" | "skip")
 *   predictions.recommended_bet      canonical: "home" | "draw" | "away" | null
 *   predictions.league_multiplier    (number)
 *   predictions.specialist_check     (object | null)
 *
 * Until that branch is merged + deployed to Replit, the response still uses
 * the old format with `recommended_bet` carrying the gate signal as a string:
 *   "home"/"home_win"/"draw"/"away"/"away_win"  → clean commit
 *   "Lean: home (small stake)" / etc.            → low conviction
 *   "No bet - Info only"                         → suppressed
 *
 * deriveSurface() handles both schemas transparently. Call sites don't need
 * to know which is in effect.
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

/**
 * Map backend's surface_reason values to our normalized SurfaceReason union.
 * Backend uses snake_case strings; we map unknowns to 'unknown_format' for
 * defensive forward-compatibility.
 */
const BACKEND_REASON_MAP: Record<string, SurfaceReason> = {
  ok: 'clean_pick',
  clean_pick: 'clean_pick',
  coin_flip: 'low_conviction',
  away_low_conf: 'low_conviction',
  draw_low_conf: 'low_conviction',
  specialist_disagreement: 'low_conviction',
  low_conviction: 'low_conviction',
  suppressed: 'suppressed',
}

/**
 * Derive surface decision from a `recommended_bet` string. Used as a fallback
 * when backend hasn't yet exposed the explicit fields.
 */
function deriveFromString(recommendedBet?: string | null): SurfaceDecision {
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

  // Unknown format — suppress defensively
  return { shouldSurface: false, surfaceReason: 'unknown_format', pick: null, tone: 'skip' }
}

/**
 * Main entry: accepts either the full predictions object (preferred) or a
 * raw `recommended_bet` string. When the explicit fields are present in the
 * predictions object, use them directly. Otherwise fall back to string parsing.
 *
 * @example
 *   deriveSurface(predictionData.predictions)  // preferred — gets explicit fields if backend exposes them
 *   deriveSurface(predictionData.predictions.recommended_bet)  // legacy — string only
 */
export function deriveSurface(input: any): SurfaceDecision {
  // Plain string → string-parse path
  if (typeof input === 'string' || input == null) {
    return deriveFromString(input as string | null | undefined)
  }

  // Object → check for explicit backend fields first
  const obj = input as Record<string, unknown>
  const hasExplicit = typeof obj.should_surface === 'boolean'

  if (hasExplicit) {
    // Backend exposed the explicit fields — use them directly.
    const shouldSurface = Boolean(obj.should_surface)
    const backendReason = String(obj.surface_reason ?? '').toLowerCase()
    const surfaceReason = BACKEND_REASON_MAP[backendReason] ?? 'unknown_format'

    // Canonicalize pick
    const rawPick = String(obj.recommended_bet ?? '').toLowerCase()
    let pick: SurfacePick = null
    if (rawPick === 'home') pick = 'home'
    else if (rawPick === 'draw') pick = 'draw'
    else if (rawPick === 'away') pick = 'away'

    // Tone — explicit if backend provides it, else infer from shouldSurface
    const rawTone = String(obj.recommendation_tone ?? '').toLowerCase()
    let tone: SurfaceTone = 'skip'
    if (rawTone === 'commit' || rawTone === 'lean' || rawTone === 'skip') {
      tone = rawTone
    } else {
      tone = shouldSurface ? 'commit' : 'skip'
    }

    return { shouldSurface, surfaceReason, pick, tone }
  }

  // Fallback: explicit fields not yet deployed. Parse the legacy string.
  return deriveFromString(typeof obj.recommended_bet === 'string' ? obj.recommended_bet : null)
}

/**
 * Convenience: pull from a full predictionData JSON blob (the shape stored
 * in QuickPurchase.predictionData). Looks at predictionData.predictions first,
 * falls back to top-level recommended_bet for older payloads.
 */
export function deriveSurfaceFromPrediction(predictionData: unknown): SurfaceDecision {
  const pd = predictionData as any
  if (pd?.predictions && typeof pd.predictions === 'object') {
    return deriveSurface(pd.predictions)
  }
  return deriveSurface(pd?.recommended_bet ?? null)
}

/**
 * Diagnostic helper for admin tooling — exposes the raw backend fields
 * (specialist_check, league_multiplier, calibrated_confidence) so admin
 * surfaces can show extra context without each caller re-extracting.
 */
export interface SurfaceDiagnostics extends SurfaceDecision {
  leagueMultiplier: number | null
  calibratedConfidence: number | null
  specialistCheck: {
    leagueId?: number
    specialistAvailable?: boolean
    specialistUsed?: boolean
    mainPick?: string
    specialistPick?: string
    agreement?: boolean
    disagreement?: boolean
    note?: string
  } | null
  fromExplicitFields: boolean // true once backend deploys; useful for logging migration progress
}

export function deriveSurfaceWithDiagnostics(predictionData: unknown): SurfaceDiagnostics {
  const pd = predictionData as any
  const preds = pd?.predictions ?? pd ?? {}
  const decision = deriveSurfaceFromPrediction(predictionData)
  const sc = preds.specialist_check
  return {
    ...decision,
    leagueMultiplier: typeof preds.league_multiplier === 'number' ? preds.league_multiplier : null,
    calibratedConfidence: typeof preds.calibrated_confidence === 'number' ? preds.calibrated_confidence : null,
    specialistCheck: sc && typeof sc === 'object' ? {
      leagueId: sc.league_id,
      specialistAvailable: sc.specialist_available,
      specialistUsed: sc.specialist_used,
      mainPick: sc.main_pick,
      specialistPick: sc.specialist_pick,
      agreement: sc.agreement,
      disagreement: sc.disagreement,
      note: sc.note,
    } : null,
    fromExplicitFields: typeof preds.should_surface === 'boolean',
  }
}
