/**
 * Unit tests for the team-stats rollup helpers. These functions back the
 * nightly team-stats cron and feed the public /team/[slug]/predictions
 * page, so the contract is locked in here.
 */
import {
  slugify, makeTeamSlug, parseTeamSlug,
} from '@/lib/team-stats/slug'
import {
  teamSideIn,
  teamResult,
  matchScore,
  encodeForm,
  aggregateGoalStats,
  modelAccuracyForTeam,
  recommendedModelForTeam,
  buildH2HGrid,
  type TeamMatchRow,
} from '@/lib/team-stats/rollup'

// ─── Slug ───────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases, collapses non-alphanum into single dashes', () => {
    expect(slugify('Arsenal FC')).toBe('arsenal-fc')
    expect(slugify('Real Madrid C.F.')).toBe('real-madrid-c-f')
    expect(slugify(' Bayern   München ')).toBe('bayern-munchen')
  })
  it('strips diacritics', () => {
    expect(slugify('Atlético')).toBe('atletico')
    expect(slugify('Borussia Mönchengladbach')).toBe('borussia-monchengladbach')
  })
  it('returns empty for falsy input', () => {
    expect(slugify('')).toBe('')
  })
})

describe('makeTeamSlug + parseTeamSlug', () => {
  it('round-trips cleanly', () => {
    const slug = makeTeamSlug('Arsenal FC', '33')
    expect(slug).toBe('arsenal-fc-33')
    expect(parseTeamSlug(slug)).toEqual({ baseSlug: 'arsenal-fc', externalTeamId: '33' })
  })
  it('handles numeric and alphanumeric ids', () => {
    expect(makeTeamSlug('FC Andorra', 'abc123')).toBe('fc-andorra-abc123')
  })
  it('parseTeamSlug recovers the trailing id', () => {
    expect(parseTeamSlug('bayern-munchen-157')?.externalTeamId).toBe('157')
    expect(parseTeamSlug('borussia-monchengladbach-163')?.externalTeamId).toBe('163')
  })
  it('returns null for empty slug', () => {
    expect(parseTeamSlug('')).toBeNull()
  })
})

// ─── Match helpers ──────────────────────────────────────────────────

function row(overrides: Partial<TeamMatchRow> = {}): TeamMatchRow {
  return {
    matchId: 'm1',
    league: 'Premier League',
    kickoffDate: new Date('2026-04-01T15:00:00Z'),
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    homeTeamId: '33',
    awayTeamId: '49',
    finalResult: { score: { home: 2, away: 1 }, outcome: 'home' },
    v1Model: { pick: 'home', confidence: 0.55 },
    v3Model: { pick: 'home', confidence: 0.62 },
    ...overrides,
  }
}

describe('teamSideIn', () => {
  it('identifies which side', () => {
    const m = row()
    expect(teamSideIn(m, '33')).toBe('home')
    expect(teamSideIn(m, '49')).toBe('away')
    expect(teamSideIn(m, '99')).toBeNull()
  })
})

describe('teamResult', () => {
  it('returns W/D/L from team perspective', () => {
    const m = row({ finalResult: { score: { home: 2, away: 1 }, outcome: 'home' } })
    expect(teamResult(m, 'home')).toBe('W')
    expect(teamResult(m, 'away')).toBe('L')

    const draw = row({ finalResult: { score: { home: 1, away: 1 }, outcome: 'draw' } })
    expect(teamResult(draw, 'home')).toBe('D')
    expect(teamResult(draw, 'away')).toBe('D')
  })
  it('returns null when outcome cannot be parsed', () => {
    expect(teamResult(row({ finalResult: null }), 'home')).toBeNull()
  })
})

describe('matchScore', () => {
  it('extracts home/away score', () => {
    expect(matchScore(row())).toEqual({ home: 2, away: 1 })
  })
  it('returns null when score missing', () => {
    expect(matchScore(row({ finalResult: { outcome: 'home' } }))).toBeNull()
    expect(matchScore(row({ finalResult: null }))).toBeNull()
  })
})

// ─── encodeForm ─────────────────────────────────────────────────────

