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
  tier: 'premium' | 'strong' | 'standard'
  starRating: number    // 1-5
  reasons: string[]     // Why this pick qualifies
  // Premium-only fields
  edge?: number         // Model edge vs market
  odds?: { home?: number; draw?: number; away?: number }
  spread?: number
  totalLine?: number
  slug?: string         // For linking to detail page
}

// Strong leagues where models perform best (from report data)
const STRONG_SOCCER_LEAGUES = [
  'Africa Cup of Nations',    // V3: 70%, V1: 74%
  'Scottish Premiership',     // V1: 72%
  'League 78',                // V3: 67% (Bundesliga)
  'Bundesliga',               // V3: 67%
  'Eredivisie',               // V3: 64%
  'Championship',             // V1: 50%+
  'Süper Lig',                // V1: 64%
  'League One',               // V1: 64%
  'Super League Greece',      // V1: 55%
  'Serie A',                  // V3: 50%+
  'La Liga',                  // V3: 75% (small sample)
  'UEFA Champions League',    // V3: 52%
  'UEFA Europa League',       // V3: 52%
  'Swiss Super League',       // V1: 75%
]

// Weak leagues to deprioritize
const WEAK_SOCCER_LEAGUES = [
  'Ligue 1',       // V3: 20%
  'Ligue 2',       // V1: 0%
  'A-League',      // V3: 30%
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
    const tierOrder = { premium: 0, strong: 1, standard: 2 }
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
      let tier: 'premium' | 'strong' | 'standard' = 'standard'

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

      // Criterion 3: V1+V3 agree + home pick + low draw league
      if (v1pick === v3pick && v1pick === 'home' && !isHighDrawLeague(league)) {
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
        starRating: tier === 'premium' ? 5 : tier === 'strong' ? 4 : 3,
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

      let tier: 'premium' | 'strong' | 'standard' = 'standard'

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
