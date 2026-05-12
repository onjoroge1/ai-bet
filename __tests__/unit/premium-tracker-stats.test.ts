/**
 * Unit tests for the pure aggregation helpers behind the Premium Pick
 * Tracker. These functions power the /performance audit page, the
 * tracker card on blog pages, and the admin dashboard tile. Bugs here
 * mean misleading numbers in the user-facing UI, so the math contract
 * is locked in here.
 */
import {
  aggregateStats,
  filterRowsByWindow,
  filterRowsByTier,
  filterRowsBySport,
  type TrackerPickRow,
} from '@/lib/premium-tracker/stats'

function row(overrides: Partial<TrackerPickRow> = {}): TrackerPickRow {
  return {
    oddsAtPublish: 2.0,
    stakeDollars: 100,
    netDollars: 0,
    netUnits: 0,
    result: 'pending',
    tier: 'premium',
    publishedAt: new Date('2026-05-01T12:00:00Z'),
    kickoffDate: new Date('2026-05-02T18:00:00Z'),
    sport: 'soccer',
    market: '1X2_HOME',
    ...overrides,
  }
}

describe('aggregateStats — record math', () => {
  it('returns zero record on empty input', () => {
    const s = aggregateStats([])
    expect(s.record).toEqual({ wins: 0, losses: 0, pushes: 0, voids: 0, pending: 0 })
    expect(s.picksCount).toBe(0)
    expect(s.settledCount).toBe(0)
  })

  it('counts each result category independently', () => {
    const s = aggregateStats([
      row({ result: 'win', oddsAtPublish: 2.0, netDollars: 100, netUnits: 1 }),
      row({ result: 'win', oddsAtPublish: 2.0, netDollars: 100, netUnits: 1 }),
      row({ result: 'loss', oddsAtPublish: 1.9, netDollars: -100, netUnits: -1 }),
      row({ result: 'push' }),
      row({ result: 'void' }),
      row({ result: 'pending' }),
      row({ result: 'pending' }),
    ])
    expect(s.record).toEqual({ wins: 2, losses: 1, pushes: 1, voids: 1, pending: 2 })
    expect(s.picksCount).toBe(7)
    expect(s.settledCount).toBe(5)
  })
})

describe('aggregateStats — ROI / net math', () => {
  it('computes ROI from wins + losses only (excludes pushes/voids/pending)', () => {
    const s = aggregateStats([
      row({ result: 'win', oddsAtPublish: 2.0, netDollars: 100, netUnits: 1.0 }),
      row({ result: 'loss', oddsAtPublish: 1.85, netDollars: -100, netUnits: -1.0 }),
      row({ result: 'push' }),                  // ignored in stake/ROI
      row({ result: 'void' }),                  // ignored
      row({ result: 'pending' }),               // ignored
    ])
    expect(s.totalStakedDollars).toBe(200)     // 2 stakes × $100
    expect(s.netDollars).toBe(0)               // +100 -100
    expect(s.netUnits).toBe(0)
    expect(s.roiPct).toBe(0)
  })

  it('positive ROI scenario', () => {
    const s = aggregateStats([
      row({ result: 'win', oddsAtPublish: 2.5, netDollars: 150, netUnits: 1.5 }),
      row({ result: 'win', oddsAtPublish: 2.0, netDollars: 100, netUnits: 1 }),
      row({ result: 'loss', oddsAtPublish: 1.9, netDollars: -100, netUnits: -1 }),
    ])
    expect(s.netDollars).toBe(150)             // +150 +100 -100
    expect(s.netUnits).toBe(1.5)
    expect(s.totalStakedDollars).toBe(300)
    expect(s.roiPct).toBe(50)                  // 150/300 * 100
  })

  it('negative ROI scenario', () => {
    const s = aggregateStats([
      row({ result: 'loss', oddsAtPublish: 1.5, netDollars: -100, netUnits: -1 }),
      row({ result: 'loss', oddsAtPublish: 1.7, netDollars: -100, netUnits: -1 }),
      row({ result: 'win', oddsAtPublish: 1.6, netDollars: 60, netUnits: 0.6 }),
    ])
    expect(s.netDollars).toBe(-140)
    expect(s.totalStakedDollars).toBe(300)
    expect(s.roiPct).toBe(-46.67)              // 2 decimal places
  })

  it('returns 0 ROI when there are no settled wins/losses', () => {
    const s = aggregateStats([
      row({ result: 'pending' }),
      row({ result: 'push' }),
    ])
    expect(s.roiPct).toBe(0)
    expect(s.netDollars).toBe(0)
    expect(s.totalStakedDollars).toBe(0)
  })
})

describe('aggregateStats — hit rate', () => {
  it('hit rate excludes pushes / voids', () => {
    const s = aggregateStats([
      row({ result: 'win' }),
      row({ result: 'win' }),
      row({ result: 'loss' }),
      row({ result: 'push' }),
      row({ result: 'void' }),
    ])
    expect(s.hitRatePct).toBe(66.67)           // 2/3
  })

  it('returns 0 hit rate when nothing has been settled', () => {
    const s = aggregateStats([row({ result: 'pending' })])
    expect(s.hitRatePct).toBe(0)
  })
})

