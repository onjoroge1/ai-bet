/**
 * Shared data helpers for /soccer/today and /soccer/tomorrow hubs (and
 * future /soccer/[league] league hubs on Day 3). Pulls fixtures and
 * confidence-ranked picks from MarketMatch + TeamStats with a single
 * findMany per page-render.
 *
 * Pure data layer — no JSX, no UI assumptions. Lets us unit-test the
 * grouping/ranking logic in isolation and reuse for league hubs.
 */
import prisma from '@/lib/db'
import { generateMatchSlug } from '@/lib/match-slug'
import { makeTeamSlug } from '@/lib/team-stats/slug'

/** UTC day-start at midnight for a given Date. */
export function dayStartUTC(d: Date): Date {
  const n = new Date(d)
  n.setUTCHours(0, 0, 0, 0)
  return n
}

/** UTC day-end (next-day midnight) for a given Date. */
export function dayEndUTC(d: Date): Date {
  const n = dayStartUTC(d)
  n.setUTCDate(n.getUTCDate() + 1)
  return n
}

/** "Today" or "Tomorrow" relative to `now`. */
export function dayRange(now: Date, offset: 0 | 1): { start: Date; end: Date } {
  const start = dayStartUTC(now)
  if (offset > 0) start.setUTCDate(start.getUTCDate() + offset)
  const end = dayEndUTC(start)
  return { start, end }
}

/** Friendly weekday + date label like "Tuesday, 13 May 2026". */
export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Types ───────────────────────────────────────────────────────────

export interface HubFixture {
  matchId: string
  marketMatchId: string
  homeTeam: string
  awayTeam: string
  homeTeamLogo: string | null
  awayTeamLogo: string | null
  league: string
  leagueFlagEmoji: string | null
  kickoffDate: Date
  matchSlug: string                  // for /match/{slug}
  homeTeamSlug: string | null        // for /team/{slug}/predictions — null when team has no live page
  awayTeamSlug: string | null
  confidence: number                 // max(v3, v1) — 0..1
  pick: 'home' | 'away' | 'draw' | null
  v3Confidence: number | null
  v1Confidence: number | null
}

export interface HubData {
  /** Top 5 fixtures ranked by max(v3, v1) confidence. */
  topPicks: HubFixture[]
  /** All fixtures in the window, grouped by league. */
  byLeague: Array<{ league: string; flagEmoji: string | null; fixtures: HubFixture[] }>
  totalFixtures: number
  /** When the data was fetched. */
  fetchedAt: Date
  /** Page-relative day label (e.g. "today", "tomorrow"). */
  dayName: 'today' | 'tomorrow'
  /** Date as displayed in the hero. */
  dayLabel: string
}

// ─── Core query ──────────────────────────────────────────────────────

interface FixtureSourceRow {
  id: string
  matchId: string
  homeTeam: string
  awayTeam: string
  homeTeamLogo: string | null
  awayTeamLogo: string | null
  league: string
  leagueFlagEmoji: string | null
  kickoffDate: Date
  v3Model: unknown
  v1Model: unknown
}

/** Read v3/v1 confidence + pick out of a model JSON. */
function readModel(m: unknown): { confidence: number | null; pick: 'home' | 'away' | 'draw' | null } {
  if (!m || typeof m !== 'object') return { confidence: null, pick: null }
  const obj = m as { confidence?: number; pick?: string }
  const confidence = typeof obj.confidence === 'number' ? obj.confidence : null
  const rawPick = typeof obj.pick === 'string' ? obj.pick.toLowerCase() : null
  const pick = rawPick === 'home' || rawPick === 'away' || rawPick === 'draw' ? rawPick : null
  return { confidence, pick }
}

/** Best-available confidence: prefer V3 over V1 only when V3 is meaningfully higher. */
function chooseConfidence(v3c: number | null, v1c: number | null): {
  confidence: number
  v3Confidence: number | null
  v1Confidence: number | null
} {
  const v3 = v3c ?? 0
  const v1 = v1c ?? 0
  return { confidence: Math.max(v3, v1), v3Confidence: v3c, v1Confidence: v1c }
}

