jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: { multisportMatch: { findMany: jest.fn(), findFirst: jest.fn() } },
}))

import {
  SPORT_CONFIG,
  formatMultisportPick,
  formatMultisportPicksList,
  transformDBMatch,
} from '@/lib/whatsapp-multisport-picks'

const row = (overrides: Record<string, unknown> = {}) => ({
  eventId: 'evt-1',
  sport: 'americanfootball_nfl',
  homeTeam: 'Buffalo Bills',
  awayTeam: 'Miami Dolphins',
  league: 'NFL',
  commenceTime: new Date('2026-11-08T18:00:00Z'),
  odds: { consensus: { home_odds: 1.57, away_odds: 2.45, home_prob: 0.61, away_prob: 0.39, home_spread: -6.5, total_line: 47.5, n_bookmakers: 12 }, books: {}, book_count: 12 },
  model: null,
  ...overrides,
})

describe('WhatsApp multisport picks', () => {
  it('exposes NBA, NFL and NHL commands from the registry', () => {
    expect(Object.keys(SPORT_CONFIG)).toEqual(['nba', 'nfl', 'nhl'])
    expect(SPORT_CONFIG.nfl).toEqual({ key: 'americanfootball_nfl', name: 'NFL', emoji: '🏈' })
  })

  it('cold-start rows format as market line only, with no pick', () => {
    const pick = transformDBMatch(row())
    expect(pick.hasModel).toBe(false)
    const text = formatMultisportPick(pick)
    expect(text).toContain('Market line only — no NFL model pick yet')
    expect(text).toContain('Market: Buffalo Bills 61% | Miami Dolphins 39%')
    expect(text).not.toContain('Pick:')
    expect(text).toContain('Spread: Buffalo Bills -6.5')
    expect(text).toContain('ML: Buffalo Bills -175 | Miami Dolphins +145')
  })

  it('rows with a model show the pick and confidence', () => {
    const pick = transformDBMatch(row({ model: { predictions: { pick: 'A', confidence: 0.64, home_win: 0.36, away_win: 0.64, conviction_tier: 'strong' } } }))
    expect(pick.hasModel).toBe(true)
    const text = formatMultisportPick(pick)
    expect(text).toContain('Pick: Miami Dolphins')
    expect(text).toContain('Confidence: 64% | Strong')
    expect(text).toContain('Spread: Miami Dolphins +6.5')
  })

  it('list header explains the cold start once when no row has a model', () => {
    const text = formatMultisportPicksList([transformDBMatch(row()), transformDBMatch(row({ eventId: 'evt-2' }))], 'nfl', 4, false)
    expect(text).toContain("TODAY'S NFL PICKS")
    expect(text).toContain('Our NFL model is still training')
    expect(text).toContain('Send NBA | Send NHL')
  })
})
