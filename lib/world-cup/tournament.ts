/**
 * FIFA World Cup 2026 — tournament structure.
 *
 * 48 teams · 12 groups of 4 · top 2 + 8 best 3rd-placed advance → 32 in
 * the knockout round. Host: USA / Canada / Mexico. Opens 11 June 2026,
 * Final 19 July 2026.
 *
 * ────────────────────────────────────────────────────────────────────
 * GROUPS below is the OFFICIAL final draw (Washington DC, 5 Dec 2025),
 * verified 2026-06-12. Team `name` strings match the upstream odds feed
 * exactly so fixtures resolve into groups. Pages render from this
 * registry, so corrections propagate automatically.
 * ────────────────────────────────────────────────────────────────────
 */

export interface WCTeam {
  slug: string                  // 'argentina', 'usa', 'brazil', etc.
  name: string                  // 'Argentina'
  /** ISO 3-letter code so we can hit a flag emoji lookup or a CDN logo. */
  iso3: string
  flagEmoji: string
  confederation: 'CONMEBOL' | 'UEFA' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC'
  /** Group letter A-L. */
  group: string
  /** Optional: most-recent FIFA ranking. Updated by an admin task or left null. */
  fifaRank?: number | null
}

export interface WCGroup {
  letter: string                // 'A' through 'L'
  teams: WCTeam[]               // exactly 4
}

// ─── Tournament metadata ────────────────────────────────────────────

export const WC_METADATA = {
  edition: 'FIFA World Cup 2026',
  host: 'USA · Canada · Mexico',
  opensISO: '2026-06-11',
  finalISO: '2026-07-19',
  totalTeams: 48,
  totalGroups: 12,
  /** Strings to match against MarketMatch.league for tournament fixtures.
   *  Upstream may label the league differently across feeds. */
  marketMatchLeagueAliases: [
    'FIFA World Cup',
    'World Cup',
    'World Cup 2026',
    'FIFA World Cup 2026',
  ],
}

// ─── OFFICIAL FIFA DRAW — final draw, Washington DC, 5 Dec 2025 ─────
// Verified 2026-06-12 against Al Jazeera + Sky Sports + FIFA. Team `name`
// fields match the upstream odds-feed strings EXACTLY (e.g. 'USA', not
// 'United States'; 'Türkiye'; 'Bosnia & Herzegovina'; 'Cape Verde Islands';
// 'Congo DR') so getTeamByName() resolves MarketMatch fixtures into groups.
// Slug = SEO-friendly kebab-case (URL); independent of the feed name.

