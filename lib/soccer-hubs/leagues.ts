/**
 * League hub configuration + data assembly.
 *
 * Hardcoded slug allowlist — anything outside this set returns 404 from
 * the page route. Controls thin-content blast radius; we expand only
 * when we have signal that a league is worth a dedicated hub.
 *
 * `displayName` MUST match MarketMatch.league exactly (case-sensitive)
 * because we filter by league string. If upstream renames a league,
 * update here.
 */
import prisma from '@/lib/db'
import { outcomeFromFinalResult } from '@/lib/premium-tracker/capture-helpers'

export interface LeagueDef {
  slug: string
  displayName: string         // exact MarketMatch.league value
  description: string         // one-line intro (used in hero + meta)
  flagEmoji: string | null
}

export const LEAGUES: LeagueDef[] = [
  {
    slug: 'premier-league',
    displayName: 'Premier League',
    description: 'The Premier League — England’s top flight. AI predictions for every fixture, plus league-wide model accuracy and recent results.',
    flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  {
    slug: 'la-liga',
    displayName: 'La Liga',
    description: 'La Liga — Spain’s top tier. AI-driven match predictions, model accuracy on La Liga fixtures, and head-to-head data for the top clubs.',
    flagEmoji: '🇪🇸',
  },
  {
    slug: 'serie-a',
    displayName: 'Serie A',
    description: 'Serie A — Italy’s top flight. AI predictions and league-wide model performance for every Serie A fixture in our data window.',
    flagEmoji: '🇮🇹',
  },
  {
    slug: 'bundesliga',
    displayName: 'Bundesliga',
    description: 'Bundesliga — Germany’s top tier. AI predictions, model accuracy, and recent results across the league.',
    flagEmoji: '🇩🇪',
  },
  {
    slug: 'champions-league',
    displayName: 'UEFA Champions League',
    description: 'UEFA Champions League — the top European club competition. AI predictions, model accuracy by leg, and recent results.',
    flagEmoji: '🏆',
  },
]

const SLUG_MAP = new Map(LEAGUES.map(l => [l.slug, l]))

export function getLeagueBySlug(slug: string): LeagueDef | null {
  return SLUG_MAP.get(slug) ?? null
}

// ─── League-stats payload ─────────────────────────────────────────────

export interface LeagueModelAccuracy {
  v1: { accuracy: number; sampleN: number } | null
  v3: { accuracy: number; sampleN: number } | null
  /** 'v1' | 'v3' | null — uses the same MIN_N=10 / MIN_GAP=5pp rule as team pages. */
  recommended: 'v1' | 'v3' | null
}

export interface LeagueTopTeam {
  slug: string
  name: string
  logoUrl: string | null
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  formLast10: string | null
}

export interface LeagueRecentResult {
  matchId: string
  homeTeam: string
  awayTeam: string
  kickoffDate: Date
  homeScore: number | null
  awayScore: number | null
  outcome: 'home' | 'away' | 'draw' | null
  v1Pick: 'home' | 'away' | 'draw' | null
  v3Pick: 'home' | 'away' | 'draw' | null
  v1Hit: boolean | null
  v3Hit: boolean | null
}

export interface LeagueData {
  accuracy: LeagueModelAccuracy
  topTeams: LeagueTopTeam[]
  recentResults: LeagueRecentResult[]
  totalFinishedLast90d: number
}

interface AccuracyRow {
  v1Model: unknown
  v3Model: unknown
  finalResult: unknown
}

function readPick(m: unknown): 'home' | 'away' | 'draw' | null {
  if (!m || typeof m !== 'object') return null
  const p = (m as { pick?: string }).pick
  if (typeof p !== 'string') return null
  const lo = p.toLowerCase()
  return lo === 'home' || lo === 'away' || lo === 'draw' ? lo : null
}

function readScore(fr: unknown): { home: number; away: number } | null {
  const s = (fr as { score?: { home?: number; away?: number } } | null)?.score
  if (!s || typeof s.home !== 'number' || typeof s.away !== 'number') return null
  return { home: s.home, away: s.away }
}

/**
 * Aggregate league-scope analytics. One query for accuracy, one for top
 * teams, one for recent results. Cheap enough to run on every page-render
 * (5-min ISR cache covers spikes).
 */
export async function getLeagueData(league: LeagueDef): Promise<LeagueData> {
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400 * 1000)

  // ── Model accuracy across league's recent finished matches ──────────
  const accRows = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      isActive: true,
      league: league.displayName,
      kickoffDate: { gte: ninetyDaysAgo, lt: now },
      finalResult: { not: { equals: null as unknown as object } },
    },
    select: { v1Model: true, v3Model: true, finalResult: true },
    take: 500,
  })

  let v1Hits = 0, v1N = 0
  let v3Hits = 0, v3N = 0
  for (const r of accRows as AccuracyRow[]) {
    const outcome = outcomeFromFinalResult(r.finalResult)
    if (!outcome) continue
    const v1 = readPick(r.v1Model)
    const v3 = readPick(r.v3Model)
    if (v1) { v1N++; if (v1 === outcome) v1Hits++ }
    if (v3) { v3N++; if (v3 === outcome) v3Hits++ }
  }
  const v1 = v1N > 0 ? { accuracy: +(v1Hits / v1N).toFixed(4), sampleN: v1N } : null
  const v3 = v3N > 0 ? { accuracy: +(v3Hits / v3N).toFixed(4), sampleN: v3N } : null

  let recommended: 'v1' | 'v3' | null = null
  const MIN_N = 10, MIN_GAP = 0.05
  if (v1 && v1.sampleN >= MIN_N && v3 && v3.sampleN >= MIN_N) {
    if (v3.accuracy >= v1.accuracy + MIN_GAP) recommended = 'v3'
    else if (v1.accuracy >= v3.accuracy + MIN_GAP) recommended = 'v1'
  } else if (v1 && v1.sampleN >= MIN_N) {
    recommended = 'v1'
  } else if (v3 && v3.sampleN >= MIN_N) {
    recommended = 'v3'
  }

  // ── Top teams in this league by matchesPlayed ──────────────────────
  const teamRows = await prisma.teamStats.findMany({
    where: { league: league.displayName, isActive: true },
    orderBy: { matchesPlayed: 'desc' },
    take: 6,
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      matchesPlayed: true,
      wins: true,
      draws: true,
      losses: true,
      formLast10: true,
    },
  })

  // ── Recent results: last 5 FINISHED with finalResult ───────────────
  const recentRows = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      isActive: true,
      league: league.displayName,
      finalResult: { not: { equals: null as unknown as object } },
    },
    orderBy: { kickoffDate: 'desc' },
    take: 5,
    select: {
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      kickoffDate: true,
      finalResult: true,
      v1Model: true,
      v3Model: true,
    },
  })

  const recentResults: LeagueRecentResult[] = recentRows.map(r => {
    const outcome = outcomeFromFinalResult(r.finalResult)
    const score = readScore(r.finalResult)
    const v1Pick = readPick(r.v1Model)
    const v3Pick = readPick(r.v3Model)
    return {
      matchId: r.matchId,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      kickoffDate: r.kickoffDate,
      homeScore: score?.home ?? null,
      awayScore: score?.away ?? null,
      outcome,
      v1Pick,
      v3Pick,
      v1Hit: outcome && v1Pick ? v1Pick === outcome : null,
      v3Hit: outcome && v3Pick ? v3Pick === outcome : null,
    }
  })

  return {
    accuracy: { v1, v3, recommended },
    topTeams: teamRows,
    recentResults,
    totalFinishedLast90d: accRows.length,
  }
}
