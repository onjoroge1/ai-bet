/**
 * SnapBet Picks Engine — curates the best picks across all sports
 * using data-driven criteria from model accuracy reports.
 *
 * Selection criteria (based on verified accuracy data):
 *
 * Soccer:
 *   - V3 confidence ≥ 50% + strong league → ~60-67% accuracy
 *   - V1+V3 agree + home pick + low draw rate → ~55-60%
 *   - Premium star score ≥ 60 → premium tier
 *   - **Backend V2 surface gate** (deriveSurface from recommended_bet):
 *     hard requirement on top of the above. Backend's specialist + league
 *     multiplier cascade emits "Lean: …" / "No bet …" for matches that
 *     should NOT be surfaced. Backtest: V0→V2 lifts accuracy ~8.4pp.
 *
 * NBA:
 *   - Model confidence ≥ 80% → 79% accuracy
 *
 * NCAAB:
 *   - Model confidence ≥ 75% → 73% accuracy
 *
 * NHL:
 *   - Model confidence ≥ 85% (conservative — weakest sport)
 *
 * NFL:
 *   - PROVISIONAL gates (no NFL track record yet) — see MULTISPORT_CONF_GATES
 *
 * All US sports: an edge-validated value bet in predictionData (pipeline's
 * honesty gate) takes precedence over the confidence buckets (Criterion 0),
 * and a row with no model block (cold start) is never a pick.
 */

import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { deriveSurfaceFromPrediction } from '@/lib/predictions/should-surface'
import { edgeSummaryFromV3Model, edgeSummaryFromPredictionData, hasActionableValue } from '@/lib/edge/extract'
import { ACTIVE_MULTISPORT_KEYS, MULTISPORT, isMultisportKey } from '@/lib/multisport/sports'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SnapBetPick {
  id: string
  sport: 'soccer' | 'nba' | 'nhl' | 'ncaab' | 'nfl'
  sportEmoji: string
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  pick: string          // "Home", "Away", "Draw"
  pickTeam: string      // Actual team name
  confidence: number    // 0-100
  // 'premium' — highest accuracy (~71% on V3 conf ≥60%, but break-even EV)
  // 'strong'  — moderate accuracy with V1/V3 conviction signals
  // 'value'   — contrarian or draw-detection picks with empirical positive EV
  //             (+0.30 to +0.40/unit) despite lower accuracy. Different KIND
  //             of pick than premium — surfaced for users seeking market alpha
  //             rather than high hit-rate.
  // 'standard'— baseline V2-gated pick, near coin-flip
  tier: 'premium' | 'strong' | 'value' | 'standard'
  starRating: number    // 1-5
  reasons: string[]     // Why this pick qualifies
  // Premium-only fields
  edge?: number         // Model edge vs market
  odds?: { home?: number; draw?: number; away?: number }
  // Per-pick EV inputs — populated when the engine can compute them.
  // pickProb: the model's probability for the picked side (0-1).
  // pickOdds: the consensus decimal odds for the picked side (>1).
  // Together they let the UI compute live EV: (pickProb * pickOdds) - 1.
  pickProb?: number
  pickOdds?: number
  spread?: number
  totalLine?: number
  slug?: string         // For linking to detail page
}

