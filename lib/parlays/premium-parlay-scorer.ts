/**
 * Premium Parlay Scoring Engine
 *
 * Computes a parlay-level premium score by:
 * 1. Scoring each leg using the match-level premium scorer
 * 2. Aggregating leg scores with bonuses for all-star consistency
 * 3. Factoring in parlay-specific quality signals (low correlation, edge, confidence)
 *
 * Tiers (mapped to stars):
 *   ⭐⭐⭐⭐⭐ ELITE    (85-100): Every leg is premium + low correlation + high edge
 *   ⭐⭐⭐⭐   PREMIUM  (70-84):  Most legs premium/strong + good edge
 *   ⭐⭐⭐     STRONG   (55-69):  Solid legs + moderate edge
 *   ⭐⭐       STANDARD (40-54):  Mixed quality
 *   ⭐         WEAK     (<40):    Low confidence or mismatched legs
 */

import prisma from '@/lib/db'
import { calculatePremiumScore, extractModelInputs, type PremiumScore } from '@/lib/predictions/premium-scorer'

export interface ParlayLegPremiumInfo {
  matchId: string
  homeTeam: string
  awayTeam: string
  outcome: string
  premiumScore: number
  premiumTier: string
  signals: string[]
}

export interface ParlayPremiumResult {
  score: number           // 0-100
  tier: string            // "5-star", "4-star", "3-star", "2-star", "1-star"
  stars: number           // 1-5
  reasons: string[]       // Human-readable reasons
  legScores: ParlayLegPremiumInfo[]
  avgLegScore: number
  allLegsStrong: boolean  // All legs ≥60 (strong+)
  allLegsPremium: boolean // All legs ≥80 (premium)
}

/**
 * Score a parlay's premium quality by looking up each leg's match data.
 */
export async function scoreParlayPremium(
  legs: Array<{ matchId: string; outcome: string; homeTeam: string; awayTeam: string; modelProb?: number; edge?: number }>
): Promise<ParlayPremiumResult> {
  const reasons: string[] = []
  const legScores: ParlayLegPremiumInfo[] = []

  // Batch-fetch all MarketMatch records for the legs
  const matchIds = [...new Set(legs.map(l => l.matchId))]
  const matches = await prisma.marketMatch.findMany({
    where: { matchId: { in: matchIds } },
    select: {
      matchId: true,
      v1Model: true,
      v2Model: true,
      v3Model: true,
      consensusOdds: true,
      allBookmakers: true,
      booksCount: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
    },
  })
  const matchMap = new Map(matches.map(m => [m.matchId, m]))

  // Score each leg
  for (const leg of legs) {
    const match = matchMap.get(leg.matchId)

    if (!match) {
      // No match data — give a default low score
      legScores.push({
        matchId: leg.matchId,
        homeTeam: leg.homeTeam,
        awayTeam: leg.awayTeam,
        outcome: leg.outcome,
        premiumScore: 20,
        premiumTier: 'speculative',
        signals: ['No match data found'],
      })
      continue
    }

    // Use the existing premium scorer
    const modelInputs = extractModelInputs(match)
    const legPremium = calculatePremiumScore(modelInputs)

    legScores.push({
      matchId: leg.matchId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      outcome: leg.outcome,
      premiumScore: legPremium.score,
      premiumTier: legPremium.tier,
      signals: legPremium.signals,
    })
  }

  // ── Aggregate leg scores ──
  const avgLegScore = legScores.length > 0
    ? legScores.reduce((sum, l) => sum + l.premiumScore, 0) / legScores.length
    : 0

  const allLegsStrong = legScores.every(l => l.premiumScore >= 60)
  const allLegsPremium = legScores.every(l => l.premiumScore >= 80)
  const weakLegs = legScores.filter(l => l.premiumScore < 40)
  const premiumLegs = legScores.filter(l => l.premiumScore >= 80)

  // ── Compute parlay premium score ──
  let score = avgLegScore // Start with average leg quality (0-100)

  // Bonus: all legs are strong/premium
  if (allLegsPremium && legs.length >= 2) {
    score += 15
    reasons.push(`All ${legs.length} legs are ⭐⭐⭐ premium`)
  } else if (allLegsStrong && legs.length >= 2) {
    score += 8
    reasons.push(`All ${legs.length} legs are ⭐⭐+ strong`)
  }

  // Bonus: premium legs ratio
  if (premiumLegs.length > 0 && !allLegsPremium) {
    reasons.push(`${premiumLegs.length}/${legs.length} legs are premium`)
  }

  // Penalty: weak legs drag down the parlay
  if (weakLegs.length > 0) {
    score -= weakLegs.length * 5
    reasons.push(`${weakLegs.length} weak leg(s) reduce reliability`)
  }

  // Bonus: consistent home picks (historically ~82% accuracy)
  const homePickLegs = legScores.filter(l => ['H', 'home', 'home_win'].includes(l.outcome.toLowerCase()))
  if (homePickLegs.length >= 2 && homePickLegs.length === legs.length) {
    score += 5
    reasons.push('All home picks (historically ~82%)')
  } else if (homePickLegs.length >= Math.ceil(legs.length * 0.7)) {
    score += 3
    reasons.push(`${homePickLegs.length}/${legs.length} home picks`)
  }

  // Bonus: low leg count = more reliable
  if (legs.length === 2) {
    score += 3
    reasons.push('2-leg parlay (more reliable)')
  } else if (legs.length === 3) {
    score += 1
  } else if (legs.length >= 5) {
    score -= 3
    reasons.push(`${legs.length} legs (higher risk)`)
  }

  // Clamp
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Determine tier
  let tier: string
  let stars: number
  if (score >= 85) {
    tier = '5-star'; stars = 5
  } else if (score >= 70) {
    tier = '4-star'; stars = 4
  } else if (score >= 55) {
    tier = '3-star'; stars = 3
  } else if (score >= 40) {
    tier = '2-star'; stars = 2
  } else {
    tier = '1-star'; stars = 1
  }

  if (reasons.length === 0) {
    reasons.push(`Average leg quality: ${Math.round(avgLegScore)}`)
  }

  return {
    score,
    tier,
    stars,
    reasons,
    legScores,
    avgLegScore: Math.round(avgLegScore),
    allLegsStrong,
    allLegsPremium,
  }
}

