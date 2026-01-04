/**
 * Edge calculation and formatting utilities for parlays
 */

/**
 * Normalize edge value - handles both decimal (0-1) and percentage (0-100+) formats
 * Backend may send edge as percentage, so we need to detect and handle both
 */
export function normalizeEdge(edge: number | string): number {
  const numEdge = typeof edge === 'string' ? parseFloat(edge) : edge
  
  if (isNaN(numEdge)) return 0
  
  // If edge is > 1, it's likely already a percentage (e.g., 8.33 = 8.33%)
  // If edge is <= 1, it's a decimal (e.g., 0.0833 = 8.33%)
  // However, valid edges can be negative decimals too, so we need a better check
  
  // Typical edge percentages: -50% to +100% (rarely higher than 50% in practice)
  // If value is > 10, it's almost certainly already a percentage (wrong format)
  // If value is between -1 and 1, it's likely a decimal
  if (Math.abs(numEdge) > 10) {
    // Already a percentage (but might be wrong - e.g., 833.33%)
    // Check if it's suspiciously high (likely error)
    if (Math.abs(numEdge) > 100) {
      // Likely a calculation error - divide by 10 to get reasonable value
      // Or this could be a unit error (should be divided by 100 if it's a decimal multiplied incorrectly)
      return numEdge / 10
    }
    return numEdge
  }
  
  // Decimal format (0-1 range) - convert to percentage
  return numEdge * 100
}

/**
 * Format edge as percentage string
 */
export function formatEdge(edge: number | string): string {
  const normalized = normalizeEdge(edge)
  const sign = normalized >= 0 ? '+' : ''
  return `${sign}${normalized.toFixed(2)}%`
}

/**
 * Check if edge value is suspicious (likely an error)
 */
export function isSuspiciousEdge(edge: number | string): boolean {
  const normalized = normalizeEdge(edge)
  // Edges above 100% are extremely rare and likely errors
  return Math.abs(normalized) > 100
}

/**
 * Calculate edge from model probability and decimal odds
 * Edge = (Model Probability / Implied Probability) - 1
 * Or: Edge = (Model Prob * Decimal Odds) - 1
 */
export function calculateEdge(modelProb: number, decimalOdds: number): number {
  if (!decimalOdds || decimalOdds <= 0) return 0
  if (!modelProb || modelProb <= 0) return 0
  
  const impliedProb = 1 / decimalOdds
  const edge = (modelProb / impliedProb) - 1
  return edge * 100 // Return as percentage
}

/**
 * Get edge color based on value
 */
export function getEdgeColor(edge: number | string): string {
  const normalized = Math.abs(normalizeEdge(edge))
  
  if (normalized >= 20) return 'text-emerald-400'
  if (normalized >= 10) return 'text-yellow-400'
  if (normalized >= 5) return 'text-orange-400'
  return 'text-slate-400'
}

