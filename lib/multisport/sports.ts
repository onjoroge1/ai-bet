/**
 * Single source of truth for the 2-way US sports the app serves.
 *
 * Keys are The Odds API sport_keys and match `MultisportMatch.sport` rows
 * written by pipeline/ (see pipeline/snapbet_pipeline/config.py — keep the
 * two lists in step). `display: true` sports are the pivot (NBA + NFL);
 * NCAAB / NHL remain defined so historical rows and old links keep working.
 */

export type MultisportKey =
  | 'basketball_nba'
  | 'americanfootball_nfl'
  | 'basketball_ncaab'
  | 'icehockey_nhl'

export interface MultisportDef {
  key: MultisportKey
  name: string              // "NBA"
  longName: string          // "NBA Basketball"
  slug: string              // URL prefix for hubs: /nba, /nfl
  emoji: string
  family: 'basketball' | 'american-football' | 'hockey'
  /** Calendar months (1-12) in which the league is normally active. */
  activeMonths: number[]
  accent: { text: string; bg: string; border: string; borderL: string }
  /** Shown in selectors / homepage tabs. */
  display: boolean
}

export const MULTISPORT: Record<MultisportKey, MultisportDef> = {
  basketball_nba: {
    key: 'basketball_nba', name: 'NBA', longName: 'NBA Basketball', slug: 'nba', emoji: '🏀',
    family: 'basketball', activeMonths: [10, 11, 12, 1, 2, 3, 4, 5, 6],
    accent: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', borderL: 'border-l-orange-500' },
    display: true,
  },
  americanfootball_nfl: {
    key: 'americanfootball_nfl', name: 'NFL', longName: 'NFL Football', slug: 'nfl', emoji: '🏈',
    family: 'american-football', activeMonths: [9, 10, 11, 12, 1, 2],
    accent: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', borderL: 'border-l-amber-500' },
    display: true,
  },
  basketball_ncaab: {
    key: 'basketball_ncaab', name: 'NCAAB', longName: 'NCAA Basketball', slug: 'ncaab', emoji: '🏀',
    family: 'basketball', activeMonths: [11, 12, 1, 2, 3, 4],
    accent: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', borderL: 'border-l-purple-500' },
    display: false,
  },
  icehockey_nhl: {
    key: 'icehockey_nhl', name: 'NHL', longName: 'NHL Hockey', slug: 'nhl', emoji: '🏒',
    family: 'hockey', activeMonths: [10, 11, 12, 1, 2, 3, 4, 5, 6],
    accent: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', borderL: 'border-l-cyan-500' },
    display: false,
  },
}

export const ALL_MULTISPORT_KEYS = Object.keys(MULTISPORT) as MultisportKey[]

/** The sports the product is concentrating on right now (PR-2 scope). */
export const ACTIVE_MULTISPORT_KEYS: MultisportKey[] = ALL_MULTISPORT_KEYS.filter(k => MULTISPORT[k].display)

export function isMultisportKey(key: unknown): key is MultisportKey {
  return typeof key === 'string' && key in MULTISPORT
}

export function getMultisportName(key: string): string {
  return isMultisportKey(key) ? MULTISPORT[key].name : key
}

export function getMultisportBySlug(slug: string): MultisportDef | null {
  return ALL_MULTISPORT_KEYS.map(k => MULTISPORT[k]).find(s => s.slug === slug) ?? null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface SeasonStatus {
  status: 'in_season' | 'off_season'
  season_window: string   // "Oct–Jun"
}

/** Calendar-based season status (the pipeline uses the same month gates). */
export function multisportSeasonStatus(key: string, now: Date = new Date()): SeasonStatus {
  if (!isMultisportKey(key)) return { status: 'off_season', season_window: '' }
  const months = MULTISPORT[key].activeMonths
  const inSeason = months.includes(now.getUTCMonth() + 1)
  const first = months[0]
  const last = months[months.length - 1]
  return { status: inSeason ? 'in_season' : 'off_season', season_window: `${MONTHS[first - 1]}–${MONTHS[last - 1]}` }
}