describe('aggregateStats — avg odds', () => {
  it('averages odds across win + loss only (ignores pushes/voids/pending)', () => {
    const s = aggregateStats([
      row({ result: 'win', oddsAtPublish: 2.0 }),
      row({ result: 'loss', oddsAtPublish: 3.0 }),
      row({ result: 'push', oddsAtPublish: 5.0 }),     // ignored
      row({ result: 'pending', oddsAtPublish: 5.0 }),  // ignored
    ])
    expect(s.avgOdds).toBe(2.5)
  })

  it('avg odds is 0 with no settled rows', () => {
    expect(aggregateStats([row({ result: 'pending' })]).avgOdds).toBe(0)
  })
})

describe('aggregateStats — window dates', () => {
  it('captures earliest and latest publishedAt', () => {
    const s = aggregateStats([
      row({ publishedAt: new Date('2026-05-01T00:00:00Z') }),
      row({ publishedAt: new Date('2026-05-10T00:00:00Z') }),
      row({ publishedAt: new Date('2026-05-05T00:00:00Z') }),
    ])
    expect(s.windowStart?.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(s.windowEnd?.toISOString()).toBe('2026-05-10T00:00:00.000Z')
  })

  it('returns null window on empty input', () => {
    const s = aggregateStats([])
    expect(s.windowStart).toBeNull()
    expect(s.windowEnd).toBeNull()
  })
})

describe('filterRowsByWindow', () => {
  const now = new Date('2026-05-12T00:00:00Z')

  it('returns rows within the window', () => {
    const rows = [
      row({ publishedAt: new Date('2026-05-11T00:00:00Z') }),       // 1d ago
      row({ publishedAt: new Date('2026-04-20T00:00:00Z') }),       // ~22d ago
      row({ publishedAt: new Date('2026-03-01T00:00:00Z') }),       // ~72d ago
    ]
    expect(filterRowsByWindow(rows, 7, now)).toHaveLength(1)        // last 7d
    expect(filterRowsByWindow(rows, 30, now)).toHaveLength(2)       // last 30d
    expect(filterRowsByWindow(rows, 90, now)).toHaveLength(3)       // last 90d
  })

  it('windowDays <= 0 returns all rows untouched', () => {
    const rows = [row(), row(), row()]
    expect(filterRowsByWindow(rows, 0, now)).toHaveLength(3)
    expect(filterRowsByWindow(rows, -5, now)).toHaveLength(3)
  })

  it('rows with no publishedAt are filtered out', () => {
    const rows = [row({ publishedAt: undefined }), row({ publishedAt: new Date('2026-05-11T00:00:00Z') })]
    expect(filterRowsByWindow(rows, 7, now)).toHaveLength(1)
  })
})

describe('filterRowsByTier', () => {
  it('filters to one tier', () => {
    const rows = [
      row({ tier: 'premium' }),
      row({ tier: 'strong' }),
      row({ tier: 'premium' }),
    ]
    expect(filterRowsByTier(rows, 'premium')).toHaveLength(2)
    expect(filterRowsByTier(rows, 'strong')).toHaveLength(1)
  })

  it("'all' or empty returns everything", () => {
    const rows = [row({ tier: 'premium' }), row({ tier: 'strong' })]
    expect(filterRowsByTier(rows, 'all')).toHaveLength(2)
    expect(filterRowsByTier(rows)).toHaveLength(2)
    expect(filterRowsByTier(rows, '')).toHaveLength(2)
  })
})

describe('filterRowsBySport', () => {
  it('filters to one sport', () => {
    const rows = [
      row({ sport: 'soccer' }),
      row({ sport: 'nba' }),
      row({ sport: 'soccer' }),
    ]
    expect(filterRowsBySport(rows, 'soccer')).toHaveLength(2)
    expect(filterRowsBySport(rows, 'nba')).toHaveLength(1)
  })

  it("'all' or empty returns everything", () => {
    const rows = [row({ sport: 'soccer' }), row({ sport: 'nba' })]
    expect(filterRowsBySport(rows, 'all')).toHaveLength(2)
    expect(filterRowsBySport(rows)).toHaveLength(2)
  })
})

describe('aggregateStats — premium-only realistic scenario', () => {
  // Pre-flight (Day 1) showed premium tier: 14W-3L on n=17 with avg odds 1.77
  // and ROI +12.92%. This is the kind of headline we'd want to render.
  it('reproduces the premium-tier shape', () => {
    const wins: TrackerPickRow[] = Array.from({ length: 14 }, () =>
      row({ result: 'win', oddsAtPublish: 1.77, netDollars: 77, netUnits: 0.77, tier: 'premium' }))
    const losses: TrackerPickRow[] = Array.from({ length: 3 }, () =>
      row({ result: 'loss', oddsAtPublish: 1.77, netDollars: -100, netUnits: -1, tier: 'premium' }))
    const s = aggregateStats([...wins, ...losses])

    expect(s.record).toEqual({ wins: 14, losses: 3, pushes: 0, voids: 0, pending: 0 })
    expect(s.totalStakedDollars).toBe(1700)
    expect(s.netDollars).toBe(778)            // 14×77 - 3×100 = 1078 - 300 = 778
    expect(s.roiPct).toBeCloseTo(45.76, 1)    // 778/1700 ≈ 45.8%
    expect(s.hitRatePct).toBeCloseTo(82.35, 1)// 14/17
    expect(s.avgOdds).toBe(1.77)
  })
})
