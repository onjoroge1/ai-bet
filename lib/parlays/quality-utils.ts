/**
 * Quality calculation and filtering utilities for parlays
 */

/**
 * Calculate composite quality score for a parlay
 * Score = (edge * 0.4) + (probability * 100 * 0.3) + (confidence * 0.3)
 * 
 * @param edgePct - Edge percentage (e.g., 5.5 for 5.5%)
 * @param combinedProb - Combined probability (0-1, e.g., 0.25 for 25%)
 * @param confidenceTier - Confidence tier ('high', 'medium', 'low')
 * @returns Quality score (0-100, higher is better)
 */
export function calculateQualityScore(
  edgePct: number,
  combinedProb: number,
  confidenceTier: string
): number {
  // Normalize edge: 0-50% maps to 0-50 points
  const edgeScore = Math.min(Math.max(edgePct, 0), 50) * (50 / 50) // Cap at 50, scale to 50 points
  
  // Normalize probability: 0-100% maps to 0-30 points
  const probScore = Math.min(Math.max(combinedProb * 100, 0), 100) * 0.3
  
  // Normalize confidence: high=1.0, medium=0.7, low=0.4
  const confidenceMap: Record<string, number> = {
    'high': 1.0,
    'medium': 0.7,
    'low': 0.4,
  }
  const confidenceValue = confidenceMap[confidenceTier?.toLowerCase()] || 0.4
  const confidenceScore = confidenceValue * 30 // Scale to 30 points
  
  return edgeScore * 0.4 + probScore * 0.3 + confidenceScore * 0.3
}

/**
 * Determine if a parlay is tradable
 * Tradable = edge >= 5% AND probability >= 5%
 */
export function isTradable(edgePct: number, combinedProb: number): boolean {
  return edgePct >= 5 && combinedProb >= 0.05
}

/**
 * Determine risk level based on combined probability
 */
export function getRiskLevel(combinedProb: number): 'low' | 'medium' | 'high' | 'very_high' {
  if (combinedProb >= 0.20) return 'low'
  if (combinedProb >= 0.10) return 'medium'
  if (combinedProb >= 0.05) return 'high'
  return 'very_high'
}

/**
 * Check if two legs are correlated (should be avoided in same parlay)
 * Correlation rules:
 * - Same match + different market types can be correlated
 * - Home Win + Over 2.5 from same match are correlated
 * - Home Win + BTTS Yes from same match are correlated
 * - Totals Over + BTTS Yes from same match are correlated
 */
export function areLegsCorrelated(
  leg1: { market: string; side: string; matchId: string; outcome?: string },
  leg2: { market: string; side: string; matchId: string; outcome?: string }
): boolean {
  // If different matches, not correlated
  if (leg1.matchId !== leg2.matchId) return false
  
  // Same market, opposite sides (e.g., Over 2.5 vs Under 2.5) - already filtered out
  if (leg1.market === leg2.market && leg1.side !== leg2.side) return true
  
  // Correlation patterns (same match):
  // For SGP generation, check market types and outcomes
  // Market types: 'DNB', 'TOTALS', 'BTTS', 'DOUBLE_CHANCE', 'CLEAN_SHEET', etc.
  // Outcomes: 'H', 'A', 'OVER_2_5', 'UNDER_3_5', 'BTTS_YES', etc.
  
  // Home Win (DNB HOME or DOUBLE_CHANCE 1X) + Over 2.5+ goals
  const leg1IsHomeWin = (leg1.market === 'DNB' && leg1.side === 'HOME') || 
                        (leg1.market === 'DOUBLE_CHANCE' && leg1.side === '1X') ||
                        (leg1.outcome === 'H')
  const leg2IsHomeWin = (leg2.market === 'DNB' && leg2.side === 'HOME') || 
                        (leg2.market === 'DOUBLE_CHANCE' && leg2.side === '1X') ||
                        (leg2.outcome === 'H')
  const leg1IsOver25 = (leg1.market === 'TOTALS' && leg1.side === 'OVER' && 
                       parseFloat(leg1.outcome?.split('_')[1]?.replace('_', '.') || '0') >= 2.5) ||
                       (leg1.outcome?.startsWith('OVER_2') === true)
  const leg2IsOver25 = (leg2.market === 'TOTALS' && leg2.side === 'OVER' && 
                       parseFloat(leg2.outcome?.split('_')[1]?.replace('_', '.') || '0') >= 2.5) ||
                       (leg2.outcome?.startsWith('OVER_2') === true)
  
  if ((leg1IsHomeWin && leg2IsOver25) || (leg2IsHomeWin && leg1IsOver25)) return true
  
  // Home Win + BTTS Yes
  const leg1IsBTTSYes = (leg1.market === 'BTTS' && leg1.side === 'YES') || leg1.outcome === 'BTTS_YES'
  const leg2IsBTTSYes = (leg2.market === 'BTTS' && leg2.side === 'YES') || leg2.outcome === 'BTTS_YES'
  
  if ((leg1IsHomeWin && leg2IsBTTSYes) || (leg2IsHomeWin && leg1IsBTTSYes)) return true
  
  // Over 2.5+ goals + BTTS Yes
  if ((leg1IsOver25 && leg2IsBTTSYes) || (leg2IsOver25 && leg1IsBTTSYes)) return true
  
  return false
}

/**
 * Calculate correlation penalty for multiple legs
 * More legs = lower penalty factor
 * Correlated legs = additional penalty
 */
export function calculateCorrelationPenalty(legCount: number, hasCorrelatedLegs: boolean): number {
  // Base penalty by leg count
  const basePenalty = legCount === 2 ? 0.85 : legCount === 3 ? 0.80 : 0.75
  
  // Additional penalty for correlated legs
  if (hasCorrelatedLegs) {
    return basePenalty * 0.90 // 10% additional penalty
  }
  
  return basePenalty
}

/**
 * Get quality tier based on quality score
 */
export function getQualityTier(qualityScore: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (qualityScore >= 70) return 'excellent'
  if (qualityScore >= 50) return 'good'
  if (qualityScore >= 30) return 'fair'
  return 'poor'
}

