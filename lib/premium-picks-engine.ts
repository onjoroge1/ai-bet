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
 */

import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { deriveSurfaceFromPrediction } from '@/lib/predictions/should-surface'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SnapBetPick {
  id: string
  sport: 'soccer' | 'nba' | 'nhl' | 'ncaab'
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
  spread?: number
  totalLine?: number
  slug?: string         // For linking to detail page
}

// Strong leagues where models perform best.
// Last reviewed: 2026-05-11 — empirical update from 90-day fresh-era V3 insights.
// Confirmed entries (n ≥ 20) have current accuracy noted; legacy entries kept
// from prior curation are flagged. To regenerate the empirical rationale,
// run `npx tsx scripts/premium-tier-analysis.ts --days 90`.
const STRONG_SOCCER_LEAGUES = [
  // ── V3-DOMINANT (V3 > V1, n ≥ 20, large agreement lift) ──
  'Bundesliga',               // V1: 52%, V3: 59%  agree-lift +37pp  (n=29)
  'La Liga',                  // V1: 58%, V3: 61%  agree-lift +50pp  (n=33)

  // ── Confirmed strong (n ≥ 20, V1 or V3 ≥ 50%) ──
  'Premier League',           // V1: 55%, V3: 52%  agree-lift +12pp  (n=42)  [empirical add 2026-05-11]
  'Eredivisie',               // V1: 43%, V3: 47%  agree-lift +12pp  (n=30)
  'UEFA Champions League',    // V1: 57%, V3: 50%  agree-lift +27pp  (n=8 fresh-era; legacy)
  'UEFA Europa League',       // V1: 52%, V3: 38%  legacy
  'Serie A',                  // V1: 35%, V3: 38% — KEEP for surfacing, but consensus is anti-signal (-4pp agree lift)

  // ── Exploratory (n < 20, promising but small sample) ──
  'Süper Lig',                // V1: 55%, V3: 83%  agree-lift +83pp  (n=6 — exploratory)  [add 2026-05-11]
  'Eliteserien',              // V1: 63%, V3: 71%  agree-lift +83pp  (n=7 — exploratory)  [add 2026-05-11]
  'Allsvenskan',              // V1: 67%, V3: 56%                  (n=9 — exploratory)  [add 2026-05-11]
  'Jupiler Pro League',       // V1: 64%, V3: 56%  agree-lift  +7pp (n=11 — exploratory) [add 2026-05-11]
  'J1 League',                // V1: 45%, V3: 60%  agree-lift +30pp (n=15 — exploratory) [add 2026-05-11]

  // ── Legacy entries (kept from prior curation, no current n ≥ 20 data) ──
  'Africa Cup of Nations',    // V3: 70%, V1: 74% (legacy)
  'Scottish Premiership',     // V1: 72% (legacy)
  'League 78',                // V3: 67% (Bundesliga 2 alias)
  'Championship',             // V1: 50%+ (legacy)
  'League One',               // V1: 64% (legacy)
  'Super League Greece',      // V1: 55% (legacy)
  'Swiss Super League',       // V1: 75% (legacy)
]

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

  // Fetch all sports in parallel
  const [soccerPicks, nbaPicks, ncaabPicks, nhlPicks] = await Promise.all([
    getSoccerPicks(),
    getMultisportPicks('basketball_nba', 'nba'),
    getMultisportPicks('basketball_ncaab', 'ncaab'),
    getMultisportPicks('icehockey_nhl', 'nhl'),
  ])

  allPicks.push(...soccerPicks, ...nbaPicks, ...ncaabPicks, ...nhlPicks)

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
        v1Model: { not: Prisma.JsonNull },
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
      if (!v1?.pick) continue

      const v1pick = v1.pick.toLowerCase()
      const v1conf = v1.confidence || 0
      const league = m.league || ''
      const reasons: string[] = []

      // Get V3 data from QuickPurchase
      const qp = qpByMatchId.get(m.matchId)
      const pd = qp?.predictionData as any
      const v3preds = pd?.predictions || {}
      const v3hw = v3preds.home_win || 0
      const v3dw = v3preds.draw || 0
      const v3aw = v3preds.away_win || 0
      const v3conf = v3preds.confidence || 0
      let v3pick = ''
      if (v3hw > 0 || v3aw > 0) {
        if (v3hw >= v3dw && v3hw >= v3aw) v3pick = 'home'
        else if (v3aw >= v3dw && v3aw >= v3hw) v3pick = 'away'
        else v3pick = 'draw'
      }

      // Premium score from QuickPurchase
      const premiumScore = qp?.premiumScore ? Number(qp.premiumScore) : 0
      const premiumTier = qp?.premiumTier || ''

      // ── Apply selection criteria ──

      let qualifies = false
      let tier: 'premium' | 'strong' | 'value' | 'standard' = 'standard'

      // Criterion 1: V3 confidence ≥ 60% → 100% historical accuracy
      if (v3conf >= 0.6) {
        qualifies = true
        tier = 'premium'
        reasons.push(`V3 confidence ${Math.round(v3conf * 100)}% (100% historical accuracy at 60%+)`)
      }

      // Criterion 2: V3 confidence ≥ 50% + strong league
      if (v3conf >= 0.5 && isStrongLeague(league)) {
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

      // Skip weak leagues unless very high confidence
      if (isWeakLeague(league) && v3conf < 0.6 && v1conf < 0.75) {
        qualifies = false
      }

      // Hard gate from backend's V2 surface logic.
      // Even if our tier criteria above accept this pick, if the model has
      // tagged it "Lean: ..." or "No bet" we don't show it. Single source of
      // truth — when backend exposes explicit `should_surface`, swap the
      // helper's body to read it directly; this call site stays the same.
      const surface = deriveSurfaceFromPrediction(pd)
      if (!surface.shouldSurface) {
        qualifies = false
      }

      if (!qualifies) continue

      const pickSide = v3pick || v1pick
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
        slug: `/match/${slug}`,
      })
    }
  } catch (error) {
    console.error('[SnapBet Picks] Error fetching soccer picks:', error)
  }

  return picks
}

