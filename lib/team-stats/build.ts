/**
 * Shared logic between the team-stats roll-up cron and the one-shot
 * backfill script. Given a slice of MarketMatch rows + an externalTeamId,
 * computes a complete TeamStats payload ready for upsert.
 *
 * Pure (no DB writes) — callers handle persistence.
 */
import type { Prisma } from '@prisma/client'
import {
  aggregateGoalStats,
  encodeForm,
  modelAccuracyForTeam,
  recommendedModelForTeam,
  buildH2HGrid,
  teamSideIn,
  type TeamMatchRow,
} from './rollup'
import { makeTeamSlug } from './slug'

export interface TeamIdentity {
  externalTeamId: string
  name: string
  league: string | null
  country: string | null
  logoUrl: string | null
}

export interface BuiltTeamStats {
  slug: string
  externalTeamId: string
  name: string
  league: string | null
  country: string | null
  logoUrl: string | null

  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  bttsCount: number
  over25Count: number
  homeGoalsFor: Prisma.Decimal | null
  awayGoalsFor: Prisma.Decimal | null

  formLast10: string

  v1ModelAccuracy: Prisma.Decimal | null
  v1ModelSampleN: number | null
  v3ModelAccuracy: Prisma.Decimal | null
  v3ModelSampleN: number | null
  recommendedModel: string | null

  h2hGrid: Prisma.JsonValue
  leaguePosition: number | null
  hasUpcoming: boolean
  isActive: boolean
}

/**
 * Build a single TeamStats payload. Caller already filtered MatchRow[] to
 * matches involving the team, and already knows hasUpcoming.
 */
export function buildTeamStats(
  identity: TeamIdentity,
  matches: TeamMatchRow[],
  hasUpcoming: boolean,
): BuiltTeamStats {
  // Some MarketMatch rows might have empty homeTeamId — filter defensively
  const validMatches = matches.filter(m => teamSideIn(m, identity.externalTeamId) !== null)

  const goalStats = aggregateGoalStats(validMatches, identity.externalTeamId)
  const formLast10 = encodeForm(validMatches, identity.externalTeamId, 10)
  const v1 = modelAccuracyForTeam(validMatches, identity.externalTeamId, 'v1', 30)
  const v3 = modelAccuracyForTeam(validMatches, identity.externalTeamId, 'v3', 30)
  const recommendedModel = recommendedModelForTeam(v1, v3)
  const h2hGrid = buildH2HGrid(validMatches, identity.externalTeamId, 5)

  const slug = makeTeamSlug(identity.name, identity.externalTeamId)

  // Decimal helper — Prisma Decimal fields accept strings/numbers
  const toDec = (n: number | null | undefined): Prisma.Decimal | null => {
    if (n === null || n === undefined) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return n.toString() as unknown as Prisma.Decimal
  }

  return {
    slug,
    externalTeamId: identity.externalTeamId,
    name: identity.name,
    league: identity.league,
    country: identity.country,
    logoUrl: identity.logoUrl,

    matchesPlayed: goalStats.matchesPlayed,
    wins: goalStats.wins,
    draws: goalStats.draws,
    losses: goalStats.losses,
    goalsFor: goalStats.goalsFor,
    goalsAgainst: goalStats.goalsAgainst,
    bttsCount: goalStats.bttsCount,
    over25Count: goalStats.over25Count,
    homeGoalsFor: toDec(goalStats.homeGoalsFor),
    awayGoalsFor: toDec(goalStats.awayGoalsFor),

    formLast10,

    v1ModelAccuracy: toDec(v1?.accuracy ?? null),
    v1ModelSampleN: v1?.sampleN ?? null,
    v3ModelAccuracy: toDec(v3?.accuracy ?? null),
    v3ModelSampleN: v3?.sampleN ?? null,
    recommendedModel,

    h2hGrid: h2hGrid as unknown as Prisma.JsonValue,
    leaguePosition: null, // not currently scraped
    hasUpcoming,
    isActive: true,
  }
}

/**
 * Qualification gate — applied by the cron and the backfill script
 * uniformly. A team qualifies for a live page if:
 *   1. externalTeamId is non-empty
 *   2. ≥10 FINISHED matches with v1Model or v3Model in last 365d
 *   3. ≥1 UPCOMING match in next 30d OR ≥1 FINISHED in last 14d
 */
export const QUALIFICATION = {
  MIN_HISTORICAL_MATCHES: 10,
  HISTORY_WINDOW_DAYS: 365,
  UPCOMING_WINDOW_DAYS: 30,
  RECENT_WINDOW_DAYS: 14,
}
