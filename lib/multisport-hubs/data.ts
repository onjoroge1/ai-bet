/**
 * Data assembly for multisport hubs — /nba, /nhl, and their daily routes.
 *
 * Mirrors lib/soccer-hubs/data.ts shape but reads MultisportMatch and
 * understands the 2-way market (no draws). Pure server-side.
 */
import prisma from '@/lib/db'
import { makeTeamSlug } from '@/lib/team-stats/slug'

export interface MultisportHubFixture {
  eventId: string
  homeTeam: string
  awayTeam: string
  league: string
  commenceTime: Date
  homeTeamSlug: string | null
  awayTeamSlug: string | null
  confidence: number              // 0..1
  pick: 'home' | 'away' | null    // model pick mapped from H/A
  homeProb: number | null         // consensus
  awayProb: number | null
}

export interface MultisportHubData {
  sport: string
  dayLabel: string
  topPicks: MultisportHubFixture[]
  fixtures: MultisportHubFixture[]
  totalFixtures: number
  generatedAt: Date
}

function dayRange(now: Date, offsetDays: 0 | 1): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + offsetDays)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function dayLabel(start: Date): string {
  return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

interface MatchRow {
  eventId: string
  homeTeam: string
  awayTeam: string
  league: string
  commenceTime: Date
  model: unknown
  odds: unknown
}

function readModelPick(model: unknown): { pick: 'home' | 'away' | null; confidence: number } {
  const m = (model || {}) as { predictions?: { pick?: string; confidence?: number; home_win?: number; away_win?: number } }
  const p = m.predictions?.pick
  const conf = typeof m.predictions?.confidence === 'number' ? m.predictions!.confidence! : 0
  let pick: 'home' | 'away' | null = null
  if (typeof p === 'string') {
    const up = p.toUpperCase()
    if (up === 'H' || up === 'HOME') pick = 'home'
    else if (up === 'A' || up === 'AWAY') pick = 'away'
  }
  return { pick, confidence: conf }
}

function readOddsProb(odds: unknown): { homeProb: number | null; awayProb: number | null } {
  const o = (odds as { consensus?: { home_prob?: number; away_prob?: number } } | null)?.consensus
  return {
    homeProb: typeof o?.home_prob === 'number' ? o.home_prob : null,
    awayProb: typeof o?.away_prob === 'number' ? o.away_prob : null,
  }
}

async function fetchTeamSlugs(sport: string, teamNames: string[]): Promise<Map<string, string>> {
  if (teamNames.length === 0) return new Map()
  const rows = await prisma.teamStats.findMany({
    where: {
      sport,
      isActive: true,
      name: { in: teamNames },
    },
    select: { name: true, slug: true },
  })
  return new Map(rows.map(r => [r.name, r.slug]))
}

/**
 * Pull a sport's fixtures for today or tomorrow. Returns top picks +
 * full fixture list, both pre-sorted by confidence desc.
 */
export async function getMultisportHubData(opts: {
  sport: string             // 'basketball_nba' | 'icehockey_nhl' | 'basketball_ncaab'
  dayName: 'today' | 'tomorrow'
  now?: Date
}): Promise<MultisportHubData> {
  const now = opts.now ?? new Date()
  const offset: 0 | 1 = opts.dayName === 'tomorrow' ? 1 : 0
  const { start, end } = dayRange(now, offset)

  const rawRows = await prisma.multisportMatch.findMany({
    where: {
      sport: opts.sport,
      status: 'upcoming',
      commenceTime: { gte: start, lt: end },
    },
    select: {
      eventId: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
      commenceTime: true,
      model: true,
      odds: true,
    },
    orderBy: { commenceTime: 'asc' },
    take: 100,
  })

  // Look up which teams have live team pages so we can link
  const teamNames = Array.from(new Set(rawRows.flatMap(r => [r.homeTeam, r.awayTeam])))
  const slugByName = await fetchTeamSlugs(opts.sport, teamNames)

  const fixtures: MultisportHubFixture[] = (rawRows as MatchRow[]).map(r => {
    const { pick, confidence } = readModelPick(r.model)
    const { homeProb, awayProb } = readOddsProb(r.odds)
    return {
      eventId: r.eventId,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      league: r.league,
      commenceTime: r.commenceTime,
      homeTeamSlug: slugByName.get(r.homeTeam) ?? null,
      awayTeamSlug: slugByName.get(r.awayTeam) ?? null,
      confidence,
      pick,
      homeProb,
      awayProb,
    }
  })

  const topPicks = [...fixtures]
    .filter(f => f.pick !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  return {
    sport: opts.sport,
    dayLabel: dayLabel(start),
    topPicks,
    fixtures,
    totalFixtures: fixtures.length,
    generatedAt: now,
  }
}

// ─── Sport-level summary stats (for hub index page) ─────────────────────

export interface MultisportSportSummary {
  modelAccuracy: { accuracy: number; sampleN: number } | null
  totalFinishedLast90d: number
  topTeams: Array<{
    slug: string
    name: string
    logoUrl: string | null
    wins: number
    losses: number
    formLast10: string | null
  }>
  recentResults: Array<{
    eventId: string
    homeTeam: string
    awayTeam: string
    commenceTime: Date
    outcome: 'home' | 'away' | null
    modelPick: 'home' | 'away' | null
    modelHit: boolean | null
  }>
}

export async function getMultisportSportSummary(sport: string): Promise<MultisportSportSummary> {
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400 * 1000)

  const [accRows, topTeams, recentRows] = await Promise.all([
    prisma.multisportMatch.findMany({
      where: {
        sport,
        status: 'finished',
        commenceTime: { gte: ninetyDaysAgo, lt: now },
        finalResult: { not: { equals: null as unknown as object } },
      },
      select: { model: true, finalResult: true },
      take: 500,
    }),
    prisma.teamStats.findMany({
      where: { sport, isActive: true, hasUpcoming: true },
      orderBy: { matchesPlayed: 'desc' },
      take: 6,
      select: {
        slug: true,
        name: true,
        logoUrl: true,
        wins: true,
        losses: true,
        formLast10: true,
      },
    }),
    prisma.multisportMatch.findMany({
      where: {
        sport,
        status: 'finished',
        finalResult: { not: { equals: null as unknown as object } },
      },
      orderBy: { commenceTime: 'desc' },
      take: 6,
      select: {
        eventId: true,
        homeTeam: true,
        awayTeam: true,
        commenceTime: true,
        finalResult: true,
        model: true,
      },
    }),
  ])

  // Aggregate model accuracy
  let hits = 0, n = 0
  for (const r of accRows) {
    const outcome = readOutcomeFromFinalResult(r.finalResult)
    if (!outcome) continue
    const { pick } = readModelPick(r.model)
    if (!pick) continue
    n++
    if (pick === outcome) hits++
  }
  const modelAccuracy = n > 0 ? { accuracy: +(hits / n).toFixed(4), sampleN: n } : null

  const recentResults = recentRows.map(r => {
    const outcome = readOutcomeFromFinalResult(r.finalResult)
    const { pick } = readModelPick(r.model)
    return {
      eventId: r.eventId,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      commenceTime: r.commenceTime,
      outcome,
      modelPick: pick,
      modelHit: outcome && pick ? pick === outcome : null,
    }
  })

  return {
    modelAccuracy,
    totalFinishedLast90d: accRows.length,
    topTeams,
    recentResults,
  }
}

function readOutcomeFromFinalResult(fr: unknown): 'home' | 'away' | null {
  if (typeof fr === 'string') {
    const up = fr.toUpperCase()
    if (up === 'H' || up === 'HOME') return 'home'
    if (up === 'A' || up === 'AWAY') return 'away'
    return null
  }
  const obj = fr as { result?: string; score?: { home?: number; away?: number } } | null
  if (obj?.result) {
    const up = obj.result.toUpperCase()
    if (up === 'H' || up === 'HOME') return 'home'
    if (up === 'A' || up === 'AWAY') return 'away'
  }
  if (obj?.score && typeof obj.score.home === 'number' && typeof obj.score.away === 'number') {
    return obj.score.home > obj.score.away ? 'home' : 'away'
  }
  return null
}

// ─── Sport config (slug → display name, etc.) ──────────────────────────

export interface SportDef {
  slug: string           // 'nba' / 'nhl' / 'ncaab' — URL prefix
  sport: string          // 'basketball_nba' / 'icehockey_nhl' — DB key
  displayName: string
  description: string
  flagEmoji: string
}

export const SPORTS: SportDef[] = [
  {
    slug: 'nba',
    sport: 'basketball_nba',
    displayName: 'NBA',
    description:
      "AI predictions for every NBA game. Live model accuracy, top-team form, and head-to-head context — updated daily.",
    flagEmoji: '🏀',
  },
  {
    slug: 'nhl',
    sport: 'icehockey_nhl',
    displayName: 'NHL',
    description:
      'AI-driven predictions across the NHL season. Head-to-head form, model accuracy by team, and recent results.',
    flagEmoji: '🏒',
  },
]

export function getSportBySlug(slug: string): SportDef | null {
  return SPORTS.find(s => s.slug === slug) ?? null
}

// Re-export the slug helper for the page so it doesn't import from team-stats directly
export { makeTeamSlug }
