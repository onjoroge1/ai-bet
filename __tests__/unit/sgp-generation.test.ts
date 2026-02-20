/**
 * Unit tests for SGP (Single-Game Parlay) generation logic
 * Tests: contradiction detection, narrative matching, and general SGP generation logic.
 * 
 * Note: The route handler functions use Prisma and are not easily unit-testable
 * without a full database. Here we test the exported-style logic by recreating the
 * key pure functions from the route.
 */

// Recreate the contradiction logic from the route (these are pure functions)
const CONTRADICTIONS: [string, string][] = [
  ['home_clean_sheet', 'btts_yes'],
  ['away_clean_sheet', 'btts_yes'],
  ['home_win_to_nil', 'btts_yes'],
  ['away_win_to_nil', 'btts_yes'],
  ['home_clean_sheet', 'away_scores'],
  ['away_clean_sheet', 'home_scores'],
  ['home_win_to_nil', 'away_scores'],
  ['away_win_to_nil', 'home_scores'],
  ['under_0_5', 'btts_yes'],
  ['under_0_5', 'home_scores'],
  ['under_0_5', 'away_scores'],
  ['under_0_5', 'over_1_5'],
  ['under_0_5', 'over_2_5'],
  ['under_0_5', 'over_3_5'],
  ['under_0_5', 'over_4_5'],
  ['under_1_5', 'btts_yes'],
  ['under_1_5', 'over_2_5'],
  ['under_1_5', 'over_3_5'],
  ['under_1_5', 'over_4_5'],
  ['under_2_5', 'over_2_5'],
  ['under_2_5', 'over_3_5'],
  ['under_2_5', 'over_4_5'],
  ['under_3_5', 'over_3_5'],
  ['under_3_5', 'over_4_5'],
  ['under_4_5', 'over_4_5'],
  ['btts_no', 'over_3_5'],
  ['btts_no', 'over_4_5'],
  ['dnb_home', 'dc_x2'],
  ['dnb_away', 'dc_1x'],
  ['home_under_0_5', 'home_scores'],
  ['away_under_0_5', 'away_scores'],
  ['home_over_0_5', 'away_clean_sheet'],
  ['home_over_1_5', 'away_clean_sheet'],
  ['away_over_0_5', 'home_clean_sheet'],
  ['away_over_1_5', 'home_clean_sheet'],
]

const CONTRADICTION_SET = new Set(CONTRADICTIONS.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]))

function hasContradiction(tags1: string[], tags2: string[]): boolean {
  for (const t1 of tags1) {
    for (const t2 of tags2) {
      if (CONTRADICTION_SET.has(`${t1}|${t2}`)) return true
    }
  }
  return false
}

interface SGPLeg {
  market: string
  side: string
  probability: number
  description: string
  outcome: string
  tags: string[]
}

function hasAnyContradiction(existingLegs: SGPLeg[], newLeg: SGPLeg): boolean {
  for (const existing of existingLegs) {
    if (hasContradiction(existing.tags, newLeg.tags)) return true
  }
  return false
}

// Narrative matching (from route)
interface NarrativeTemplate {
  name: string
  requiredPatterns: string[][]
  boost: number
}

const NARRATIVES: NarrativeTemplate[] = [
  {
    name: 'Home Dominant',
    requiredPatterns: [['dnb_home', 'dc_1x'], ['over_1_5', 'over_2_5', 'home_scores']],
    boost: 1.15,
  },
  {
    name: 'Away Upset',
    requiredPatterns: [['dnb_away', 'dc_x2'], ['away_scores']],
    boost: 1.10,
  },
  {
    name: 'Goal Fest',
    requiredPatterns: [['over_2_5', 'over_3_5'], ['btts_yes']],
    boost: 1.20,
  },
  {
    name: 'Low Scoring',
    requiredPatterns: [['under_2_5', 'under_3_5'], ['btts_no']],
    boost: 1.15,
  },
  {
    name: 'Home Shutout',
    requiredPatterns: [['dnb_home', 'dc_1x'], ['home_clean_sheet', 'home_win_to_nil']],
    boost: 1.10,
  },
]

