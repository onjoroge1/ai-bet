/**
 * Multisport rollup implementation — NBA, NHL, NCAAB.
 *
 * Mirrors lib/team-stats/cron-impl.ts (soccer) but reads from the
 * MultisportMatch table and uses the 2-way-market rollup helpers.
 *
 * Writes to the same TeamStats table, namespaced by sport-prefixed
 * slugs (`nba-lakers`, `nhl-rangers`, ...). NBA/NHL never have draws,
 * so TeamStats.draws stays 0 and the team page should hide the D
 * column when sport != 'soccer'.
 */
import prisma from '@/lib/db'
import {
  aggregateStats,
  encodeForm,
  modelAccuracyForTeam,
  buildH2HGrid,
  teamSideIn,
  type MultisportMatchRow,
} from './multisport-rollup'
import { makeTeamSlug } from './slug'

export interface MultisportTeamIdentity {
  name: string
  sport: string                  // 'basketball_nba' | 'icehockey_nhl' | 'basketball_ncaab'
  league: string | null
  logoUrl: string | null
}

export interface MultisportRollupResult {
  sport: string
  candidateCount: number
  rolled: number
  skipped: number
  errors: number
  durationMs: number
}

const QUALIFICATION = {
  MIN_HISTORICAL_MATCHES: 5,   // NBA/NHL data window is shorter than soccer; relax floor
  HISTORY_WINDOW_DAYS: 365,
  UPCOMING_WINDOW_DAYS: 30,
  RECENT_WINDOW_DAYS: 21,      // NBA/NHL season has gaps; widen the recent window
}

async function findQualifyingTeams(sport: string): Promise<MultisportTeamIdentity[]> {
  const now = new Date()
  const historyCutoff = new Date(now.getTime() - QUALIFICATION.HISTORY_WINDOW_DAYS * 86400 * 1000)
  const upcomingCutoff = new Date(now.getTime() + QUALIFICATION.UPCOMING_WINDOW_DAYS * 86400 * 1000)
  const recentCutoff = new Date(now.getTime() - QUALIFICATION.RECENT_WINDOW_DAYS * 86400 * 1000)

  type AggRow = {
    name: string
    league: string | null
    historical_count: bigint
    upcoming_count: bigint
    recent_count: bigint
  }

  const rows = await prisma.$queryRaw<AggRow[]>`
    WITH unioned AS (
      SELECT "homeTeam" AS name, "league", "commenceTime", "status", "finalResult"
      FROM "MultisportMatch"
      WHERE "sport" = ${sport} AND "homeTeam" IS NOT NULL AND "homeTeam" <> ''

      UNION ALL

      SELECT "awayTeam" AS name, "league", "commenceTime", "status", "finalResult"
      FROM "MultisportMatch"
      WHERE "sport" = ${sport} AND "awayTeam" IS NOT NULL AND "awayTeam" <> ''
    ),
    latest_per_team AS (
      SELECT DISTINCT ON (name) name, league
      FROM unioned
      ORDER BY name, "commenceTime" DESC
    )
    SELECT
      l.name,
      l.league,
      COUNT(*) FILTER (
        WHERE u."status" = 'finished'
          AND u."commenceTime" >= ${historyCutoff}
          AND u."finalResult" IS NOT NULL
      )::bigint AS historical_count,
      COUNT(*) FILTER (
        WHERE u."status" = 'upcoming'
          AND u."commenceTime" >= ${now}
          AND u."commenceTime" <= ${upcomingCutoff}
      )::bigint AS upcoming_count,
      COUNT(*) FILTER (
        WHERE u."status" = 'finished'
          AND u."commenceTime" >= ${recentCutoff}
      )::bigint AS recent_count
    FROM latest_per_team l
    LEFT JOIN unioned u ON u.name = l.name
    GROUP BY l.name, l.league
    HAVING COUNT(*) FILTER (
      WHERE u."status" = 'finished'
        AND u."commenceTime" >= ${historyCutoff}
        AND u."finalResult" IS NOT NULL
    ) >= ${QUALIFICATION.MIN_HISTORICAL_MATCHES}
       AND (
         COUNT(*) FILTER (
           WHERE u."status" = 'upcoming'
             AND u."commenceTime" >= ${now}
             AND u."commenceTime" <= ${upcomingCutoff}
         ) >= 1
         OR COUNT(*) FILTER (
           WHERE u."status" = 'finished'
             AND u."commenceTime" >= ${recentCutoff}
         ) >= 1
       )
  `

  return rows.map(r => ({
    name: r.name,
    sport,
    league: r.league,
    logoUrl: null,  // upstream doesn't currently provide multisport team logos
  }))
}