describe('encodeForm', () => {
  it('encodes last 10 matches with most-recent first', () => {
    const matches = [
      row({ matchId: '1', kickoffDate: new Date('2026-03-01'), finalResult: { score: { home: 2, away: 0 }, outcome: 'home' } }),
      row({ matchId: '2', kickoffDate: new Date('2026-03-08'), finalResult: { score: { home: 1, away: 1 }, outcome: 'draw' } }),
      row({ matchId: '3', kickoffDate: new Date('2026-03-15'), finalResult: { score: { home: 0, away: 2 }, outcome: 'away' } }),
    ]
    // Home team perspective: W, D, L (most-recent first → L D W)
    expect(encodeForm(matches, '33')).toBe('LDW')
  })

  it('caps at n matches', () => {
    const matches = Array.from({ length: 15 }, (_, i) => row({
      matchId: String(i),
      kickoffDate: new Date(2026, 0, i + 1),
      finalResult: { score: { home: 1, away: 0 }, outcome: 'home' },
    }))
    expect(encodeForm(matches, '33').length).toBe(10)
    expect(encodeForm(matches, '33', 5).length).toBe(5)
  })

  it('skips matches where the team did not play', () => {
    const matches = [
      row({ homeTeamId: '99', awayTeamId: '88' }),  // team not present
      row({ kickoffDate: new Date('2026-03-01'), finalResult: { score: { home: 2, away: 0 }, outcome: 'home' } }),
    ]
    expect(encodeForm(matches, '33')).toBe('W')
  })
})

// ─── aggregateGoalStats ────────────────────────────────────────────

describe('aggregateGoalStats', () => {
  it('rolls up the home perspective', () => {
    const matches = [
      row({ finalResult: { score: { home: 3, away: 0 }, outcome: 'home' }, homeTeamId: '33', awayTeamId: '49' }),
      row({ finalResult: { score: { home: 1, away: 1 }, outcome: 'draw' }, homeTeamId: '33', awayTeamId: '50' }),
      row({ finalResult: { score: { home: 0, away: 2 }, outcome: 'away' }, homeTeamId: '49', awayTeamId: '33' }), // team is away
    ]
    const stats = aggregateGoalStats(matches, '33')
    expect(stats.matchesPlayed).toBe(3)
    expect(stats.wins).toBe(2)        // 3-0 home win + 2-0 away win (team is away in match 3)
    expect(stats.draws).toBe(1)       // 1-1
    expect(stats.losses).toBe(0)
    expect(stats.goalsFor).toBe(3 + 1 + 2)   // 6 — team scored 2 as away in match 3
    expect(stats.goalsAgainst).toBe(0 + 1 + 0) // 1
    expect(stats.bttsCount).toBe(1)   // only 1-1
    expect(stats.over25Count).toBe(1) // only 3-0
    expect(stats.homeGoalsFor).toBe(2)  // (3 + 1) / 2
    expect(stats.awayGoalsFor).toBe(2)  // 2 / 1
  })

  it('returns zeros for empty input', () => {
    const stats = aggregateGoalStats([], '33')
    expect(stats.matchesPlayed).toBe(0)
    expect(stats.homeGoalsFor).toBe(0)
    expect(stats.awayGoalsFor).toBe(0)
  })
})

// ─── modelAccuracyForTeam ───────────────────────────────────────────

describe('modelAccuracyForTeam', () => {
  function mk(matchId: string, date: Date, modelPick: string, outcome: string) {
    return row({
      matchId,
      kickoffDate: date,
      v1Model: { pick: modelPick, confidence: 0.6 },
      v3Model: { pick: modelPick, confidence: 0.65 },
      finalResult: { outcome, score: { home: outcome === 'home' ? 2 : 0, away: outcome === 'away' ? 2 : 0 } },
    })
  }

  it('computes accuracy and sample size', () => {
    const matches = [
      mk('1', new Date('2026-03-01'), 'home', 'home'),  // hit
      mk('2', new Date('2026-03-08'), 'home', 'away'),  // miss
      mk('3', new Date('2026-03-15'), 'home', 'home'),  // hit
    ]
    const result = modelAccuracyForTeam(matches, '33', 'v1')
    expect(result).toEqual({ accuracy: 0.6667, sampleN: 3 })
  })

  it('returns null when there are no usable matches', () => {
    expect(modelAccuracyForTeam([], '33', 'v1')).toBeNull()
  })

  it('respects windowSize (most-recent first)', () => {
    const matches = Array.from({ length: 35 }, (_, i) => mk(String(i), new Date(2026, 0, i + 1), 'home', 'home'))
    const result = modelAccuracyForTeam(matches, '33', 'v1', 30)
    expect(result?.sampleN).toBe(30)
  })
})