// Strong leagues where models perform best.
// Last reviewed: 2026-05-15 — re-validated via full-sport-performance-audit
// using current 90d data. Council session (2026-05-15) flagged Serie A as
// anti-signal — removed. Primeira Liga was already in WEAK_SOCCER_LEAGUES.
// To regenerate, run scripts/full-sport-performance-audit.ts.
const STRONG_SOCCER_LEAGUES = [
  // ── V3-DOMINANT (V3 > V1, n ≥ 20, large agreement lift) ──
  'Bundesliga',               // V3 52.5% (n=40) — strictly above 50%
  'La Liga',                  // V3 50.0% (n=58) — at threshold

  // ── Confirmed strong (n ≥ 20, V1 or V3 ≥ 50%) ──
  'Premier League',           // V3 50.0% (n=56)
  'Eredivisie',               // V3 50.0% (n=42)
  'UEFA Champions League',    // legacy — small fresh-era sample
  'UEFA Europa League',       // legacy
  // 'Serie A' — REMOVED 2026-05-15. V3 40.0% on n=70. Anti-signal.

  // ── Exploratory (n < 20 fresh-era, promising but small sample) ──
  'Süper Lig',                // legacy, exploratory
  'Eliteserien',              // V3 67.9% (n=28) — strongest league
  'Allsvenskan',              // V3 46.4% (n=28) — borderline, keep for V1+V3 agree path
  'Jupiler Pro League',       // legacy, exploratory
  'J1 League',                // V3 54.5% (n=33) — strictly above 50%
  'Brasileirão Série A',      // V3 54.5% (n=22) — strictly above 50%  [add 2026-05-15]

  // ── Legacy entries (kept from prior curation, no current n ≥ 20 data) ──
  'Africa Cup of Nations',
  'Scottish Premiership',
  'League 78',
  'Championship',
  'League One',
  'Super League Greece',
  'Swiss Super League',
]

/**
 * Per-league premium gates — based on empirical V3 baseline accuracy from
 * full-sport-performance-audit.ts (2026-05-15 run).
 *
 * Three buckets:
 *   - baseline > 0.51  → relaxed gate (V3 ≥0.55) — leagues where V3 has real edge
 *   - baseline 0.48-0.51 → strict gate (V3 ≥0.60) — borderline, keep the old gate
 *   - baseline < 0.48 → DROP entirely — V3 is anti-signal in this league
 *
 * Unknown leagues default to the strict 0.60 gate. Re-tune by re-running
 * the audit script when sample sizes grow.
 */
const LEAGUE_V3_BASELINE: Record<string, number> = {
  'Eliteserien':         0.679,
  'Brasileirão Série A': 0.545,
  'J1 League':           0.545,
  'Bundesliga':          0.525,
  'La Liga':             0.500,
  'Premier League':      0.500,
  'Eredivisie':          0.500,
  'Ligue 1':             0.489,
  'Major League Soccer': 0.471,
  'Allsvenskan':         0.464,
  'Serie A':             0.400,
  'Primeira Liga':       0.390,
}

const RELAXED_GATE_THRESHOLD = 0.51  // baseline strictly above this → relaxed gate
const DROP_THRESHOLD = 0.48          // baseline below this → drop entirely
const RELAXED_PREMIUM_GATE = 0.55
const STRICT_PREMIUM_GATE = 0.60

export function getLeaguePremiumGate(league: string | null | undefined): { gate: number; dropped: boolean; rationale: string } {
  if (!league) return { gate: STRICT_PREMIUM_GATE, dropped: false, rationale: 'unknown league — default strict gate' }
  const baseline = LEAGUE_V3_BASELINE[league]
  if (baseline === undefined) {
    return { gate: STRICT_PREMIUM_GATE, dropped: false, rationale: 'league not in baseline table — default strict gate' }
  }
  if (baseline < DROP_THRESHOLD) {
    return { gate: 1.1, dropped: true, rationale: `${league} V3 baseline ${(baseline * 100).toFixed(1)}% — anti-signal, dropped` }
  }
  if (baseline > RELAXED_GATE_THRESHOLD) {
    return { gate: RELAXED_PREMIUM_GATE, dropped: false, rationale: `${league} V3 baseline ${(baseline * 100).toFixed(1)}% > 51% — relaxed gate ≥55%` }
  }
  return { gate: STRICT_PREMIUM_GATE, dropped: false, rationale: `${league} V3 baseline ${(baseline * 100).toFixed(1)}% — strict gate ≥60%` }
}

// Weak leagues to deprioritize.
// Last reviewed: 2026-05-11 — see scripts/premium-tier-analysis.ts for rationale.
const WEAK_SOCCER_LEAGUES = [
  // ── Confirmed weak (n ≥ 20, V1 < 50% AND V3 < 40%) ──
  'Primeira Liga', // V1: 47%, V3: 34% (n=86) — high-volume but consistently weak  [empirical add 2026-05-11]

  // ── Exploratory weak (small sample, clearly poor accuracy) ──
  'K League 1',    // V1: 17%, V3: 27% (n=11 — clearly weak even at small n)  [empirical add 2026-05-11]

  // ── Legacy entries (kept from prior curation) ──
  'Ligue 1',       // V3: 20% (legacy) — note: current 90d V1: 45%, V3: 45% — re-evaluate after more data
  'Ligue 2',       // V1: 0%
  'A-League',      // V3: 30%
]