async function loadTeamHistory(sport: string, teamName: string): Promise<MultisportMatchRow[]> {
  const historyCutoff = new Date(Date.now() - QUALIFICATION.HISTORY_WINDOW_DAYS * 86400 * 1000)
  const rows = await prisma.multisportMatch.findMany({
    where: {
      sport,
      status: 'finished',
      commenceTime: { gte: historyCutoff },
      finalResult: { not: { equals: null as unknown as object } },
      OR: [
        { homeTeam: teamName },
        { awayTeam: teamName },
      ],
    },
    select: {
      eventId: true,
      sport: true,
      league: true,
      commenceTime: true,
      homeTeam: true,
      awayTeam: true,
      status: true,
      finalResult: true,
      model: true,
      odds: true,
    },
    orderBy: { commenceTime: 'desc' },
    take: 500,
  })

  return rows.map(r => ({
    eventId: r.eventId,
    sport: r.sport,
    league: r.league,
    commenceTime: r.commenceTime,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    status: r.status,
    finalResult: r.finalResult,
    model: r.model,
    odds: r.odds,
  }))
}

async function teamHasUpcoming(sport: string, teamName: string): Promise<boolean> {
  const now = new Date()
  const cutoff = new Date(now.getTime() + QUALIFICATION.UPCOMING_WINDOW_DAYS * 86400 * 1000)
  const count = await prisma.multisportMatch.count({
    where: {
      sport,
      status: 'upcoming',
      commenceTime: { gte: now, lte: cutoff },
      OR: [{ homeTeam: teamName }, { awayTeam: teamName }],
    },
  })
  return count > 0
}

/**
 * Roll up every qualifying team in a given sport. Idempotent — upserts
 * by slug. Soccer rows are NOT touched (different cron-impl writes those).
 */
export async function rollupSportTeams(sport: string): Promise<MultisportRollupResult> {
  const startedAt = Date.now()
  const candidates = await findQualifyingTeams(sport)
  let rolled = 0
  let skipped = 0
  let errors = 0

  for (const identity of candidates) {
    try {
      const matches = await loadTeamHistory(identity.sport, identity.name)
      if (matches.length < QUALIFICATION.MIN_HISTORICAL_MATCHES) { skipped++; continue }
      const hasUpcoming = await teamHasUpcoming(identity.sport, identity.name)

      // Filter to validly-on-team matches
      const validMatches = matches.filter(m => teamSideIn(m, identity.name) !== null)

      const stats = aggregateStats(validMatches, identity.name)
      const formLast10 = encodeForm(validMatches, identity.name, 10)
      const modelAcc = modelAccuracyForTeam(validMatches, identity.name, 30)
      const h2h = buildH2HGrid(validMatches, identity.name, 5)

      const slug = makeTeamSlug(identity.name, identity.name, identity.sport)

      // NBA/NHL upstream gives outcome only (no score data). homeGoalsFor/
      // awayGoalsFor are reused to store home/away WIN PERCENTAGE × 100 so
      // the team page can render something meaningful.
      const homeWinPct = stats.homeMatches > 0 ? +(stats.homeWins / stats.homeMatches * 100).toFixed(2) : 0
      const awayWinPct = stats.awayMatches > 0 ? +(stats.awayWins / stats.awayMatches * 100).toFixed(2) : 0
      const v3Acc = modelAcc?.accuracy.toString() ?? null
      const homeDec = homeWinPct.toString()
      const awayDec = awayWinPct.toString()

      await prisma.teamStats.upsert({
        where: { slug },
        create: {
          slug,
          externalTeamId: identity.name,
          name: identity.name,
          sport: identity.sport,
          league: identity.league,
          country: null,
          logoUrl: identity.logoUrl,
          matchesPlayed: stats.matchesPlayed,
          wins: stats.wins,
          draws: 0,
          losses: stats.losses,
          goalsFor: 0,
          goalsAgainst: 0,
          bttsCount: 0,
          over25Count: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          homeGoalsFor: homeDec as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          awayGoalsFor: awayDec as any,
          formLast10,
          v1ModelAccuracy: null,
          v1ModelSampleN: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          v3ModelAccuracy: v3Acc as any,
          v3ModelSampleN: modelAcc?.sampleN ?? null,
          recommendedModel: modelAcc ? 'v3' : null,
          h2hGrid: h2h as unknown as object,
          hasUpcoming,
          isActive: true,
          lastRolledAt: new Date(),
        },
        update: {
          externalTeamId: identity.name,
          name: identity.name,
          sport: identity.sport,
          league: identity.league,
          logoUrl: identity.logoUrl,
          matchesPlayed: stats.matchesPlayed,
          wins: stats.wins,
          draws: 0,
          losses: stats.losses,
          goalsFor: 0,
          goalsAgainst: 0,
          bttsCount: 0,
          over25Count: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          homeGoalsFor: homeDec as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          awayGoalsFor: awayDec as any,
          formLast10,
          v1ModelAccuracy: null,
          v1ModelSampleN: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          v3ModelAccuracy: v3Acc as any,
          v3ModelSampleN: modelAcc?.sampleN ?? null,
          recommendedModel: modelAcc ? 'v3' : null,
          h2hGrid: h2h as unknown as object,
          hasUpcoming,
          isActive: true,
          lastRolledAt: new Date(),
        },
      })
      rolled++
    } catch (e) {
      errors++
      console.error(`[Multisport Rollup ${sport}] Failed for ${identity.name}:`, e)
    }
  }

  return {
    sport,
    candidateCount: candidates.length,
    rolled,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
  }
}