function matchNarrative(legs: SGPLeg[]): { name: string; boost: number } | null {
  const allTags = new Set(legs.flatMap(l => l.tags))
  for (const narrative of NARRATIVES) {
    const matches = narrative.requiredPatterns.every(patterns =>
      patterns.some(tag => allTags.has(tag))
    )
    if (matches) return { name: narrative.name, boost: narrative.boost }
  }
  return null
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SGP Generation Logic', () => {
  // ─── Contradiction Detection ────────────────────────────────────────

  describe('hasContradiction', () => {
    it('should detect Home Clean Sheet + BTTS Yes as contradictory', () => {
      expect(hasContradiction(['home_clean_sheet'], ['btts_yes'])).toBe(true)
    })

    it('should detect BTTS Yes + Home Clean Sheet as contradictory (reverse order)', () => {
      expect(hasContradiction(['btts_yes'], ['home_clean_sheet'])).toBe(true)
    })

    it('should detect Under 0.5 + Over 2.5 as contradictory', () => {
      expect(hasContradiction(['under_0_5'], ['over_2_5'])).toBe(true)
    })

    it('should detect Under 0.5 + BTTS Yes as contradictory', () => {
      expect(hasContradiction(['under_0_5'], ['btts_yes'])).toBe(true)
    })

    it('should detect Under 0.5 + home_scores as contradictory', () => {
      expect(hasContradiction(['under_0_5'], ['home_scores'])).toBe(true)
    })

    it('should detect Under 1.5 + BTTS Yes as contradictory', () => {
      expect(hasContradiction(['under_1_5'], ['btts_yes'])).toBe(true)
    })

    it('should detect Under 2.5 + Over 2.5 as contradictory', () => {
      expect(hasContradiction(['under_2_5'], ['over_2_5'])).toBe(true)
    })

    it('should detect DNB Home + Double Chance X2 as contradictory', () => {
      expect(hasContradiction(['dnb_home'], ['dc_x2'])).toBe(true)
    })

    it('should detect DNB Away + Double Chance 1X as contradictory', () => {
      expect(hasContradiction(['dnb_away'], ['dc_1x'])).toBe(true)
    })

    it('should detect Win-to-Nil Home + BTTS Yes as contradictory', () => {
      expect(hasContradiction(['home_win_to_nil'], ['btts_yes'])).toBe(true)
    })

    it('should detect Home Over 0.5 + Away Clean Sheet as contradictory', () => {
      expect(hasContradiction(['home_over_0_5'], ['away_clean_sheet'])).toBe(true)
    })

    it('should NOT detect Over 2.5 + BTTS Yes as contradictory', () => {
      expect(hasContradiction(['over_2_5'], ['btts_yes'])).toBe(false)
    })

    it('should NOT detect DNB Home + Over 2.5 as contradictory', () => {
      expect(hasContradiction(['dnb_home'], ['over_2_5'])).toBe(false)
    })

    it('should NOT detect unrelated tags as contradictory', () => {
      expect(hasContradiction(['odd_total'], ['high_scoring'])).toBe(false)
    })

    it('should handle empty tag arrays', () => {
      expect(hasContradiction([], ['btts_yes'])).toBe(false)
      expect(hasContradiction(['dnb_home'], [])).toBe(false)
      expect(hasContradiction([], [])).toBe(false)
    })

    it('should detect BTTS No + Over 3.5 as contradictory', () => {
      expect(hasContradiction(['btts_no'], ['over_3_5'])).toBe(true)
    })

    it('should detect BTTS No + Over 4.5 as contradictory', () => {
      expect(hasContradiction(['btts_no'], ['over_4_5'])).toBe(true)
    })

    it('should NOT detect BTTS No + Over 2.5 as contradictory', () => {
      // BTTS No + Over 2.5 is NOT in the contradiction list
      // (one team could score 3+ while the other scores 0)
      expect(hasContradiction(['btts_no'], ['over_2_5'])).toBe(false)
    })

    it('should handle multi-tag legs and detect if any pair contradicts', () => {
      // Leg with tags ['home_clean_sheet', 'dnb_home'] vs ['btts_yes', 'high_scoring']
      // home_clean_sheet + btts_yes → contradiction
      expect(hasContradiction(
        ['home_clean_sheet', 'dnb_home'],
        ['btts_yes', 'high_scoring']
      )).toBe(true)
    })
  })

  // ─── hasAnyContradiction ────────────────────────────────────────────

  describe('hasAnyContradiction', () => {
    it('should return true if new leg contradicts any existing leg', () => {
      const existing: SGPLeg[] = [
        { market: 'CLEAN_SHEET', side: 'HOME', probability: 0.4, description: 'Home CS', outcome: 'CS_H', tags: ['home_clean_sheet'] },
      ]
      const newLeg: SGPLeg = {
        market: 'BTTS', side: 'YES', probability: 0.55, description: 'BTTS', outcome: 'BTTS_YES',
        tags: ['btts_yes', 'home_scores', 'away_scores'],
      }
      expect(hasAnyContradiction(existing, newLeg)).toBe(true)
    })

    it('should return false if new leg does not contradict any existing leg', () => {
      const existing: SGPLeg[] = [
        { market: 'DNB', side: 'HOME', probability: 0.65, description: 'Home DNB', outcome: 'DNB_H', tags: ['dnb_home', 'home_favored'] },
      ]
      const newLeg: SGPLeg = {
        market: 'TOTALS', side: 'OVER', probability: 0.60, description: 'Over 2.5', outcome: 'OVER_2_5',
        tags: ['over_2_5', 'high_scoring'],
      }
      expect(hasAnyContradiction(existing, newLeg)).toBe(false)
    })

    it('should check all existing legs', () => {
      const existing: SGPLeg[] = [
        { market: 'DNB', side: 'HOME', probability: 0.65, description: 'Home DNB', outcome: 'DNB_H', tags: ['dnb_home'] },
        { market: 'TOTALS', side: 'UNDER', probability: 0.55, description: 'Under 0.5', outcome: 'UNDER_0_5', tags: ['under_0_5', 'low_scoring'] },
      ]
      // btts_yes contradicts under_0_5
      const newLeg: SGPLeg = {
        market: 'BTTS', side: 'YES', probability: 0.50, description: 'BTTS Yes', outcome: 'BTTS_YES',
        tags: ['btts_yes'],
      }
      expect(hasAnyContradiction(existing, newLeg)).toBe(true)
    })

    it('should return false for empty existing legs', () => {
      const newLeg: SGPLeg = {
        market: 'DNB', side: 'HOME', probability: 0.65, description: 'Home DNB', outcome: 'DNB_H',
        tags: ['dnb_home'],
      }
      expect(hasAnyContradiction([], newLeg)).toBe(false)
    })
  })

  // ─── Narrative Matching ─────────────────────────────────────────────

  describe('matchNarrative', () => {
    it('should match "Home Dominant" narrative', () => {
      const legs: SGPLeg[] = [
        { market: 'DNB', side: 'HOME', probability: 0.65, description: '', outcome: 'DNB_H', tags: ['dnb_home', 'home_favored'] },
        { market: 'TOTALS', side: 'OVER', probability: 0.60, description: '', outcome: 'OVER_2_5', tags: ['over_2_5', 'high_scoring'] },
      ]
      const result = matchNarrative(legs)
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Home Dominant')
      expect(result!.boost).toBe(1.15)
    })

    it('should match "Goal Fest" narrative', () => {
      const legs: SGPLeg[] = [
        { market: 'TOTALS', side: 'OVER', probability: 0.55, description: '', outcome: 'OVER_2_5', tags: ['over_2_5', 'high_scoring'] },
        { market: 'BTTS', side: 'YES', probability: 0.60, description: '', outcome: 'BTTS_YES', tags: ['btts_yes', 'home_scores', 'away_scores'] },
      ]
      const result = matchNarrative(legs)
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Goal Fest')
      expect(result!.boost).toBe(1.20)
    })

    it('should match "Low Scoring" narrative', () => {
      const legs: SGPLeg[] = [
        { market: 'TOTALS', side: 'UNDER', probability: 0.55, description: '', outcome: 'UNDER_2_5', tags: ['under_2_5', 'low_scoring'] },
        { market: 'BTTS', side: 'NO', probability: 0.60, description: '', outcome: 'BTTS_NO', tags: ['btts_no'] },
      ]
      const result = matchNarrative(legs)
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Low Scoring')
    })

    it('should match "Away Upset" narrative', () => {
      const legs: SGPLeg[] = [
        { market: 'DOUBLE_CHANCE', side: 'X2', probability: 0.55, description: '', outcome: 'DC_X2', tags: ['dc_x2', 'away_favored'] },
        { market: 'TEAM_TOTALS', side: 'AWAY_OVER', probability: 0.45, description: '', outcome: 'TT_A_OVER_0_5', tags: ['away_over_0_5', 'away_scores'] },
      ]
      const result = matchNarrative(legs)
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Away Upset')
    })

    it('should match "Home Shutout" narrative', () => {
      const legs: SGPLeg[] = [
        { market: 'DNB', side: 'HOME', probability: 0.65, description: '', outcome: 'DNB_H', tags: ['dnb_home', 'home_favored'] },
        { market: 'WIN_TO_NIL', side: 'HOME', probability: 0.35, description: '', outcome: 'WTN_H', tags: ['home_win_to_nil', 'home_clean_sheet'] },
      ]
      const result = matchNarrative(legs)
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Home Shutout')
    })

    it('should return null for unrecognized combination', () => {
      const legs: SGPLeg[] = [
        { market: 'ODD_EVEN', side: 'ODD', probability: 0.50, description: '', outcome: 'ODD', tags: ['odd_total'] },
        { market: 'TOTALS', side: 'OVER', probability: 0.55, description: '', outcome: 'OVER_1_5', tags: ['over_1_5'] },
      ]
      const result = matchNarrative(legs)
      expect(result).toBeNull()
    })

    it('should handle legs with multiple matching narratives (returns first match)', () => {
      const legs: SGPLeg[] = [
        { market: 'DNB', side: 'HOME', probability: 0.65, description: '', outcome: 'DNB_H', tags: ['dnb_home', 'home_favored'] },
        { market: 'TOTALS', side: 'OVER', probability: 0.60, description: '', outcome: 'OVER_2_5', tags: ['over_2_5', 'high_scoring'] },
        { market: 'WIN_TO_NIL', side: 'HOME', probability: 0.30, description: '', outcome: 'WTN_H', tags: ['home_win_to_nil', 'home_clean_sheet'] },
      ]
      // Should match Home Dominant first (checked before Home Shutout)
      const result = matchNarrative(legs)
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Home Dominant')
    })
  })

  // ─── Combined SGP Validation Logic ──────────────────────────────────

  describe('SGP Combination Validation', () => {
    it('should allow non-contradictory 2-leg combo', () => {
      const legs: SGPLeg[] = [
        { market: 'DNB', side: 'HOME', probability: 0.65, description: '', outcome: 'DNB_H', tags: ['dnb_home'] },
        { market: 'TOTALS', side: 'OVER', probability: 0.55, description: '', outcome: 'OVER_1_5', tags: ['over_1_5'] },
      ]
      const hasContra = hasContradiction(legs[0].tags, legs[1].tags)
      expect(hasContra).toBe(false)
    })

    it('should block contradictory 2-leg combo (Clean Sheet + BTTS Yes)', () => {
      const legs: SGPLeg[] = [
        { market: 'CLEAN_SHEET', side: 'HOME', probability: 0.40, description: '', outcome: 'CS_H', tags: ['home_clean_sheet'] },
        { market: 'BTTS', side: 'YES', probability: 0.55, description: '', outcome: 'BTTS_YES', tags: ['btts_yes'] },
      ]
      const hasContra = hasContradiction(legs[0].tags, legs[1].tags)
      expect(hasContra).toBe(true)
    })

    it('should validate all pairs in a 3-leg combo', () => {
      const legs: SGPLeg[] = [
        { market: 'DNB', side: 'HOME', probability: 0.65, description: '', outcome: 'DNB_H', tags: ['dnb_home', 'home_favored'] },
        { market: 'TOTALS', side: 'OVER', probability: 0.55, description: '', outcome: 'OVER_2_5', tags: ['over_2_5', 'high_scoring'] },
        { market: 'BTTS', side: 'YES', probability: 0.50, description: '', outcome: 'BTTS_YES', tags: ['btts_yes', 'home_scores', 'away_scores'] },
      ]
      // Check all pairs
      const contra01 = hasContradiction(legs[0].tags, legs[1].tags)
      const contra02 = hasContradiction(legs[0].tags, legs[2].tags)
      const contra12 = hasContradiction(legs[1].tags, legs[2].tags)

      expect(contra01).toBe(false) // DNB Home + Over 2.5: ok
      expect(contra02).toBe(false) // DNB Home + BTTS Yes: no tag contradiction (it's in areLegsCorrelated but not in SGP CONTRADICTIONS)
      expect(contra12).toBe(false) // Over 2.5 + BTTS Yes: no tag contradiction (they complement each other)
    })

    it('should block 3-leg combo where one pair is contradictory', () => {
      const legs: SGPLeg[] = [
        { market: 'TOTALS', side: 'UNDER', probability: 0.55, description: '', outcome: 'UNDER_0_5', tags: ['under_0_5', 'low_scoring'] },
        { market: 'DNB', side: 'HOME', probability: 0.65, description: '', outcome: 'DNB_H', tags: ['dnb_home'] },
        { market: 'BTTS', side: 'YES', probability: 0.50, description: '', outcome: 'BTTS_YES', tags: ['btts_yes'] },
      ]
      // under_0_5 + btts_yes → contradiction
      const contra02 = hasContradiction(legs[0].tags, legs[2].tags)
      expect(contra02).toBe(true)
    })

    it('should calculate combined probability correctly', () => {
      const probs = [0.65, 0.55, 0.50]
      const combined = probs.reduce((a, b) => a * b, 1)
      expect(combined).toBeCloseTo(0.17875, 3)
    })

    it('should calculate fair odds from combined probability', () => {
      const combinedProb = 0.25
      const fairOdds = 1 / combinedProb
      expect(fairOdds).toBe(4)
    })
  })

  // ─── Deduplication Logic ────────────────────────────────────────────

  describe('Deduplication', () => {
    it('should generate same combo key regardless of leg order', () => {
      const key1 = ['DNB_H', 'OVER_2_5'].sort().join('|')
      const key2 = ['OVER_2_5', 'DNB_H'].sort().join('|')
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different combos', () => {
      const key1 = ['DNB_H', 'OVER_2_5'].sort().join('|')
      const key2 = ['DNB_H', 'BTTS_YES'].sort().join('|')
      expect(key1).not.toBe(key2)
    })

    it('should generate unique keys for 3-leg combos', () => {
      const key1 = ['DNB_H', 'OVER_2_5', 'BTTS_YES'].sort().join('|')
      const key2 = ['BTTS_YES', 'DNB_H', 'OVER_2_5'].sort().join('|')
      const key3 = ['OVER_2_5', 'BTTS_YES', 'DNB_H'].sort().join('|')
      expect(key1).toBe(key2)
      expect(key2).toBe(key3)
    })

    it('should use Set for efficient deduplication', () => {
      const seen = new Set<string>()
      const combo1 = ['DNB_H', 'OVER_2_5'].sort().join('|')
      const combo2 = ['OVER_2_5', 'DNB_H'].sort().join('|')

      seen.add(combo1)
      expect(seen.has(combo2)).toBe(true) // Same combo, different order
    })
  })
})

