import {
  ACTIVE_MULTISPORT_KEYS,
  MULTISPORT,
  getMultisportBySlug,
  getMultisportName,
  isMultisportKey,
  multisportSeasonStatus,
} from '@/lib/multisport/sports'

describe('multisport sport registry', () => {
  it('concentrates on NBA + NFL', () => {
    expect(ACTIVE_MULTISPORT_KEYS).toEqual(['basketball_nba', 'americanfootball_nfl'])
    expect(MULTISPORT.basketball_ncaab.display).toBe(false)
    expect(MULTISPORT.icehockey_nhl.display).toBe(false)
  })

  it('keys match The Odds API sport_keys used by pipeline/config.py', () => {
    expect(isMultisportKey('americanfootball_nfl')).toBe(true)
    expect(isMultisportKey('soccer_epl')).toBe(false)
    expect(getMultisportName('americanfootball_nfl')).toBe('NFL')
    expect(getMultisportName('unknown_key')).toBe('unknown_key')
  })

  it('resolves hub slugs', () => {
    expect(getMultisportBySlug('nfl')?.key).toBe('americanfootball_nfl')
    expect(getMultisportBySlug('nba')?.key).toBe('basketball_nba')
    expect(getMultisportBySlug('mlb')).toBeNull()
  })

  it('season status follows the calendar month (UTC)', () => {
    const july = new Date(Date.UTC(2026, 6, 1))
    const november = new Date(Date.UTC(2026, 10, 7))
    expect(multisportSeasonStatus('americanfootball_nfl', july).status).toBe('off_season')
    expect(multisportSeasonStatus('americanfootball_nfl', november)).toEqual({ status: 'in_season', season_window: 'Sep–Feb' })
    expect(multisportSeasonStatus('basketball_nba', july).status).toBe('off_season')
    expect(multisportSeasonStatus('basketball_nba', november).status).toBe('in_season')
    expect(multisportSeasonStatus('not_a_sport', november).status).toBe('off_season')
  })
})
