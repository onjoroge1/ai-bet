/**
 * Premium Pick Scoring Engine
 *
 * Computes a quality score (0-100) and tier for each prediction based on:
 * - Model agreement (V1, V2, V3 picking the same outcome)
 * - Confidence levels across models
 * - Whether bookmaker odds back the prediction (not form-only)
 * - Historical accuracy patterns (home picks ~82%, away ~50%)
 *
 * Tiers:
 *   ⭐⭐⭐ PREMIUM (80-100): All models agree + high confidence + odds-backed
 *   ⭐⭐   STRONG  (60-79):  2+ models agree or single high confidence
 *   ⭐     STANDARD (40-59): Has prediction data, moderate signals
 *          SPECULATIVE (<40): Low confidence, no agreement, form-only
 */

export interface ModelInput {
  pick: string    // "home" | "away" | "draw"
  confidence: number // 0-100 (percentage)
}

export interface PremiumScoreInput {
  v1?: ModelInput | null
  v2?: ModelInput | null
  v3?: ModelInput | null
  hasBookmakerOdds: boolean
  pick: string // The final/consensus pick
}

export interface PremiumScore {
  score: number
  tier: 'premium' | 'strong' | 'standard' | 'speculative'
  stars: 3 | 2 | 1 | 0
  signals: string[]
  modelsAgreeing: number
  totalModels: number
}

/**
 * Normalise a pick string to canonical form.
 */
function normPick(p: string | null | undefined): string | null {
  if (!p) return null
  const s = p.trim().toLowerCase()
  if (['home', 'h', '1', 'home_win'].includes(s)) return 'home'
  if (['away', 'a', '2', 'away_win'].includes(s)) return 'away'
  if (['draw', 'd', 'x'].includes(s)) return 'draw'
  return s
}

/**
 * Calculate the premium score for a prediction.
 */
export function calculatePremiumScore(input: PremiumScoreInput): PremiumScore {
  const signals: string[] = []
  let score = 0

  const models: Array<{ name: string; pick: string; confidence: number }> = []
  if (input.v1?.pick) models.push({ name: 'V1', pick: normPick(input.v1.pick)!, confidence: input.v1.confidence })
  if (input.v2?.pick) models.push({ name: 'V2', pick: normPick(input.v2.pick)!, confidence: input.v2.confidence })
  if (input.v3?.pick) models.push({ name: 'V3', pick: normPick(input.v3.pick)!, confidence: input.v3.confidence })

  const totalModels = models.length
  const consensusPick = normPick(input.pick) || (models[0]?.pick ?? null)

  if (totalModels === 0 || !consensusPick) {
    return { score: 0, tier: 'speculative', stars: 0, signals: ['No model data'], modelsAgreeing: 0, totalModels: 0 }
  }

  // Count how many models agree with the consensus pick
  const agreeing = models.filter(m => m.pick === consensusPick)
  const modelsAgreeing = agreeing.length
  const highestConfidence = Math.max(...models.map(m => m.confidence))
  const avgConfidence = models.reduce((s, m) => s + m.confidence, 0) / totalModels

  // ── Agreement scoring (0-40 points) ──
  if (modelsAgreeing === totalModels && totalModels >= 3) {
    score += 40
    signals.push('All 3 models agree')
  } else if (modelsAgreeing === totalModels && totalModels === 2) {
    score += 32
    signals.push(`${models.map(m => m.name).join('+')} agree`)
  } else if (modelsAgreeing >= 2) {
    score += 22
    const agreeNames = agreeing.map(m => m.name).join('+')
    signals.push(`${agreeNames} agree (${totalModels - modelsAgreeing} disagree)`)
  } else {
    score += 5
    signals.push('Models disagree')
  }

  // ── Confidence scoring (0-30 points) ──
  if (highestConfidence >= 75) {
    score += 30
    signals.push(`High confidence (${Math.round(highestConfidence)}%)`)
  } else if (highestConfidence >= 65) {
    score += 22
    signals.push(`Good confidence (${Math.round(highestConfidence)}%)`)
  } else if (highestConfidence >= 55) {
    score += 14
    signals.push(`Moderate confidence (${Math.round(highestConfidence)}%)`)
  } else {
    score += 5
    signals.push(`Low confidence (${Math.round(highestConfidence)}%)`)
  }

  // ── Odds-backed scoring (0-15 points) ──
  if (input.hasBookmakerOdds) {
    score += 15
    signals.push('Odds-backed prediction')
  } else {
    score += 2
    signals.push('Form-only (no odds data)')
  }

  // ── Home bias bonus (0-10 points) ──
  // Historical accuracy: home picks ~82%, away ~50%, draw ~35%
  if (consensusPick === 'home' && modelsAgreeing >= 2) {
    score += 10
    signals.push('Home pick (historically ~82%)')
  } else if (consensusPick === 'away' && modelsAgreeing >= 2 && highestConfidence >= 65) {
    score += 6
    signals.push('Confident away pick')
  } else if (consensusPick === 'draw') {
    // Draw picks are risky — slight penalty unless high agreement
    if (modelsAgreeing >= 2 && highestConfidence >= 60) {
      score += 4
      signals.push('Draw pick (models agree)')
    } else {
      score += 0
      signals.push('Draw pick (low historical accuracy)')
    }
  }

  // ── Multi-model bonus (0-5 points) ──
  if (totalModels >= 3) {
    score += 5
    signals.push(`${totalModels} models evaluated`)
  } else if (totalModels === 2) {
    score += 3
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))

  // Determine tier
  let tier: PremiumScore['tier']
  let stars: PremiumScore['stars']

  if (score >= 80) {
    tier = 'premium'
    stars = 3
  } else if (score >= 60) {
    tier = 'strong'
    stars = 2
  } else if (score >= 40) {
    tier = 'standard'
    stars = 1
  } else {
    tier = 'speculative'
    stars = 0
  }

  return {
    score,
    tier,
    stars,
    signals,
    modelsAgreeing,
    totalModels,
  }
}

/**
 * Extract model inputs from MarketMatch v1Model/v2Model/v3Model JSON fields.
 */
export function extractModelInputs(match: {
  v1Model?: any
  v2Model?: any
  v3Model?: any
  consensusOdds?: any
  allBookmakers?: any
  booksCount?: number | null
}): PremiumScoreInput & { pick: string } {
  const v1 = match.v1Model as { pick?: string; confidence?: number } | null
  const v2 = match.v2Model as { pick?: string; confidence?: number } | null
  const v3 = match.v3Model as { pick?: string; confidence?: number } | null

  const toInput = (m: { pick?: string; confidence?: number } | null): ModelInput | null => {
    if (!m?.pick) return null
    const conf = typeof m.confidence === 'number'
      ? (m.confidence <= 1 ? m.confidence * 100 : m.confidence)
      : 50
    return { pick: m.pick, confidence: conf }
  }

  const v1Input = toInput(v1)
  const v2Input = toInput(v2)
  const v3Input = toInput(v3)

  // Determine consensus pick from models
  const picks = [v1Input?.pick, v2Input?.pick, v3Input?.pick].filter(Boolean) as string[]
  const pickCounts = picks.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc }, {} as Record<string, number>)
  const consensusPick = Object.entries(pickCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || picks[0] || 'home'

  const hasBookmakerOdds = !!(
    match.allBookmakers && Object.keys(match.allBookmakers as object).length > 0
  ) || !!(match.booksCount && match.booksCount > 0)

  return {
    v1: v1Input,
    v2: v2Input,
    v3: v3Input,
    hasBookmakerOdds,
    pick: consensusPick,
  }
}