// Soccer leagues where V1+V3 *agreement* is empirically an anti-signal
// (agreement lift < 0 pp in last 90d). Picks engine should NOT promote
// agreement-on-home in these leagues to "strong" tier — accuracy drops.
// Last reviewed: 2026-05-11
const NEGATIVE_CONSENSUS_LEAGUES = [
  'Serie A',       // agree: 33%, disagree: 38% — Δ -4 pp (n=18 / 16)
]

// ─── Main Selection Function ────────────────────────────────────────────────

export async function getSnapBetPicks(limit: number = 10): Promise<SnapBetPick[]> {
  const allPicks: SnapBetPick[] = []

  // Fetch all sports in parallel: soccer + every active US sport in the registry
  const [soccerPicks, ...multisportPicks] = await Promise.all([
    getSoccerPicks(),
    ...ACTIVE_MULTISPORT_KEYS.map(key => getMultisportPicks(key)),
  ])

  allPicks.push(...soccerPicks, ...multisportPicks.flat())

  // Sort by tier (premium first), then confidence, then kickoff
  allPicks.sort((a, b) => {
    // Value picks sit between strong and standard — they're not high-accuracy
    // so they shouldn't out-rank a 70%+ premium, but their EV warrants
    // surfacing above generic standard picks.
    const tierOrder = { premium: 0, strong: 1, value: 2, standard: 3 }
    if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier]
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  })

  return allPicks.slice(0, limit)
}

// ─── Soccer Picks ───────────────────────────────────────────────────────────