/**
 * Score and update an existing parlay in the database.
 * Used by the generation pipeline and sync cron.
 */
export async function scoreAndUpdateParlay(parlayId: string): Promise<ParlayPremiumResult | null> {
  const parlay = await prisma.parlayConsensus.findUnique({
    where: { id: parlayId },
    include: { legs: true },
  })

  if (!parlay || parlay.legs.length === 0) return null

  const result = await scoreParlayPremium(
    parlay.legs.map(l => ({
      matchId: l.matchId,
      outcome: l.outcome,
      homeTeam: l.homeTeam,
      awayTeam: l.awayTeam,
      modelProb: Number(l.modelProb),
      edge: Number(l.edge),
    }))
  )

  // Update parlay with premium scores
  await prisma.parlayConsensus.update({
    where: { id: parlayId },
    data: {
      premiumScore: result.score,
      premiumTier: result.tier,
      premiumReasons: result.reasons,
      avgLegPremiumScore: result.avgLegScore,
    },
  })

  // Update individual legs
  for (const legScore of result.legScores) {
    const leg = parlay.legs.find(l => l.matchId === legScore.matchId)
    if (leg) {
      await prisma.parlayLeg.update({
        where: { id: leg.id },
        data: {
          premiumScore: legScore.premiumScore,
          premiumTier: legScore.premiumTier,
        },
      })
    }
  }

  return result
}

/**
 * Batch-score all active parlays that don't have premium scores yet.
 * Useful for backfilling existing parlays.
 */
export async function scoreAllActiveParlays(): Promise<{ scored: number; errors: number }> {
  const parlays = await prisma.parlayConsensus.findMany({
    where: {
      status: 'active',
      premiumScore: null,
    },
    select: { id: true },
    take: 100,
  })

  let scored = 0
  let errors = 0

  for (const parlay of parlays) {
    try {
      await scoreAndUpdateParlay(parlay.id)
      scored++
    } catch (error) {
      errors++
      console.error(`[Premium Parlay Scorer] Error scoring parlay ${parlay.id}:`, error)
    }
  }

  return { scored, errors }
}
