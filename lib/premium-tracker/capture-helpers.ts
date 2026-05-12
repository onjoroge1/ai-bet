/**
 * Pure helpers for the premium-tracker capture cron. Kept dependency-free
 * (no Prisma, no OpenAI) so they can be unit-tested under jsdom without
 * the cron route's full dep graph.
 *
 * Mirrors the soccer-path qualification in lib/premium-picks-engine.ts.
 * Replicated rather than imported because the engine is async + DB-driven,
 * but the QUALIFICATION rules (V3 ≥60% → premium, V3 ≥50% + strong league →
 * strong, premium score ≥60 → strong) are deterministic functions of the
 * v3Model + QuickPurchase fields that the cron has already loaded.
 */

const STRONG_SOCCER_LEAGUES = new Set([
  'Bundesliga', 'La Liga', 'Premier League', 'Eredivisie',
  'UEFA Champions League', 'UEFA Europa League', 'Serie A',
  'Süper Lig', 'Eliteserien', 'Allsvenskan', 'Jupiler Pro League', 'J1 League',
  'Africa Cup of Nations', 'Scottish Premiership', 'League 78',
  'Championship', 'League One', 'Super League Greece', 'Swiss Super League',
])

export function isStrongLeague(league: string | null | undefined): boolean {
  if (!league) return false
  return STRONG_SOCCER_LEAGUES.has(league)
}

export type Pick3 = 'home' | 'away' | 'draw'
export type Tier = 'premium' | 'strong'

export interface QualificationInput {
  v3Model: unknown
  predictionData: unknown
  premiumScore: number | null
  league: string | null | undefined
}

export interface QualificationResult {
  pick: Pick3
  tier: Tier
  confidence: number   // 0..1 (V3 confidence)
  reasons: string[]
}

/**
 * Replay the qualification logic against current MarketMatch state.
 * Returns null if the match does NOT qualify as premium or strong.
 *
 * Tested in __tests__/unit/premium-tracker-capture-helpers.test.ts.
 */
export function qualifyForTracker(input: QualificationInput): QualificationResult | null {
  const v3 = (input.v3Model || {}) as { pick?: string; confidence?: number }
  const pd = (input.predictionData || {}) as {
    predictions?: { home_win?: number; draw?: number; away_win?: number; confidence?: number }
  }
  const v3preds = pd.predictions || {}
  const v3hw = v3preds.home_win || 0
  const v3dw = v3preds.draw || 0
  const v3aw = v3preds.away_win || 0
  const v3conf = v3preds.confidence ?? v3.confidence ?? 0
  let pick: Pick3 | null = null
  if (v3hw > 0 || v3aw > 0 || v3dw > 0) {
    if (v3hw >= v3dw && v3hw >= v3aw) pick = 'home'
    else if (v3aw >= v3dw && v3aw >= v3hw) pick = 'away'
    else pick = 'draw'
  } else if (typeof v3.pick === 'string') {
    const p = v3.pick.toLowerCase()
    if (p === 'home' || p === 'away' || p === 'draw') pick = p as Pick3
  }
  if (!pick) return null

  const reasons: string[] = []
  let tier: Tier | null = null
  const score = input.premiumScore ?? 0

  if (v3conf >= 0.6) {
    tier = 'premium'
    reasons.push(`V3 confidence ${Math.round(v3conf * 100)}%`)
  }
  if (v3conf >= 0.5 && isStrongLeague(input.league)) {
    if (tier !== 'premium') tier = 'strong'
    reasons.push(`V3 ${Math.round(v3conf * 100)}% + strong league`)
  }
  if (score >= 60) {
    if (tier === null) tier = 'strong'
    reasons.push(`Premium score ${score}`)
  }

  if (!tier) return null
  return { pick, tier, confidence: v3conf, reasons }
}

/**
 * Convert a 1X2 implied-probability consensus to decimal odds for the
 * selected pick. Returns null if the probability is missing or invalid.
 *
 * NB: MarketMatch.consensusOdds stores IMPLIED PROBABILITIES (with vig,
 * summing to ~1), not decimal odds. Confirmed via probe 2026-05-11.
 */
export function consensusToDecimalOdds(
  consensus: unknown,
  pick: Pick3,
): number | null {
  const c = (consensus || {}) as { home?: number; draw?: number; away?: number }
  const p = pick === 'home' ? c.home : pick === 'away' ? c.away : c.draw
  if (typeof p !== 'number' || !(p > 0) || !(p < 1)) return null
  return +(1 / p).toFixed(3)
}

/** Map our internal Pick3 to the tracker schema's `market` enum. */
export function pickToMarket(pick: Pick3): string {
  return pick === 'home' ? '1X2_HOME' : pick === 'away' ? '1X2_AWAY' : '1X2_DRAW'
}

/** Map our internal Pick3 to a human-readable label for the audit table. */
export function pickToLabel(pick: Pick3, homeTeam: string, awayTeam: string): string {
  if (pick === 'home') return `${homeTeam} to win`
  if (pick === 'away') return `${awayTeam} to win`
  return 'Draw'
}

/**
 * Settlement helpers — extract the actual outcome from a finished
 * MarketMatch.finalResult JSON and compute the bet's P/L at flat $100.
 *
 * finalResult shapes seen in DB (2026-05-11 audit):
 *   { score: { home: number, away: number }, outcome: 'home'|'away'|'draw' }
 *   { score: { home, away }, outcome_text: 'Home Win' }
 */
export function outcomeFromFinalResult(fr: unknown): Pick3 | null {
  if (!fr || typeof fr !== 'object') return null
  const o = (fr as { outcome?: string }).outcome
  if (o) {
    const lo = o.toLowerCase()
    if (lo === 'home' || lo === 'away' || lo === 'draw') return lo as Pick3
  }
  const score = (fr as { score?: { home?: number; away?: number } }).score
  if (score && typeof score.home === 'number' && typeof score.away === 'number') {
    if (score.home > score.away) return 'home'
    if (score.away > score.home) return 'away'
    return 'draw'
  }
  return null
}

export interface SettlementOutcome {
  result: 'win' | 'loss' | 'push' | 'void'
  netDollars: number
  netUnits: number
}

/**
 * Compute P/L for a single pick at flat-$100 stake.
 *
 * Win:    +100 * (oddsAtPublish - 1)
 * Loss:   -100
 * Push:   0
 * Void:   0 (treated as no-action)
 */
export function settlePick(
  pickedSide: Pick3,
  outcome: Pick3 | null,
  oddsAtPublish: number,
  stakeDollars = 100,
): SettlementOutcome | null {
  if (!outcome) return null
  if (outcome === pickedSide) {
    const net = +(stakeDollars * (oddsAtPublish - 1)).toFixed(2)
    return { result: 'win', netDollars: net, netUnits: +(net / 100).toFixed(3) }
  }
  return { result: 'loss', netDollars: -stakeDollars, netUnits: -1 }
}
