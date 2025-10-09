/**
 * CLV (Closing Line Value) Calculator
 * Calculates confidence and stake recommendations based on closing line value
 */

export interface CLVCalculation {
  entryOdds: number
  closeOdds: number
  pEntry: number
  pClose: number
  clvPercent: number
  evPercent: number
  confidence: number
  kellyFraction: number
  recommendedStake: number
}

/**
 * Calculate CLV metrics from entry and closing odds
 */
export function calculateCLV(
  entryOdds: number,
  closeOdds: number,
  maxStakeFraction: number = 0.05 // 5% max stake
): CLVCalculation {
  // Step 1: Convert odds to implied probabilities
  const pEntry = 1 / entryOdds
  const pClose = 1 / closeOdds

  // Step 2: Calculate CLV%
  const clvPercent = ((pClose - pEntry) / pEntry) * 100

  // Step 3: Calculate EV% from the close
  const ev = pClose * entryOdds - 1
  const evPercent = ev * 100

  // Step 4: Calculate confidence (0-100) using smooth logistic function
  const a = 0.8 // steepness
  const m = 1.5 // midpoint at ~+1.5% EV
  const confidence = Math.round(100 / (1 + Math.exp(-a * (evPercent - m))))

  // Step 5: Calculate Kelly fraction
  const b = entryOdds - 1
  const edge = ev
  const kellyFraction = edge > 0 ? edge / b : 0
  
  // Half-Kelly for risk control, capped at max stake fraction
  const recommendedStake = Math.min(kellyFraction * 0.5, maxStakeFraction)

  return {
    entryOdds,
    closeOdds,
    pEntry,
    pClose,
    clvPercent,
    evPercent,
    confidence: Math.max(0, Math.min(100, confidence)), // Clamp 0-100
    kellyFraction,
    recommendedStake: Math.max(0, recommendedStake) // Never negative
  }
}

/**
 * Get confidence color based on confidence score
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 85) return 'text-green-600'
  if (confidence >= 70) return 'text-green-500'
  if (confidence >= 55) return 'text-yellow-600'
  if (confidence >= 40) return 'text-orange-500'
  if (confidence >= 25) return 'text-orange-600'
  return 'text-red-600'
}

/**
 * Get confidence background color for meter
 */
export function getConfidenceBgColor(confidence: number): string {
  if (confidence >= 85) return 'bg-green-600'
  if (confidence >= 70) return 'bg-green-500'
  if (confidence >= 55) return 'bg-yellow-500'
  if (confidence >= 40) return 'bg-orange-500'
  if (confidence >= 25) return 'bg-orange-600'
  return 'bg-red-600'
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Format stake as percentage
 */
export function formatStake(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`
}

