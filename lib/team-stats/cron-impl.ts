/**
 * Shared cron implementation for team-stats roll-up. Used by:
 *   - app/api/cron/team-stats-roll/route.ts (daily)
 *   - scripts/team-stats-backfill.ts (one-shot manual)
 *
 * Walks MarketMatch to find qualifying teams (externalTeamId non-null,
 * ≥10 historical matches, recent/upcoming activity), pulls each team's
 * match history, computes TeamStats via the pure helpers, upserts.
 */
import prisma from '@/lib/db'
import { buildTeamStats, QUALIFICATION, type TeamIdentity } from './build'
import type { TeamMatchRow } from './rollup'

export interface RollupResult {
  candidateCount: number
  rolled: number
  skipped: number
  errors: number
  durationMs: number
}

/**
 * Identify qualifying teams. A team is keyed by team NAME (since
 * MarketMatch.homeTeamId / awayTeamId are unpopulated in current data —
 * probed 2026-05-13: 0/1803 rows have non-null IDs). We use the *most
 * recent* row as the source of canonical league + logo.
 */
async function findQualifyingTeams(): Promise<TeamIdentity[]> {
  const now = new Date()
  const historyCutoff = new Date(now.getTime() - QUALIFICATION.HISTORY_WINDOW_DAYS * 86400 * 1000)
  const upcomingCutoff = new Date(now.getTime() + QUALIFICATION.UPCOMING_WINDOW_DAYS * 86400 * 1000)
  const recentCutoff = new Date(now.getTime() - QUALIFICATION.RECENT_WINDOW_DAYS * 86400 * 1000)

  type AggRow = {
    name: string
    league: string | null
    logo_url: string | null
    historical_count: bigint
    upcoming_count: bigint
    recent_count: bigint
  }

  const rows = await prisma.$queryRaw<AggRow[]>`
    WITH unioned AS (
      SELECT
        "homeTeam"   AS name,
        "league",
        "homeTeamLogo" AS logo_url,
        "kickoffDate",
        "status",
        "v1Model",
        "finalResult"
      FROM "MarketMatch"
      WHERE "homeTeam" IS NOT NULL AND "homeTeam" <> '' AND "isActive" = true

      UNION ALL

      SELECT
        "awayTeam"   AS name,
        "league",
        "awayTeamLogo" AS logo_url,
        "kickoffDate",
        "status",
        "v1Model",
        "finalResult"
      FROM "MarketMatch"
      WHERE "awayTeam" IS NOT NULL AND "awayTeam" <> '' AND "isActive" = true
    ),
    latest_per_team AS (
      SELECT DISTINCT ON (name)
        name, league, logo_url
      FROM unioned
      ORDER BY name, "kickoffDate" DESC
    )
    SELECT
      l.name,
      l.league,
      l.logo_url,
      COUNT(*) FILTER (
        WHERE u."status" = 'FINISHED'
          AND u."kickoffDate" >= ${historyCutoff}
          AND u."v1Model" IS NOT NULL
          AND u."finalResult" IS NOT NULL
      )::bigint AS historical_count,
      COUNT(*) FILTER (
        WHERE u."status" = 'UPCOMING'
          AND u."kickoffDate" >= ${now}
          AND u."kickoffDate" <= ${upcomingCutoff}
      )::bigint AS upcoming_count,
      COUNT(*) FILTER (
        WHERE u."status" = 'FINISHED'
          AND u."kickoffDate" >= ${recentCutoff}
      )::bigint AS recent_count
    FROM latest_per_team l
    LEFT JOIN unioned u ON u.name = l.name
    GROUP BY l.name, l.league, l.logo_url
    HAVING COUNT(*) FILTER (
      WHERE u."status" = 'FINISHED'
        AND u."kickoffDate" >= ${historyCutoff}
        AND u."v1Model" IS NOT NULL
        AND u."finalResult" IS NOT NULL
    ) >= ${QUALIFICATION.MIN_HISTORICAL_MATCHES}
       AND (
         COUNT(*) FILTER (
           WHERE u."status" = 'UPCOMING'
             AND u."kickoffDate" >= ${now}
             AND u."kickoffDate" <= ${upcomingCutoff}
         ) >= 1
         OR COUNT(*) FILTER (
           WHERE u."status" = 'FINISHED'
             AND u."kickoffDate" >= ${recentCutoff}
         ) >= 1
       )
  `

  return rows.map(r => ({
    externalTeamId: r.name,          // team-name string used as key
    name: r.name,
    league: r.league,
    country: null,
    logoUrl: r.logo_url,
  }))
}

/**
 * Pull a single team's historical FINISHED matches from MarketMatch.
 * Returns TeamMatchRow[] ready for the pure helpers.
 */
