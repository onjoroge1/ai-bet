/**
 * Data layer for the /world-cup hub family. Reads WC fixtures from
 * MarketMatch (matched via tournament league aliases) and joins them onto
 * the static GROUPS registry so the pages render structure even before
 * any fixtures land in the DB.
 *
 * Pure data — no JSX. One findMany per page-render; everything else is
 * in-memory grouping against the registry.
 *
 * Until the tournament opens (or upstream starts syncing WC fixtures),
 * `wcFixtures()` returns [] and the pages fall back to the static draw —
 * which is the SEO surface we want indexed early anyway.
 */
import prisma from '@/lib/db'
import { generateMatchSlug } from '@/lib/match-slug'
import { edgeSummaryFromV3Model, type EdgeSummary } from '@/lib/edge/extract'
import {
  GROUPS,
  ALL_TEAMS,
  getTeamByName,
  isWorldCupLeague,
  WC_METADATA,
  type WCTeam,
  type WCGroup,
} from '@/lib/world-cup/tournament'

// ─── Types ───────────────────────────────────────────────────────────

export interface WCFixture {
  matchId: string
  marketMatchId: string
  homeTeam: string
  awayTeam: string
  /** Resolved registry teams when the names map cleanly; null otherwise. */
  homeWCTeam: WCTeam | null
  awayWCTeam: WCTeam | null
  /** Group letter both teams share, when it's a group-stage fixture. */
  groupLetter: string | null
  league: string
  kickoffDate: Date
  status: string
  matchSlug: string
  confidence: number          // max(v3, v1) — 0..1
  pick: 'home' | 'away' | 'draw' | null
  /** Edge-payload v1 summary off v3Model's additive keys; null pre-pivot. */
  edge: EdgeSummary | null
  /** H/D/A model probabilities (0..1, sum≈1) for the group sim — null when
   *  no model has run for this fixture yet. */
  probs: { home: number; draw: number; away: number } | null
  /** The model that produced `probs` (e.g. 'v3_sharp', 'wc_elo'), or null
   *  when the row carries only a generic fallback prior (no real model run).
   *  The group sim trusts probs ONLY when this is set — otherwise the numbers
   *  are placeholders, not team-strength signal. */
  modelSource: string | null
  /** Final result for FINISHED fixtures: 'home' | 'draw' | 'away' | null. */
  result: 'home' | 'away' | 'draw' | null
}

export interface WCGroupView {
  group: WCGroup
  fixtures: WCFixture[]
}

// ─── Model readers (mirror soccer-hubs/data.ts) ──────────────────────

function readModel(m: unknown): { confidence: number | null; pick: 'home' | 'away' | 'draw' | null } {
  if (!m || typeof m !== 'object') return { confidence: null, pick: null }
  const obj = m as { confidence?: number; pick?: string }
  const confidence = typeof obj.confidence === 'number' ? obj.confidence : null
  const rawPick = typeof obj.pick === 'string' ? obj.pick.toLowerCase() : null
  const pick = rawPick === 'home' || rawPick === 'away' || rawPick === 'draw' ? rawPick : null
  return { confidence, pick }
}

/** Group letter the two teams share, or null if they aren't in the same group. */
function sharedGroup(home: WCTeam | null, away: WCTeam | null): string | null {
  if (home && away && home.group === away.group) return home.group
  return null
}

/** Read the model source id from a model JSON (e.g. 'v3_sharp', 'wc_elo'). */
function readModelSource(m: unknown): string | null {
  if (!m || typeof m !== 'object') return null
  const s = (m as { source?: unknown }).source
  return typeof s === 'string' && s.length > 0 ? s : null
}

/** Read normalized H/D/A probabilities from a model JSON's `probs` block. */
function readProbs(m: unknown): { home: number; draw: number; away: number } | null {
  if (!m || typeof m !== 'object') return null
  const p = (m as { probs?: { home?: unknown; draw?: unknown; away?: unknown } }).probs
  if (!p) return null
  const h = typeof p.home === 'number' ? p.home : NaN
  const d = typeof p.draw === 'number' ? p.draw : NaN
  const a = typeof p.away === 'number' ? p.away : NaN
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null
  const draw = Number.isFinite(d) ? d : 0
  const sum = h + draw + a
  if (sum <= 0) return null
  return { home: h / sum, draw: draw / sum, away: a / sum } // normalize defensively
}

/** Parse a MarketMatch.finalResult into a simple outcome side. */
function readResult(fr: unknown): 'home' | 'away' | 'draw' | null {
  if (typeof fr === 'string') {
    const u = fr.toUpperCase()
    if (u === 'H') return 'home'; if (u === 'A') return 'away'; if (u === 'D') return 'draw'
  }
  const o = fr as { outcome?: string; score?: { home?: number; away?: number } } | null
  if (o?.outcome) {
    const u = o.outcome.toLowerCase()
    if (u === 'home' || u === 'away' || u === 'draw') return u
  }
  if (o?.score && typeof o.score.home === 'number' && typeof o.score.away === 'number') {
    if (o.score.home > o.score.away) return 'home'
    if (o.score.away > o.score.home) return 'away'
    return 'draw'
  }
  return null
}