// ─── recommendedModelForTeam ────────────────────────────────────────

describe('recommendedModelForTeam', () => {
  it('returns v3 when ahead by >=5pp and both have sample', () => {
    const v1 = { accuracy: 0.55, sampleN: 20 }
    const v3 = { accuracy: 0.62, sampleN: 20 }
    expect(recommendedModelForTeam(v1, v3)).toBe('v3')
  })
  it('returns v1 when ahead by >=5pp', () => {
    expect(recommendedModelForTeam({ accuracy: 0.65, sampleN: 20 }, { accuracy: 0.55, sampleN: 20 })).toBe('v1')
  })
  it('returns null when gap < 5pp', () => {
    expect(recommendedModelForTeam({ accuracy: 0.60, sampleN: 20 }, { accuracy: 0.62, sampleN: 20 })).toBeNull()
  })
  it('returns null when neither model has sufficient sample', () => {
    expect(recommendedModelForTeam({ accuracy: 0.8, sampleN: 5 }, { accuracy: 0.5, sampleN: 5 })).toBeNull()
  })
  it('falls back to the model with sufficient sample', () => {
    expect(recommendedModelForTeam(null, { accuracy: 0.6, sampleN: 20 })).toBe('v3')
    expect(recommendedModelForTeam({ accuracy: 0.6, sampleN: 20 }, null)).toBe('v1')
  })
})

// ─── buildH2HGrid ───────────────────────────────────────────────────

describe('buildH2HGrid', () => {
  function vs(opponent: string, oppId: string, score: { home: number; away: number }, asHome = true) {
    return row({
      kickoffDate: new Date(`2026-0${Math.floor(Math.random() * 4) + 1}-01`),
      homeTeam: asHome ? 'Arsenal' : opponent,
      awayTeam: asHome ? opponent : 'Arsenal',
      homeTeamId: asHome ? '33' : oppId,
      awayTeamId: asHome ? oppId : '33',
      finalResult: {
        score,
        outcome: score.home > score.away ? 'home' : score.away > score.home ? 'away' : 'draw',
      },
    })
  }

  it('groups by opponent and ranks by frequency', () => {
    const matches = [
      vs('Chelsea', '49', { home: 2, away: 1 }),
      vs('Chelsea', '49', { home: 1, away: 0 }),
      vs('Chelsea', '49', { home: 0, away: 1 }),
      vs('Tottenham', '47', { home: 3, away: 1 }),
      vs('Liverpool', '40', { home: 0, away: 2 }),
    ]
    const grid = buildH2HGrid(matches, '33', 5)
    expect(grid).toHaveLength(3)
    expect(grid[0].opponent).toBe('Chelsea')
    expect(grid[0].matchesPlayed).toBe(3)
  })

  it('caps at topN', () => {
    const matches: TeamMatchRow[] = []
    for (let i = 0; i < 10; i++) {
      matches.push(vs(`Team${i}`, String(i + 50), { home: 1, away: 0 }))
    }
    const grid = buildH2HGrid(matches, '33', 5)
    expect(grid).toHaveLength(5)
  })

  it('includes record breakdown and lastResult', () => {
    const matches = [
      vs('Chelsea', '49', { home: 2, away: 1 }),  // W
      vs('Chelsea', '49', { home: 0, away: 2 }),  // L
      vs('Chelsea', '49', { home: 1, away: 1 }),  // D
    ]
    const [chelsea] = buildH2HGrid(matches, '33', 5)
    expect(chelsea.wins).toBe(1)
    expect(chelsea.draws).toBe(1)
    expect(chelsea.losses).toBe(1)
    expect(chelsea.lastResult).toMatch(/^[WDL] \d+-\d+$/)
  })

  it('handles team playing as the away side', () => {
    const matches = [vs('Chelsea', '49', { home: 0, away: 2 }, false)]
    const [chelsea] = buildH2HGrid(matches, '33', 5)
    expect(chelsea.wins).toBe(1)
    expect(chelsea.lastResult).toMatch(/^W 2-0$/)
  })
})