async function getSoccerPicks(): Promise<SnapBetPick[]> {
  const picks: SnapBetPick[] = []

  try {
    const matches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: { gte: new Date() },
        // v1Model OR v3Model — World Cup / international fixtures arrive with
        // only a v3Model (wc_elo) and would otherwise never enter the pool.
        OR: [
          { v1Model: { not: Prisma.JsonNull } },
          { v3Model: { not: Prisma.JsonNull } },
        ],
      },
      orderBy: { kickoffDate: 'asc' },
      take: 100,
    })

    // Batch fetch QuickPurchases for all matches
    const matchIds = matches.map(m => m.matchId)
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: { in: matchIds },
        predictionData: { not: Prisma.JsonNull },
        isPredictionActive: true,
      },
    })
    const qpByMatchId = new Map(quickPurchases.map(qp => [qp.matchId, qp]))

    for (const m of matches) {
      const v1 = m.v1Model as any
      const v3m = m.v3Model as any

      const v1pick = (v1?.pick || '').toLowerCase()
      const v1conf = v1?.confidence || 0
      const league = m.league || ''
      const reasons: string[] = []

      // Get V3 data from QuickPurchase, falling back to MarketMatch.v3Model
      // (v3-only fixtures — e.g. World Cup — may not have a QuickPurchase yet)
      const qp = qpByMatchId.get(m.matchId)
      const pd = qp?.predictionData as any

      // Edge-payload v1 summary. Two sources: the additive keys the (new)
      // predict route merges into v3Model, or the raw blocks inside the
      // stored predictionData (full backend response — works for rows
      // written before the v3Model merge shipped). edge_validated models
      // with a +EV value bet are the only picks mathematically connected
      // to bankroll (docs/EDGE_PIVOT_FRONTEND.md).
      let edgeSummary = edgeSummaryFromV3Model(m.v3Model)
      if (!edgeSummary || !hasActionableValue(edgeSummary)) {
        const fromPd = pd ? edgeSummaryFromPredictionData(pd) : null
        if (fromPd && (fromPd.rating !== null || fromPd.validated)) edgeSummary = fromPd
      }
      const edgeActionable = edgeSummary !== null && hasActionableValue(edgeSummary)

      if (!v1pick && !v3m?.pick && !edgeActionable) continue
      const v3preds = pd?.predictions || {}
      const v3hw = v3preds.home_win || v3m?.probs?.home || 0
      const v3dw = v3preds.draw || v3m?.probs?.draw || 0
      const v3aw = v3preds.away_win || v3m?.probs?.away || 0
      const v3conf = v3preds.confidence || v3m?.confidence || 0
      let v3pick = ''
      if (v3hw > 0 || v3aw > 0) {
        if (v3hw >= v3dw && v3hw >= v3aw) v3pick = 'home'
        else if (v3aw >= v3dw && v3aw >= v3hw) v3pick = 'away'
        else v3pick = 'draw'
      }
      if (!v3pick && typeof v3m?.pick === 'string') v3pick = v3m.pick.toLowerCase()

      // Premium score from QuickPurchase
      const premiumScore = qp?.premiumScore ? Number(qp.premiumScore) : 0
      const premiumTier = qp?.premiumTier || ''

      // ── Apply selection criteria ──

      let qualifies = false
      let tier: 'premium' | 'strong' | 'value' | 'standard' = 'standard'

      // Criterion 0 (edge pivot): backend-validated value bet. The model
      // passed a temporal holdout (model_track_record.edge_validated) AND
      // prices this outcome above the market price. This is the only
      // criterion mathematically connected to bankroll, so it supersedes
      // the confidence-era gates and league drops below.
      if (edgeActionable && edgeSummary) {
        qualifies = true
        tier = edgeSummary.rating === 'strong_value' ? 'premium' : 'strong'
        const evPct = ((edgeSummary.ev ?? 0) * 100).toFixed(1)
        reasons.push(
          `Edge-validated value bet: +${evPct}% EV` +
          (edgeSummary.price && edgeSummary.book ? ` at ${edgeSummary.price} (${edgeSummary.book})` : '') +
          (edgeSummary.minAcceptableOdds ? ` · value at ≥${edgeSummary.minAcceptableOdds.toFixed(2)}` : '')
        )
      }

      // League-specific premium gate. Per the 2026-05-15 audit, the V3
      // baseline accuracy varies hugely by league (40% Serie A → 68%
      // Eliteserien). We drop anti-signal leagues entirely AND relax the
      // confidence gate where V3 has demonstrated edge. The drop applies to
      // V3-confidence signals only — a Criterion-0 edge pick is a different,
      // holdout-validated signal and passes through.
      const leagueGate = getLeaguePremiumGate(league)
      if (leagueGate.dropped && !edgeActionable) {
        continue   // skip this match entirely — V3 confidence has no edge here
      }

      // Criterion 1: V3 confidence ≥ league-specific gate → premium
      if (!leagueGate.dropped && v3conf >= leagueGate.gate) {
        qualifies = true
        tier = 'premium'
        reasons.push(`V3 ${Math.round(v3conf * 100)}% ≥ ${Math.round(leagueGate.gate * 100)}% (${leagueGate.rationale})`)
      }

      // Criterion 2: V3 confidence ≥ 50% + strong league
      if (!leagueGate.dropped && v3conf >= 0.5 && isStrongLeague(league)) {
        qualifies = true
        if (tier !== 'premium') tier = 'strong'
        reasons.push(`V3 ${Math.round(v3conf * 100)}% + strong league (${league})`)
      }

      // Criterion 3: V1+V3 agree + home pick + low-draw league + not a
      // negative-consensus league (e.g. Serie A — empirically agreement is
      // anti-signal there, see NEGATIVE_CONSENSUS_LEAGUES).
      if (
        v1pick === v3pick &&
        v1pick === 'home' &&
        !isHighDrawLeague(league) &&
        !isNegativeConsensusLeague(league)
      ) {
        qualifies = true
        if (tier === 'standard') tier = 'strong'
        reasons.push('V1+V3 agree on home pick in low-draw league')
      }

      // Criterion 4: Premium star score ≥ 60
      if (premiumScore >= 60) {
        qualifies = true
        if (tier === 'standard') tier = 'strong'
        reasons.push(`Premium score ${premiumScore} (${premiumTier})`)
      }

      // Criterion 5: V1 confidence ≥ 70% in strong league
      if (v1conf >= 0.7 && isStrongLeague(league)) {
        qualifies = true
        if (tier === 'standard') tier = 'strong'
        reasons.push(`V1 ${Math.round(v1conf * 100)}% in ${league}`)
      }

      // ── VALUE TIER — empirically positive-EV patterns ──
      // These are surfaced *only* if no higher tier already applies.
      // Source: scripts/premium-tier-analysis.ts Matrix F (last 90d).

      // Criterion 6: V1+V3 disagreement, V3 surfaced (V3 contrarian).
      // Matrix F: 38% accuracy at avg 3.45 odds → +0.31 EV/unit (n=95).
      // The market and V1 agree; V3 dissents. When V3 dissent is right,
      // payoff is large because odds are loose.
      if (
        v1pick && v3pick &&
        v1pick !== v3pick &&
        v3conf >= 0.40 &&
        !isWeakLeague(league)
      ) {
        qualifies = true
        if (tier === 'standard') tier = 'value'
        reasons.push(`V3 contrarian (V1: ${v1pick}, V3 ${Math.round(v3conf * 100)}%: ${v3pick})`)
      }

      // Criterion 7: V3 high-confidence draw call.
      // Matrix F: 40% accuracy at avg 3.48 odds → +0.39 EV/unit (n=20).
      // Draws are systematically under-called by 1X2 markets; V3 is the
      // only model that ever picks draws (V1 architecturally cannot).
      if (
        v3pick === 'draw' &&
        v3conf >= 0.40 &&
        !isWeakLeague(league)
      ) {
        qualifies = true
        if (tier === 'standard') tier = 'value'
        reasons.push(`V3 high-conf draw call (${Math.round(v3conf * 100)}%) — market under-prices draws`)
      }

      // Skip weak leagues unless very high confidence. Edge-validated value
      // bets are exempt — the holdout validation is the stronger signal.
      if (isWeakLeague(league) && v3conf < 0.6 && v1conf < 0.75 && !edgeActionable) {
        qualifies = false
      }

      // Hard gate from backend's V2 surface logic.
      // Even if our tier criteria above accept this pick, if the model has
      // tagged it "Lean: ..." or "No bet" we don't show it. Single source of
      // truth — when backend exposes explicit `should_surface`, swap the
      // helper's body to read it directly; this call site stays the same.
      // Edge-validated value bets bypass: the edge blocks ARE the backend's
      // surface decision for those (value_bet non-null = bet).
      const surface = deriveSurfaceFromPrediction(pd)
      if (!surface.shouldSurface && !edgeActionable) {
        qualifies = false
      }

      if (!qualifies) continue

      // The actionable side: for edge picks it's the VALUE BET outcome (which
      // can differ from the model's argmax — a priced-wrong underdog beats a
      // well-priced favorite); otherwise the model pick as before.
      const pickSide = (edgeActionable && edgeSummary?.outcome) ? edgeSummary.outcome : (v3pick || v1pick)
      const pickTeam = pickSide === 'home' ? m.homeTeam : pickSide === 'away' ? m.awayTeam : 'Draw'
      // Display V3's calibrated confidence (the V2 single source) so the number
      // shown on this card matches what users see on the match detail page.
      // Previously used Math.max(v3conf, v1conf) which led to picks-card showing
      // 89% (V1) but match-detail showing 39% (V3) on the same match.
      // V1 is still factored into qualification criteria above, but the
      // headline % users see is now consistent.
      const calibratedConf = (pd?.predictions?.calibrated_confidence as number | undefined) ?? v3conf
      const headlineConf = calibratedConf || v3conf || v1conf
      const odds = m.consensusOdds as any

      // Per-pick EV inputs: the V3 probability for the picked side, and the
      // market's consensus decimal odds for that side. consensusOdds in DB are
      // no-vig probabilities (0-1); convert to decimal odds via 1/prob.
      const pickProbForSide = pickSide === 'home' ? v3hw : pickSide === 'away' ? v3aw : v3dw
      const consensusProbForSide = odds ? Number(odds[pickSide]) || 0 : 0
      const pickOddsDecimal = consensusProbForSide > 0 && consensusProbForSide < 1
        ? 1 / consensusProbForSide
        : undefined

      // Generate slug
      const slug = `${m.homeTeam.toLowerCase().replace(/\s+/g, '-')}-vs-${m.awayTeam.toLowerCase().replace(/\s+/g, '-')}-${m.matchId}`

      picks.push({
        id: m.id,
        sport: 'soccer',
        sportEmoji: '⚽',
        matchId: m.matchId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league,
        kickoff: m.kickoffDate.toISOString(),
        pick: pickSide.charAt(0).toUpperCase() + pickSide.slice(1),
        pickTeam,
        confidence: Math.round(headlineConf * 100),
        tier,
        starRating: tier === 'premium' ? 5 : tier === 'strong' ? 4 : tier === 'value' ? 4 : 3,
        reasons,
        edge: v3preds.edge_vs_market || undefined,
        odds: odds ? { home: odds.home, draw: odds.draw, away: odds.away } : undefined,
        pickProb: pickProbForSide > 0 ? pickProbForSide : undefined,
        pickOdds: pickOddsDecimal,
        slug: `/match/${slug}`,
      })
    }
  } catch (error) {
    console.error('[SnapBet Picks] Error fetching soccer picks:', error)
  }

  return picks
}