// ─── Core fetch ──────────────────────────────────────────────────────

interface FixtureSourceRow {
  id: string
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: Date
  status: string
  v3Model: unknown
  v1Model: unknown
  consensusOdds: unknown
  finalResult: unknown
}

/**
 * All World Cup fixtures we currently hold (any status), newest-window
 * first. Returns [] when no WC fixtures exist yet — callers fall back to
 * the static draw.
 */
export async function wcFixtures(opts?: { take?: number }): Promise<WCFixture[]> {
  // We match on league alias via `contains` per alias. A single OR query
  // keeps this to one round-trip.
  const aliasFilters = WC_METADATA.marketMatchLeagueAliases.map(a => ({
    league: { contains: a, mode: 'insensitive' as const },
  }))

  const rows: FixtureSourceRow[] = await prisma.marketMatch.findMany({
    where: {
      isActive: true,
      OR: aliasFilters,
    },
    select: {
      id: true,
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
      kickoffDate: true,
      status: true,
      v3Model: true,
      v1Model: true,
      consensusOdds: true,
      finalResult: true,
    },
    orderBy: { kickoffDate: 'asc' },
    take: opts?.take ?? 200,
  })

  return rows
    .filter(r => isWorldCupLeague(r.league))
    .map(r => {
      const v3 = readModel(r.v3Model)
      const v1 = readModel(r.v1Model)
      const confidence = Math.max(v3.confidence ?? 0, v1.confidence ?? 0)
      const pick = v3.pick ?? v1.pick
      const homeWCTeam = getTeamByName(r.homeTeam)
      const awayWCTeam = getTeamByName(r.awayTeam)
      return {
        matchId: r.matchId,
        marketMatchId: r.id,
        homeTeam: r.homeTeam,
        awayTeam: r.awayTeam,
        homeWCTeam,
        awayWCTeam,
        groupLetter: sharedGroup(homeWCTeam, awayWCTeam),
        league: r.league,
        kickoffDate: r.kickoffDate,
        status: r.status,
        matchSlug: generateMatchSlug(r.homeTeam, r.awayTeam),
        confidence,
        pick,
        edge: edgeSummaryFromV3Model(r.v3Model),
        probs: readProbs(r.v3Model) ?? readProbs(r.v1Model),
        modelSource: readModelSource(r.v3Model),
        result: readResult(r.finalResult),
      }
    })
}

// ─── Derived views ───────────────────────────────────────────────────

/** Upcoming WC fixtures only (status UPCOMING + kickoff in the future). */
export function upcomingOnly(fixtures: WCFixture[], now: Date): WCFixture[] {
  return fixtures.filter(f => f.status === 'UPCOMING' && f.kickoffDate >= now)
}

/** The single highest-confidence upcoming WC fixture, or null. */
export function leadPick(fixtures: WCFixture[], now: Date): WCFixture | null {
  const candidates = upcomingOnly(fixtures, now)
    .filter(f => f.pick !== null && f.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
  return candidates[0] ?? null
}

/** Fixtures for one group letter (group-stage matches between its teams). */
export function fixturesForGroup(fixtures: WCFixture[], letter: string): WCFixture[] {
  const up = letter.toUpperCase()
  return fixtures
    .filter(f => f.groupLetter === up)
    .sort((a, b) => a.kickoffDate.getTime() - b.kickoffDate.getTime())
}

/** Fixtures involving one team (by slug), any stage. */
export function fixturesForTeam(fixtures: WCFixture[], team: WCTeam): WCFixture[] {
  return fixtures
    .filter(f => f.homeWCTeam?.slug === team.slug || f.awayWCTeam?.slug === team.slug)
    .sort((a, b) => a.kickoffDate.getTime() - b.kickoffDate.getTime())
}

/** Build per-group views across all 12 groups (static structure + any fixtures). */
export function buildGroupViews(fixtures: WCFixture[]): WCGroupView[] {
  return GROUPS.map(group => ({
    group,
    fixtures: fixturesForGroup(fixtures, group.letter),
  }))
}

/** Count of WC fixtures we currently hold, by status. */
export function fixtureCounts(fixtures: WCFixture[]): { total: number; upcoming: number; finished: number } {
  let upcoming = 0, finished = 0
  for (const f of fixtures) {
    if (f.status === 'UPCOMING') upcoming++
    else if (f.status === 'FINISHED') finished++
  }
  return { total: fixtures.length, upcoming, finished }
}

// ─── Static helpers (no DB) ──────────────────────────────────────────

export { GROUPS, ALL_TEAMS }