export const GROUPS: WCGroup[] = [
  {
    letter: 'A',
    teams: [
      { slug: 'mexico',       name: 'Mexico',                iso3: 'MEX', flagEmoji: '🇲🇽', confederation: 'CONCACAF', group: 'A' },
      { slug: 'south-africa', name: 'South Africa',          iso3: 'ZAF', flagEmoji: '🇿🇦', confederation: 'CAF',      group: 'A' },
      { slug: 'south-korea',  name: 'South Korea',           iso3: 'KOR', flagEmoji: '🇰🇷', confederation: 'AFC',      group: 'A' },
      { slug: 'czechia',      name: 'Czechia',               iso3: 'CZE', flagEmoji: '🇨🇿', confederation: 'UEFA',     group: 'A' },
    ],
  },
  {
    letter: 'B',
    teams: [
      { slug: 'canada',               name: 'Canada',                iso3: 'CAN', flagEmoji: '🇨🇦', confederation: 'CONCACAF', group: 'B' },
      { slug: 'bosnia-herzegovina',   name: 'Bosnia & Herzegovina',  iso3: 'BIH', flagEmoji: '🇧🇦', confederation: 'UEFA',     group: 'B' },
      { slug: 'qatar',                name: 'Qatar',                 iso3: 'QAT', flagEmoji: '🇶🇦', confederation: 'AFC',      group: 'B' },
      { slug: 'switzerland',          name: 'Switzerland',           iso3: 'CHE', flagEmoji: '🇨🇭', confederation: 'UEFA',     group: 'B' },
    ],
  },
  {
    letter: 'C',
    teams: [
      { slug: 'brazil',   name: 'Brazil',   iso3: 'BRA', flagEmoji: '🇧🇷', confederation: 'CONMEBOL', group: 'C' },
      { slug: 'morocco',  name: 'Morocco',  iso3: 'MAR', flagEmoji: '🇲🇦', confederation: 'CAF',      group: 'C' },
      { slug: 'haiti',    name: 'Haiti',    iso3: 'HTI', flagEmoji: '🇭🇹', confederation: 'CONCACAF', group: 'C' },
      { slug: 'scotland', name: 'Scotland', iso3: 'SCO', flagEmoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA',     group: 'C' },
    ],
  },
  {
    letter: 'D',
    teams: [
      { slug: 'usa',       name: 'USA',       iso3: 'USA', flagEmoji: '🇺🇸', confederation: 'CONCACAF', group: 'D' },
      { slug: 'paraguay',  name: 'Paraguay',  iso3: 'PRY', flagEmoji: '🇵🇾', confederation: 'CONMEBOL', group: 'D' },
      { slug: 'australia', name: 'Australia', iso3: 'AUS', flagEmoji: '🇦🇺', confederation: 'AFC',      group: 'D' },
      { slug: 'turkiye',   name: 'Türkiye',   iso3: 'TUR', flagEmoji: '🇹🇷', confederation: 'UEFA',     group: 'D' },
    ],
  },
  {
    letter: 'E',
    teams: [
      { slug: 'germany',     name: 'Germany',     iso3: 'DEU', flagEmoji: '🇩🇪', confederation: 'UEFA',     group: 'E' },
      { slug: 'curacao',     name: 'Curaçao',     iso3: 'CUW', flagEmoji: '🇨🇼', confederation: 'CONCACAF', group: 'E' },
      { slug: 'ivory-coast', name: 'Ivory Coast', iso3: 'CIV', flagEmoji: '🇨🇮', confederation: 'CAF',      group: 'E' },
      { slug: 'ecuador',     name: 'Ecuador',     iso3: 'ECU', flagEmoji: '🇪🇨', confederation: 'CONMEBOL', group: 'E' },
    ],
  },
  {
    letter: 'F',
    teams: [
      { slug: 'netherlands', name: 'Netherlands', iso3: 'NLD', flagEmoji: '🇳🇱', confederation: 'UEFA', group: 'F' },
      { slug: 'japan',       name: 'Japan',       iso3: 'JPN', flagEmoji: '🇯🇵', confederation: 'AFC',  group: 'F' },
      { slug: 'sweden',      name: 'Sweden',      iso3: 'SWE', flagEmoji: '🇸🇪', confederation: 'UEFA', group: 'F' },
      { slug: 'tunisia',     name: 'Tunisia',     iso3: 'TUN', flagEmoji: '🇹🇳', confederation: 'CAF',  group: 'F' },
    ],
  },
  {
    letter: 'G',
    teams: [
      { slug: 'belgium',     name: 'Belgium',     iso3: 'BEL', flagEmoji: '🇧🇪', confederation: 'UEFA', group: 'G' },
      { slug: 'egypt',       name: 'Egypt',       iso3: 'EGY', flagEmoji: '🇪🇬', confederation: 'CAF',  group: 'G' },
      { slug: 'iran',        name: 'Iran',        iso3: 'IRN', flagEmoji: '🇮🇷', confederation: 'AFC',  group: 'G' },
      { slug: 'new-zealand', name: 'New Zealand', iso3: 'NZL', flagEmoji: '🇳🇿', confederation: 'OFC',  group: 'G' },
    ],
  },
  {
    letter: 'H',
    teams: [
      { slug: 'spain',        name: 'Spain',                iso3: 'ESP', flagEmoji: '🇪🇸', confederation: 'UEFA',     group: 'H' },
      { slug: 'cape-verde',   name: 'Cape Verde Islands',   iso3: 'CPV', flagEmoji: '🇨🇻', confederation: 'CAF',      group: 'H' },
      { slug: 'saudi-arabia', name: 'Saudi Arabia',         iso3: 'SAU', flagEmoji: '🇸🇦', confederation: 'AFC',      group: 'H' },
      { slug: 'uruguay',      name: 'Uruguay',              iso3: 'URY', flagEmoji: '🇺🇾', confederation: 'CONMEBOL', group: 'H' },
    ],
  },
  {
    letter: 'I',
    teams: [
      { slug: 'france',  name: 'France',  iso3: 'FRA', flagEmoji: '🇫🇷', confederation: 'UEFA', group: 'I' },
      { slug: 'senegal', name: 'Senegal', iso3: 'SEN', flagEmoji: '🇸🇳', confederation: 'CAF',  group: 'I' },
      { slug: 'iraq',    name: 'Iraq',    iso3: 'IRQ', flagEmoji: '🇮🇶', confederation: 'AFC',  group: 'I' },
      { slug: 'norway',  name: 'Norway',  iso3: 'NOR', flagEmoji: '🇳🇴', confederation: 'UEFA', group: 'I' },
    ],
  },
  {
    letter: 'J',
    teams: [
      { slug: 'argentina', name: 'Argentina', iso3: 'ARG', flagEmoji: '🇦🇷', confederation: 'CONMEBOL', group: 'J' },
      { slug: 'algeria',   name: 'Algeria',   iso3: 'DZA', flagEmoji: '🇩🇿', confederation: 'CAF',      group: 'J' },
      { slug: 'austria',   name: 'Austria',   iso3: 'AUT', flagEmoji: '🇦🇹', confederation: 'UEFA',     group: 'J' },
      { slug: 'jordan',    name: 'Jordan',    iso3: 'JOR', flagEmoji: '🇯🇴', confederation: 'AFC',      group: 'J' },
    ],
  },
  {
    letter: 'K',
    teams: [
      { slug: 'portugal',   name: 'Portugal',   iso3: 'PRT', flagEmoji: '🇵🇹', confederation: 'UEFA',     group: 'K' },
      { slug: 'congo-dr',   name: 'Congo DR',   iso3: 'COD', flagEmoji: '🇨🇩', confederation: 'CAF',      group: 'K' },
      { slug: 'uzbekistan', name: 'Uzbekistan', iso3: 'UZB', flagEmoji: '🇺🇿', confederation: 'AFC',      group: 'K' },
      { slug: 'colombia',   name: 'Colombia',   iso3: 'COL', flagEmoji: '🇨🇴', confederation: 'CONMEBOL', group: 'K' },
    ],
  },
  {
    letter: 'L',
    teams: [
      { slug: 'england', name: 'England', iso3: 'ENG', flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA',     group: 'L' },
      { slug: 'croatia', name: 'Croatia', iso3: 'HRV', flagEmoji: '🇭🇷', confederation: 'UEFA',     group: 'L' },
      { slug: 'ghana',   name: 'Ghana',   iso3: 'GHA', flagEmoji: '🇬🇭', confederation: 'CAF',      group: 'L' },
      { slug: 'panama',  name: 'Panama',  iso3: 'PAN', flagEmoji: '🇵🇦', confederation: 'CONCACAF', group: 'L' },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────────────

const TEAM_BY_SLUG = new Map<string, WCTeam>()
const TEAM_BY_NAME = new Map<string, WCTeam>()
const GROUP_BY_LETTER = new Map<string, WCGroup>()
for (const g of GROUPS) {
  GROUP_BY_LETTER.set(g.letter.toUpperCase(), g)
  for (const t of g.teams) {
    TEAM_BY_SLUG.set(t.slug, t)
    TEAM_BY_NAME.set(t.name.toLowerCase(), t)
  }
}

export const ALL_TEAMS: WCTeam[] = GROUPS.flatMap(g => g.teams)

export function getTeamBySlug(slug: string): WCTeam | null {
  return TEAM_BY_SLUG.get(slug.toLowerCase()) ?? null
}

export function getTeamByName(name: string): WCTeam | null {
  return TEAM_BY_NAME.get(name.toLowerCase()) ?? null
}

export function getGroup(letter: string): WCGroup | null {
  return GROUP_BY_LETTER.get(letter.toUpperCase()) ?? null
}

/** True if `league` from MarketMatch refers to the World Cup. */
export function isWorldCupLeague(league: string | null | undefined): boolean {
  if (!league) return false
  const lower = league.toLowerCase()
  return WC_METADATA.marketMatchLeagueAliases.some(a => lower.includes(a.toLowerCase()))
}