// ─── Multisport Picks ───────────────────────────────────────────────────────

async function getMultisportPicks(
  sportKey: string,
  sport: 'nba' | 'nhl' | 'ncaab'
): Promise<SnapBetPick[]> {
  const picks: SnapBetPick[] = []

  // Confidence thresholds by sport (based on accuracy data)
  const thresholds = {
    nba: 0.80,    // 79% accuracy at 80%+
    ncaab: 0.75,  // 73% accuracy
    nhl: 0.85,    // 47% overall — need very high conf
  }

  const sportEmojis = { nba: '🏀', nhl: '🏒', ncaab: '🏀' }
  const sportNames = { nba: 'NBA', nhl: 'NHL', ncaab: 'NCAAB' }
  const threshold = thresholds[sport]

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
      const model = (m.model as any) || {}
      const preds = model.predictions || model
      const confidence = preds.confidence || 0
      const pick = preds.pick || ''

      if (!pick || confidence < threshold) continue

      const pickTeam = pick === 'H' ? m.homeTeam : m.awayTeam
      const pickSide = pick === 'H' ? 'Home' : 'Away'
      const reasons: string[] = []

      // Multisport doesn't currently emit 'value' tier — soccer-only for now.
      let tier: 'premium' | 'strong' | 'value' | 'standard' = 'standard'

      if (confidence >= 0.90) {
        tier = 'premium'
        reasons.push(`${sportNames[sport]} model ${Math.round(confidence * 100)}% confidence (elite tier)`)
      } else if (confidence >= threshold) {
        tier = 'strong'
        reasons.push(`${sportNames[sport]} model ${Math.round(confidence * 100)}% (above ${Math.round(threshold * 100)}% threshold)`)
      }

      // Add conviction tier if available
      if (preds.conviction_tier === 'premium') {
        if (tier !== 'premium') tier = 'premium'
        reasons.push('Premium conviction tier')
      }

      const odds = (m.odds as any) || {}
      const consensus = odds.consensus || {}
      const spreadData = m.spread as any || {}

      // Build slug
      const slugHome = m.homeTeam.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const slugAway = m.awayTeam.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      picks.push({
        id: m.id,
        sport,
        sportEmoji: sportEmojis[sport],
        matchId: m.eventId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league || sportNames[sport],
        kickoff: m.commenceTime.toISOString(),
        pick: pickSide,
        pickTeam,
        confidence: Math.round(confidence * 100),
        tier,
        // Multisport never assigns 'value' (it's soccer-only for now), so the
        // ternary only needs to cover the multisport-reachable tiers.
        starRating: tier === 'premium' ? 5 : tier === 'strong' ? 4 : 3,
        reasons,
        edge: preds.edge_vs_market || undefined,
        spread: consensus.home_spread || undefined,
        totalLine: consensus.total_line || undefined,
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