// ─── Multisport Picks ───────────────────────────────────────────────────────

export type MultisportShort = 'nba' | 'nhl' | 'ncaab' | 'nfl'

/** Per-sport entry gates (minimum model confidence). Derived from EV analysis
 *  (scripts/multisport-alpha-analysis.ts, last 90d of the pre-pivot data):
 *    - NBA was 0.80; lowered to 0.75 because the 0.75-0.85 bucket is the
 *      actual value lane (+0.19 EV).
 *    - NHL was 0.85; the model is systematically under-confident in NHL —
 *      the 0.65-0.75 bucket has +0.31 EV. Lowered to 0.55 to capture it.
 *    - NCAAB unchanged (small sample, deferred).
 *    - NFL: PROVISIONAL. No NFL alpha analysis exists yet (first NFL model
 *      trains in pipeline/ once ≥120 games are collected). Gate 0.65 and a
 *      'strong' ceiling until scripts/multisport-alpha-analysis.ts covers it. */
export const MULTISPORT_CONF_GATES: Record<MultisportShort, number> = {
  nba: 0.75,
  nhl: 0.55,
  ncaab: 0.75,
  nfl: 0.65,
}

export function multisportShort(sportKey: string): MultisportShort {
  if (isMultisportKey(sportKey)) return MULTISPORT[sportKey].slug as MultisportShort
  return 'nba'
}

