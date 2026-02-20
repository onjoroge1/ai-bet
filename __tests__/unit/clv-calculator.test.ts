/**
 * Unit tests for CLV Calculator
 * Tests: calculateCLV, getConfidenceColor, getConfidenceBgColor, formatPercent, formatStake
 */

import {
  calculateCLV,
  getConfidenceColor,
  getConfidenceBgColor,
  formatPercent,
  formatStake,
} from '@/lib/clv-calculator'

describe('CLV Calculator', () => {
  // ─── calculateCLV ───────────────────────────────────────────────────

  describe('calculateCLV', () => {
    it('should calculate positive CLV when closing odds are lower', () => {
      // Entry at 2.50, closes at 2.00 → odds moved in your favor
      const result = calculateCLV(2.50, 2.00)
      expect(result.clvPercent).toBeGreaterThan(0)
    })

    it('should calculate negative CLV when closing odds are higher', () => {
      // Entry at 2.00, closes at 2.50 → odds moved against you
      const result = calculateCLV(2.00, 2.50)
      expect(result.clvPercent).toBeLessThan(0)
    })

    it('should return zero CLV when odds are the same', () => {
      const result = calculateCLV(2.00, 2.00)
      expect(result.clvPercent).toBeCloseTo(0, 5)
    })

    it('should calculate entry and close implied probabilities correctly', () => {
      const result = calculateCLV(2.00, 2.50)
      expect(result.pEntry).toBeCloseTo(0.5, 5)    // 1/2.00
      expect(result.pClose).toBeCloseTo(0.4, 5)     // 1/2.50
    })

    it('should calculate EV correctly with positive edge', () => {
      // Entry at 3.00, closes at 2.00
      // pClose = 0.5, EV = 0.5 * 3.00 - 1 = 0.5
      const result = calculateCLV(3.00, 2.00)
      expect(result.evPercent).toBeCloseTo(50, 0)
    })

    it('should calculate EV correctly with negative edge', () => {
      // Entry at 1.50, closes at 2.00
      // pClose = 0.5, EV = 0.5 * 1.50 - 1 = -0.25
      const result = calculateCLV(1.50, 2.00)
      expect(result.evPercent).toBeLessThan(0)
    })

    it('should calculate Kelly fraction correctly for positive edge', () => {
      // Entry at 3.00, closes at 2.00
      // b = 2.0, edge = 0.5, Kelly = 0.5/2.0 = 0.25
      const result = calculateCLV(3.00, 2.00)
      expect(result.kellyFraction).toBeCloseTo(0.25, 2)
    })

    it('should return zero Kelly for negative edge', () => {
      const result = calculateCLV(1.50, 2.00)
      expect(result.kellyFraction).toBe(0)
    })

    it('should cap recommended stake at maxStakeFraction', () => {
      // Very high positive edge
      const result = calculateCLV(10.00, 1.50, 0.05)
      expect(result.recommendedStake).toBeLessThanOrEqual(0.05)
    })

    it('should use half-Kelly for recommended stake', () => {
      const result = calculateCLV(3.00, 2.00)
      // Kelly = 0.25, half Kelly = 0.125
      expect(result.recommendedStake).toBeCloseTo(0.05, 2) // Capped at 5%
    })

    it('should clamp confidence between 0 and 100', () => {
      // Very high positive edge
      const result1 = calculateCLV(10.00, 1.10)
      expect(result1.confidence).toBeLessThanOrEqual(100)
      expect(result1.confidence).toBeGreaterThanOrEqual(0)

      // Very negative edge
      const result2 = calculateCLV(1.05, 10.00)
      expect(result2.confidence).toBeLessThanOrEqual(100)
      expect(result2.confidence).toBeGreaterThanOrEqual(0)
    })

    it('should never return negative recommendedStake', () => {
      const result = calculateCLV(1.50, 2.00)
      expect(result.recommendedStake).toBeGreaterThanOrEqual(0)
    })

    it('should return all required fields', () => {
      const result = calculateCLV(2.50, 2.00)
      expect(result).toHaveProperty('entryOdds')
      expect(result).toHaveProperty('closeOdds')
      expect(result).toHaveProperty('pEntry')
      expect(result).toHaveProperty('pClose')
      expect(result).toHaveProperty('clvPercent')
      expect(result).toHaveProperty('evPercent')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('kellyFraction')
      expect(result).toHaveProperty('recommendedStake')
    })
  })

  // ─── getConfidenceColor ─────────────────────────────────────────────

  describe('getConfidenceColor', () => {
    it('should return green-600 for very high confidence (>=85)', () => {
      expect(getConfidenceColor(85)).toBe('text-green-600')
      expect(getConfidenceColor(100)).toBe('text-green-600')
    })

    it('should return green-500 for high confidence (70-84)', () => {
      expect(getConfidenceColor(70)).toBe('text-green-500')
    })

    it('should return yellow-600 for medium confidence (55-69)', () => {
      expect(getConfidenceColor(55)).toBe('text-yellow-600')
    })

    it('should return orange-500 for moderate confidence (40-54)', () => {
      expect(getConfidenceColor(40)).toBe('text-orange-500')
    })

    it('should return orange-600 for low confidence (25-39)', () => {
      expect(getConfidenceColor(25)).toBe('text-orange-600')
    })

    it('should return red-600 for very low confidence (<25)', () => {
      expect(getConfidenceColor(0)).toBe('text-red-600')
      expect(getConfidenceColor(24)).toBe('text-red-600')
    })
  })

  // ─── getConfidenceBgColor ───────────────────────────────────────────

  describe('getConfidenceBgColor', () => {
    it('should return bg-green-600 for very high confidence', () => {
      expect(getConfidenceBgColor(85)).toBe('bg-green-600')
    })

    it('should return bg-green-500 for high confidence', () => {
      expect(getConfidenceBgColor(70)).toBe('bg-green-500')
    })

    it('should return bg-yellow-500 for medium confidence', () => {
      expect(getConfidenceBgColor(55)).toBe('bg-yellow-500')
    })

    it('should return bg-orange-500 for moderate confidence', () => {
      expect(getConfidenceBgColor(40)).toBe('bg-orange-500')
    })

    it('should return bg-orange-600 for low confidence', () => {
      expect(getConfidenceBgColor(25)).toBe('bg-orange-600')
    })

    it('should return bg-red-600 for very low confidence', () => {
      expect(getConfidenceBgColor(0)).toBe('bg-red-600')
    })
  })

  // ─── formatPercent ──────────────────────────────────────────────────

  describe('formatPercent', () => {
    it('should format positive values with + sign', () => {
      expect(formatPercent(5.5)).toBe('+5.50%')
    })

    it('should format negative values with - sign', () => {
      expect(formatPercent(-3.2)).toBe('-3.20%')
    })

    it('should format zero without sign', () => {
      expect(formatPercent(0)).toBe('0.00%')
    })

    it('should respect custom decimal places', () => {
      expect(formatPercent(5.555, 1)).toBe('+5.6%')
      expect(formatPercent(5.555, 3)).toBe('+5.555%')
    })
  })

  // ─── formatStake ────────────────────────────────────────────────────

  describe('formatStake', () => {
    it('should format fraction as percentage', () => {
      expect(formatStake(0.05)).toBe('5.00%')
    })

    it('should format small fractions', () => {
      expect(formatStake(0.001)).toBe('0.10%')
    })

    it('should format zero', () => {
      expect(formatStake(0)).toBe('0.00%')
    })
  })
})