/**
 * Build the HubData payload for a window. Used by both /soccer/today
 * and /soccer/tomorrow (and league hubs once we add a `league?: string`
 * filter on Day 3).
 *
 * Single Prisma findMany. Single TeamStats lookup to resolve team slugs.
 */
export async function getHubData(opts: {
  dayName: 'today' | 'tomorrow'
  now?: Date
  /** Optional league filter — exact match on MarketMatch.league. Used by
   * league hubs to scope the fixture list. Daily hubs leave this null. */
  league?: string
}): Promise<HubData> {
  const now = opts.now ?? new Date()
  const offset: 0 | 1 = opts.dayName === 'tomorrow' ? 1 : 0
  const { start, end } = dayRange(now, offset)

  const rawRows: FixtureSourceRow[] = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      isActive: true,
      kickoffDate: { gte: start, lt: end },
      ...(opts.league ? { league: opts.league } : {}),
    },
    select: {
      id: true,
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      homeTeamLogo: true,
      awayTeamLogo: true,
      league: true,
      leagueFlagEmoji: true,
      kickoffDate: true,
      v3Model: true,
      v1Model: true,
    },
    orderBy: { kickoffDate: 'asc' },
    take: 500,
  })

  // Resolve team slugs in a single query. We use makeTeamSlug(name, name)
  // because external IDs aren't populated upstream — TeamStats stores the
  // name-only slug shape (e.g. 'arsenal', 'celta-vigo'). Only emit team
  // links for teams that have a live TeamStats page.
  const teamNames = new Set<string>()
  for (const r of rawRows) {
    if (r.homeTeam) teamNames.add(r.homeTeam)
    if (r.awayTeam) teamNames.add(r.awayTeam)
  }
  const liveTeamSlugs = new Set<string>()
  if (teamNames.size > 0) {
    const possibleSlugs = [...teamNames].map(n => makeTeamSlug(n, n))
    const live = await prisma.teamStats.findMany({
      where: { slug: { in: possibleSlugs }, isActive: true },
      select: { slug: true },
    })
    for (const t of live) liveTeamSlugs.add(t.slug)
  }
  const teamSlugIfLive = (name: string): string | null => {
    const slug = makeTeamSlug(name, name)
    return liveTeamSlugs.has(slug) ? slug : null
  }

  const fixtures: HubFixture[] = rawRows.map(r => {
    const v3 = readModel(r.v3Model)
    const v1 = readModel(r.v1Model)
    const { confidence, v3Confidence, v1Confidence } = chooseConfidence(v3.confidence, v1.confidence)
    const pick = v3.pick ?? v1.pick
    return {
      matchId: r.matchId,
      marketMatchId: r.id,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      homeTeamLogo: r.homeTeamLogo,
      awayTeamLogo: r.awayTeamLogo,
      league: r.league,
      leagueFlagEmoji: r.leagueFlagEmoji,
      kickoffDate: r.kickoffDate,
      matchSlug: generateMatchSlug(r.homeTeam, r.awayTeam),
      homeTeamSlug: teamSlugIfLive(r.homeTeam),
      awayTeamSlug: teamSlugIfLive(r.awayTeam),
      confidence,
      pick,
      v3Confidence,
      v1Confidence,
    }
  })

  // Group by league for the "All fixtures" section
  const leagueMap = new Map<string, { flagEmoji: string | null; fixtures: HubFixture[] }>()
  for (const f of fixtures) {
    const key = f.league || 'Other'
    if (!leagueMap.has(key)) {
      leagueMap.set(key, { flagEmoji: f.leagueFlagEmoji, fixtures: [] })
    }
    leagueMap.get(key)!.fixtures.push(f)
  }
  const byLeague = [...leagueMap.entries()]
    .map(([league, v]) => ({ league, flagEmoji: v.flagEmoji, fixtures: v.fixtures }))
    .sort((a, b) => a.league.localeCompare(b.league))

  // Top picks — confidence ≥ 0.5 only (avoids surfacing coin-flip "picks").
  // Take top 5.
  const topPicks = [...fixtures]
    .filter(f => f.confidence >= 0.5 && f.pick !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  return {
    topPicks,
    byLeague,
    totalFixtures: fixtures.length,
    fetchedAt: now,
    dayName: opts.dayName,
    dayLabel: formatDayLabel(start),
  }
}
