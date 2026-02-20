/**
 * Unit tests for parlay quality utilities
 * Tests: calculateQualityScore, isTradable, getRiskLevel,
 *        areLegsCorrelated, calculateCorrelationPenalty, getQualityTier
 */

import {
  calculateQualityScore,
  isTradable,
  getRiskLevel,
  areLegsCorrelated,
  calculateCorrelationPenalty,
  getQualityTier,
} from '@/lib/parlays/quality-utils'

describe('Parlay Quality Utils', () => {
  // ─── calculateQualityScore ──────────────────────────────────────────

  describe('calculateQualityScore', () => {
    it('should return a higher score for higher edge', () => {
      const scoreHighEdge = calculateQualityScore(30, 0.25, 'high')
      const scoreLowEdge = calculateQualityScore(5, 0.25, 'high')
      expect(scoreHighEdge).toBeGreaterThan(scoreLowEdge)
    })

    it('should return a higher score for higher probability', () => {
      const scoreHighProb = calculateQualityScore(10, 0.50, 'medium')
      const scoreLowProb = calculateQualityScore(10, 0.10, 'medium')
      expect(scoreHighProb).toBeGreaterThan(scoreLowProb)
    })

    it('should return a higher score for higher confidence tier', () => {
      const scoreHigh = calculateQualityScore(10, 0.25, 'high')
      const scoreLow = calculateQualityScore(10, 0.25, 'low')
      expect(scoreHigh).toBeGreaterThan(scoreLow)
    })

    it('should handle edge percentage of 0', () => {
      const score = calculateQualityScore(0, 0.25, 'medium')
      expect(score).toBeGreaterThanOrEqual(0)
    })

    it('should cap edge at 50 for the formula', () => {
      const score50 = calculateQualityScore(50, 0.25, 'high')
      const score100 = calculateQualityScore(100, 0.25, 'high')
      // Both should be the same since edge is capped at 50
      expect(score50).toBe(score100)
    })

    it('should handle unknown confidence tier gracefully', () => {
      const score = calculateQualityScore(10, 0.25, 'unknown')
      // Should default to 0.4 (same as 'low')
      const scoreLow = calculateQualityScore(10, 0.25, 'low')
      expect(score).toBe(scoreLow)
    })

    it('should produce a score between 0 and ~50 for typical values', () => {
      const score = calculateQualityScore(15, 0.25, 'medium')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThan(60)
    })

    it('should handle probability of 0', () => {
      const score = calculateQualityScore(10, 0, 'medium')
      expect(score).toBeGreaterThanOrEqual(0)
    })

    it('should handle probability of 1', () => {
      const score = calculateQualityScore(10, 1.0, 'high')
      expect(score).toBeGreaterThan(0)
    })
  })

  // ─── isTradable ─────────────────────────────────────────────────────

  describe('isTradable', () => {
    it('should be tradable when edge >= 5% and prob >= 5%', () => {
      expect(isTradable(5, 0.05)).toBe(true)
    })

    it('should not be tradable when edge < 5%', () => {
      expect(isTradable(4.9, 0.10)).toBe(false)
    })

    it('should not be tradable when probability < 5%', () => {
      expect(isTradable(10, 0.04)).toBe(false)
    })

    it('should not be tradable when both are below threshold', () => {
      expect(isTradable(2, 0.02)).toBe(false)
    })

    it('should be tradable for high edge and high probability', () => {
      expect(isTradable(25, 0.30)).toBe(true)
    })

    it('should be tradable at exactly the boundaries', () => {
      expect(isTradable(5, 0.05)).toBe(true)
    })
  })

  // ─── getRiskLevel ───────────────────────────────────────────────────

  describe('getRiskLevel', () => {
    it('should return low for high probability (>= 20%)', () => {
      expect(getRiskLevel(0.20)).toBe('low')
      expect(getRiskLevel(0.50)).toBe('low')
    })

    it('should return medium for moderate probability (10-20%)', () => {
      expect(getRiskLevel(0.10)).toBe('medium')
      expect(getRiskLevel(0.15)).toBe('medium')
    })

    it('should return high for low probability (5-10%)', () => {
      expect(getRiskLevel(0.05)).toBe('high')
      expect(getRiskLevel(0.09)).toBe('high')
    })

    it('should return very_high for very low probability (< 5%)', () => {
      expect(getRiskLevel(0.04)).toBe('very_high')
      expect(getRiskLevel(0.01)).toBe('very_high')
      expect(getRiskLevel(0)).toBe('very_high')
    })

    it('should handle boundary values correctly', () => {
      expect(getRiskLevel(0.20)).toBe('low')
      expect(getRiskLevel(0.10)).toBe('medium')
      expect(getRiskLevel(0.05)).toBe('high')
    })
  })

  // ─── areLegsCorrelated ──────────────────────────────────────────────

  describe('areLegsCorrelated', () => {
    it('should not be correlated if different matches', () => {
      const result = areLegsCorrelated(
        { market: 'DNB', side: 'HOME', matchId: '1', outcome: 'H' },
        { market: 'DNB', side: 'HOME', matchId: '2', outcome: 'H' }
      )
      expect(result).toBe(false)
    })

    it('should be correlated if same market but opposite sides in same match', () => {
      const result = areLegsCorrelated(
        { market: 'TOTALS', side: 'OVER', matchId: '1', outcome: 'OVER_2_5' },
        { market: 'TOTALS', side: 'UNDER', matchId: '1', outcome: 'UNDER_2_5' }
      )
      expect(result).toBe(true)
    })

    it('should detect Home Win + BTTS Yes correlation in same match', () => {
      const result = areLegsCorrelated(
        { market: 'DNB', side: 'HOME', matchId: '1', outcome: 'H' },
        { market: 'BTTS', side: 'YES', matchId: '1', outcome: 'BTTS_YES' }
      )
      expect(result).toBe(true)
    })

    it('should detect Home Win + Over 2.5 correlation in same match', () => {
      const result = areLegsCorrelated(
        { market: 'DNB', side: 'HOME', matchId: '1', outcome: 'H' },
        { market: 'TOTALS', side: 'OVER', matchId: '1', outcome: 'OVER_2_5' }
      )
      expect(result).toBe(true)
    })

    it('should detect Over 2.5 + BTTS Yes correlation in same match', () => {
      const result = areLegsCorrelated(
        { market: 'TOTALS', side: 'OVER', matchId: '1', outcome: 'OVER_2_5' },
        { market: 'BTTS', side: 'YES', matchId: '1', outcome: 'BTTS_YES' }
      )
      expect(result).toBe(true)
    })

    it('should not flag unrelated markets in same match as correlated', () => {
      const result = areLegsCorrelated(
        { market: 'ODD_EVEN', side: 'ODD', matchId: '1', outcome: 'ODD' },
        { market: 'TOTALS', side: 'OVER', matchId: '1', outcome: 'OVER_2_5' }
      )
      expect(result).toBe(false)
    })

    it('should not flag different markets on different matches', () => {
      const result = areLegsCorrelated(
        { market: 'DNB', side: 'HOME', matchId: '1' },
        { market: 'BTTS', side: 'YES', matchId: '2' }
      )
      expect(result).toBe(false)
    })
  })

  // ─── calculateCorrelationPenalty ────────────────────────────────────

  describe('calculateCorrelationPenalty', () => {
    it('should return 0.85 for 2-leg parlays without correlation', () => {
      expect(calculateCorrelationPenalty(2, false)).toBe(0.85)
    })

    it('should return 0.80 for 3-leg parlays without correlation', () => {
      expect(calculateCorrelationPenalty(3, false)).toBe(0.80)
    })

    it('should return 0.75 for 4+ leg parlays without correlation', () => {
      expect(calculateCorrelationPenalty(4, false)).toBe(0.75)
      expect(calculateCorrelationPenalty(5, false)).toBe(0.75)
    })

    it('should apply additional 10% penalty for correlated legs', () => {
      const twoLegNormal = calculateCorrelationPenalty(2, false)
      const twoLegCorrelated = calculateCorrelationPenalty(2, true)
      expect(twoLegCorrelated).toBeCloseTo(twoLegNormal * 0.90, 5)
    })

    it('should return lower penalty for more legs', () => {
      const twoLeg = calculateCorrelationPenalty(2, false)
      const threeLeg = calculateCorrelationPenalty(3, false)
      const fourLeg = calculateCorrelationPenalty(4, false)
      expect(twoLeg).toBeGreaterThan(threeLeg)
      expect(threeLeg).toBeGreaterThan(fourLeg)
    })

    it('should return penalty between 0 and 1', () => {
      for (let legs = 2; legs <= 6; legs++) {
        for (const corr of [true, false]) {
          const penalty = calculateCorrelationPenalty(legs, corr)
          expect(penalty).toBeGreaterThan(0)
          expect(penalty).toBeLessThanOrEqual(1)
        }
      }
    })
  })

  // ─── getQualityTier ─────────────────────────────────────────────────

  describe('getQualityTier', () => {
    it('should return excellent for score >= 70', () => {
      expect(getQualityTier(70)).toBe('excellent')
      expect(getQualityTier(100)).toBe('excellent')
    })

    it('should return good for score 50-69', () => {
      expect(getQualityTier(50)).toBe('good')
      expect(getQualityTier(69)).toBe('good')
    })

    it('should return fair for score 30-49', () => {
      expect(getQualityTier(30)).toBe('fair')
      expect(getQualityTier(49)).toBe('fair')
    })

    it('should return poor for score < 30', () => {
      expect(getQualityTier(0)).toBe('poor')
      expect(getQualityTier(29)).toBe('poor')
    })
  })
})