/**
 * Pure tier/eligibility decision for one multisport row. Exported so it can
 * be unit-tested without Prisma.
 *
 * Order of precedence (mirrors soccer's Criterion 0):
 *   0. Cold start: no model block → never a pick (the pipeline publishes
 *      market lines before a model exists; we show no pick, not a guess).
 *   1. Edge-validated value bet in predictionData → 'value' pick on the
 *      value-bet outcome at the best price. The honesty gate in the pipeline
 *      (model_track_record.edge_validated) is the only thing that can turn
 *      this on.
 *   2. Otherwise the per-sport confidence buckets below.
 */
export function evaluateMultisportPick(
  sport: MultisportShort,
  row: { model: unknown; predictionData: unknown },
): {
  qualifies: boolean
  tier: 'premium' | 'strong' | 'value' | 'standard'
  pick: 'H' | 'A' | null
  pickedProb: number
  confidence: number
  reasons: string[]
  edgeActionable: boolean
  edgePrice: number | null
  edgeEv: number | null
} {
  const model = (row.model as any) || null
  const preds = model ? (model.predictions || model) : null
  const confidence: number = preds?.confidence || 0
  const modelPick: 'H' | 'A' | null = preds?.pick === 'H' || preds?.pick === 'A' ? preds.pick : null
  const reasons: string[] = []
  const none = { qualifies: false, tier: 'standard' as const, pick: null, pickedProb: 0, confidence,
                 reasons, edgeActionable: false, edgePrice: null, edgeEv: null }

  if (!preds || !modelPick) return none  // cold start: market line only

  // Criterion 0 — edge-validated value bet beats every confidence rule.
  const edgeSummary = edgeSummaryFromPredictionData(row.predictionData)
  const edgeActionable = hasActionableValue(edgeSummary)
  if (edgeActionable && (edgeSummary.outcome === 'home' || edgeSummary.outcome === 'away')) {
    const pick: 'H' | 'A' = edgeSummary.outcome === 'home' ? 'H' : 'A'
    const pickedProb = pick === 'H' ? (preds.home_win || 0) : (preds.away_win || 0)
    reasons.push(
      `Edge-validated value bet: +${Math.round((edgeSummary.ev ?? 0) * 100)}% EV at ${edgeSummary.price}` +
      (edgeSummary.book ? ` (${edgeSummary.book})` : '') +
      (edgeSummary.rating ? ` — ${edgeSummary.rating.replace('_', ' ')}` : ''),
    )
    return { qualifies: true, tier: 'value', pick, pickedProb, confidence: Math.max(confidence, pickedProb),
             reasons, edgeActionable: true, edgePrice: edgeSummary.price, edgeEv: edgeSummary.ev }
  }

  if (confidence < MULTISPORT_CONF_GATES[sport]) return none
  const pick = modelPick
  const pickedProb = pick === 'H' ? (preds.home_win || 0) : (preds.away_win || 0)
  let tier: 'premium' | 'strong' | 'value' | 'standard' = 'standard'
  let qualifies = true

  if (sport === 'nba') {
    // Premium: premium conviction + home pick OR conviction + favorite
    //   (93% acc, +0.13 EV n=14)  /  (91% acc, +0.12 EV n=23)
    if (preds.conviction_tier === 'premium' && (pick === 'H' || pickedProb >= 0.65)) {
      tier = 'premium'
      reasons.push(`NBA premium ${pick === 'H' ? 'home' : 'favorite'} (93%/91% historical accuracy)`)
    } else if (confidence >= 0.85) {
      tier = 'strong'
      reasons.push(`NBA strong: ${Math.round(confidence * 100)}% confidence (79%+ accuracy)`)
    } else if (confidence >= 0.75 && confidence < 0.85) {
      tier = 'value'
      reasons.push(`NBA value bucket: 75-85% confidence historically +19% EV at avg 1.67x odds`)
    }
    // Skip: underdog picks (model fades favorite → negative EV in NBA, -0.08 historically)
    if (pickedProb < 0.45) qualifies = false
  } else if (sport === 'nhl') {
    // Premium doesn't exist in NHL (n=5, -0.07 EV). The ≥0.85 gate is harmful (-0.09 EV).
    if (confidence >= 0.85) {
      qualifies = false
    } else if (confidence >= 0.75 && confidence < 0.85) {
      tier = 'strong'
      reasons.push(`NHL strong: 75-85% confidence (+12% EV historically)`)
    } else if (confidence >= 0.65 && confidence < 0.75) {
      tier = 'value'
      reasons.push(`NHL sweet spot: 65-75% confidence historically +31% EV at avg 2.18x odds`)
    } else if (pickedProb < 0.50 && confidence >= 0.55) {
      tier = 'value'
      reasons.push(`NHL underdog: model fades the favorite (+15% EV historically)`)
    }
  } else if (sport === 'nfl') {
    // PROVISIONAL — no NFL track record yet. Never 'premium' until the alpha
    // analysis covers NFL; 'strong' only for high-confidence favourites.
    if (confidence >= 0.75 && pickedProb >= 0.5) {
      tier = 'strong'
      reasons.push(`NFL strong (provisional): ${Math.round(confidence * 100)}% confidence — no NFL track record yet`)
    } else {
      reasons.push(`NFL standard (provisional): ${Math.round(confidence * 100)}% confidence — no NFL track record yet`)
    }
    if (pickedProb < 0.45) qualifies = false  // no underdog calls without evidence
  } else {
    // NCAAB (unchanged, small sample)
    if (confidence >= 0.90) {
      tier = 'premium'
      reasons.push(`NCAAB model ${Math.round(confidence * 100)}% confidence (elite tier)`)
    } else if (confidence >= 0.75) {
      tier = 'strong'
      reasons.push(`NCAAB model ${Math.round(confidence * 100)}% (above 75% threshold)`)
    }
    if (preds.conviction_tier === 'premium' && tier !== 'premium') {
      tier = 'premium'
      reasons.push('Premium conviction tier')
    }
  }

  return { qualifies, tier, pick, pickedProb, confidence, reasons, edgeActionable: false, edgePrice: null, edgeEv: null }
}