async function loadTeamHistory(teamName: string): Promise<TeamMatchRow[]> {
  const historyCutoff = new Date(Date.now() - QUALIFICATION.HISTORY_WINDOW_DAYS * 86400 * 1000)
  const rows = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      kickoffDate: { gte: historyCutoff },
      OR: [
        { homeTeam: teamName },
        { awayTeam: teamName },
      ],
      finalResult: { not: { equals: null as unknown as object } },
    },
    select: {
      matchId: true,
      league: true,
      kickoffDate: true,
      homeTeam: true, awayTeam: true,
      finalResult: true,
      v1Model: true, v3Model: true,
    },
    orderBy: { kickoffDate: 'desc' },
    take: 500,
  })

  // Inject the team-name as the "ID" so the pure helpers can compare uniformly.
  return rows.map(r => ({
    matchId: r.matchId,
    league: r.league,
    kickoffDate: r.kickoffDate,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    homeTeamId: r.homeTeam,   // key = team name (no external ID populated upstream)
    awayTeamId: r.awayTeam,
    finalResult: r.finalResult,
    v1Model: r.v1Model,
    v3Model: r.v3Model,
  }))
}

async function teamHasUpcoming(teamName: string): Promise<boolean> {
  const now = new Date()
  const cutoff = new Date(now.getTime() + QUALIFICATION.UPCOMING_WINDOW_DAYS * 86400 * 1000)
  const count = await prisma.marketMatch.count({
    where: {
      status: 'UPCOMING',
      kickoffDate: { gte: now, lte: cutoff },
      OR: [{ homeTeam: teamName }, { awayTeam: teamName }],
    },
  })
  return count > 0
}

/**
 * Roll up every qualifying team. Idempotent — upserts by slug.
 */
export async function rollupAllTeams(): Promise<RollupResult> {
  const startedAt = Date.now()

  const candidates = await findQualifyingTeams()
  let rolled = 0
  let skipped = 0
  let errors = 0

  for (const identity of candidates) {
    try {
      const matches = await loadTeamHistory(identity.externalTeamId)
      if (matches.length < QUALIFICATION.MIN_HISTORICAL_MATCHES) { skipped++; continue }
      const hasUpcoming = await teamHasUpcoming(identity.externalTeamId)
      const stats = buildTeamStats(identity, matches, hasUpcoming)

      await prisma.teamStats.upsert({
        where: { slug: stats.slug },
        create: {
          slug: stats.slug,
          externalTeamId: stats.externalTeamId,
          name: stats.name,
          league: stats.league,
          country: stats.country,
          logoUrl: stats.logoUrl,
          matchesPlayed: stats.matchesPlayed,
          wins: stats.wins,
          draws: stats.draws,
          losses: stats.losses,
          goalsFor: stats.goalsFor,
          goalsAgainst: stats.goalsAgainst,
          bttsCount: stats.bttsCount,
          over25Count: stats.over25Count,
          homeGoalsFor: stats.homeGoalsFor ?? undefined,
          awayGoalsFor: stats.awayGoalsFor ?? undefined,
          formLast10: stats.formLast10,
          v1ModelAccuracy: stats.v1ModelAccuracy ?? undefined,
          v1ModelSampleN: stats.v1ModelSampleN ?? undefined,
          v3ModelAccuracy: stats.v3ModelAccuracy ?? undefined,
          v3ModelSampleN: stats.v3ModelSampleN ?? undefined,
          recommendedModel: stats.recommendedModel ?? undefined,
          h2hGrid: stats.h2hGrid as object,
          hasUpcoming: stats.hasUpcoming,
          isActive: stats.isActive,
          lastRolledAt: new Date(),
        },
        update: {
          externalTeamId: stats.externalTeamId,
          name: stats.name,
          league: stats.league,
          country: stats.country,
          logoUrl: stats.logoUrl,
          matchesPlayed: stats.matchesPlayed,
          wins: stats.wins,
          draws: stats.draws,
          losses: stats.losses,
          goalsFor: stats.goalsFor,
          goalsAgainst: stats.goalsAgainst,
          bttsCount: stats.bttsCount,
          over25Count: stats.over25Count,
          homeGoalsFor: stats.homeGoalsFor,
          awayGoalsFor: stats.awayGoalsFor,
          formLast10: stats.formLast10,
          v1ModelAccuracy: stats.v1ModelAccuracy,
          v1ModelSampleN: stats.v1ModelSampleN,
          v3ModelAccuracy: stats.v3ModelAccuracy,
          v3ModelSampleN: stats.v3ModelSampleN,
          recommendedModel: stats.recommendedModel,
          h2hGrid: stats.h2hGrid as object,
          hasUpcoming: stats.hasUpcoming,
          isActive: stats.isActive,
          lastRolledAt: new Date(),
        },
      })
      rolled++
    } catch (e) {
      errors++
      console.error(`[Team Stats Roll] Failed for ${identity.name} (${identity.externalTeamId}):`, e)
    }
  }

  return {
    candidateCount: candidates.length,
    rolled,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
  }
}