async function getMultisportPicks(sportKey: string): Promise<SnapBetPick[]> {
  const picks: SnapBetPick[] = []
  const sport = multisportShort(sportKey)
  const def = isMultisportKey(sportKey) ? MULTISPORT[sportKey] : MULTISPORT.basketball_nba

  try {
    const matches = await prisma.multisportMatch.findMany({
      where: {
        sport: sportKey,
        status: 'upcoming',
        commenceTime: { gte: new Date() },
      },
      orderBy: { commenceTime: 'asc' },
      take: 50,
    })

    for (const m of matches) {
      const ev = evaluateMultisportPick(sport, { model: m.model, predictionData: m.predictionData })
      if (!ev.qualifies || !ev.pick) continue

      const pick = ev.pick
      const pickTeam = pick === 'H' ? m.homeTeam : m.awayTeam
      const pickSide = pick === 'H' ? 'Home' : 'Away'
      const preds = ((m.model as any)?.predictions || m.model || {}) as any

      const odds = (m.odds as any) || {}
      const consensus = odds.consensus || {}

      // Per-pick EV inputs: model's prob for the picked side + decimal odds.
      // For edge picks use the best available price (that is the bet); else
      // the consensus no-vig probability → decimal odds.
      const consensusProbForSide = pick === 'H' ? consensus.home_prob : consensus.away_prob
      const consensusOdds = typeof consensusProbForSide === 'number'
        && consensusProbForSide > 0 && consensusProbForSide < 1
          ? 1 / consensusProbForSide
          : undefined
      const pickOddsDecimal = ev.edgeActionable && ev.edgePrice ? ev.edgePrice : consensusOdds

      picks.push({
        id: m.id,
        sport,
        sportEmoji: def.emoji,
        matchId: m.eventId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league || def.name,
        kickoff: m.commenceTime.toISOString(),
        pick: pickSide,
        pickTeam,
        confidence: Math.round(ev.confidence * 100),
        tier: ev.tier,
        starRating: ev.tier === 'premium' ? 5 : ev.tier === 'strong' ? 4 : ev.tier === 'value' ? 4 : 3,
        reasons: ev.reasons,
        edge: ev.edgeActionable ? (ev.edgeEv ?? undefined) : (preds.edge_vs_market || undefined),
        spread: consensus.home_spread ?? undefined,
        totalLine: consensus.total_line ?? undefined,
        pickProb: ev.pickedProb > 0 ? ev.pickedProb : undefined,
        pickOdds: pickOddsDecimal,
        slug: `/sports/${sportKey}/${m.eventId}`,
      })
    }
  } catch (error) {
    console.error(`[SnapBet Picks] Error fetching ${sport} picks:`, error)
  }

  return picks
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isStrongLeague(league: string): boolean {
  return STRONG_SOCCER_LEAGUES.some(sl =>
    league.toLowerCase().includes(sl.toLowerCase()) ||
    sl.toLowerCase().includes(league.toLowerCase())
  )
}

function isWeakLeague(league: string): boolean {
  return WEAK_SOCCER_LEAGUES.some(wl =>
    league.toLowerCase().includes(wl.toLowerCase())
  )
}

function isHighDrawLeague(league: string): boolean {
  // Leagues with >30% draw rate from our data
  const highDraw = ['LaLiga2', 'Jupiler Pro League', 'League 39', 'League 88', '2. Bundesliga']
  return highDraw.some(hd => league.toLowerCase().includes(hd.toLowerCase()))
}

function isNegativeConsensusLeague(league: string): boolean {
  return NEGATIVE_CONSENSUS_LEAGUES.some(nl =>
    league.toLowerCase().includes(nl.toLowerCase())
  )
}
