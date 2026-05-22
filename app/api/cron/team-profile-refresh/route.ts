import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'
import { logger } from '@/lib/logger'
import { generateTeamProfile, type TeamProfileInputs } from '@/lib/team-stats/profile-prompt'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 min — capped at 20 generations/run

/**
 * GET/POST /api/cron/team-profile-refresh
 *
 * Daily 05:00 UTC. Finds TeamProfile rows with refreshDueAt in the past,
 * AND TeamStats rows that have no profile yet, regenerates up to N per
 * run via the gpt-4o team-profile prompt. Spend-bounded.
 *
 * 1,600 calls/year budget (400 teams × 4 quarterly refreshes) → ~$20/year
 * at gpt-4o pricing for ~600 input + ~600 output tokens. Hard cap below
 * keeps any single day from blowing up if a backlog accumulates.
 *
 * Heartbeat: team-stats:profile (1d).
 * Auth: Bearer CRON_SECRET.
 */
const MAX_PER_RUN = 20

async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let hb: HeartbeatToken | null = null
  try {
    hb = await beginCron('team-stats:profile')
    const now = new Date()

    // Two candidate sources, prioritised:
    //   1. TeamStats rows with NO TeamProfile yet (first-time generation)
    //   2. TeamProfile rows where refreshDueAt < now (quarterly refresh)
    const teamsWithoutProfile = await prisma.teamStats.findMany({
      where: {
        isActive: true,
        hasUpcoming: true,    // only spend tokens on teams users will actually visit
        TeamProfile: { is: null } as never,  // Prisma doesn't auto-generate this relation; raw filter below
      } as never,
      take: MAX_PER_RUN,
      orderBy: { matchesPlayed: 'desc' },
    }).catch(() => [])  // if the relation filter isn't supported, fall back

    // Fallback: manually find missing profiles
    let candidates: typeof teamsWithoutProfile = teamsWithoutProfile
    if (candidates.length === 0) {
      const allActive = await prisma.teamStats.findMany({
        where: { isActive: true, hasUpcoming: true },
        orderBy: { matchesPlayed: 'desc' },
        take: 200,
      })
      const existingProfiles = await prisma.teamProfile.findMany({
        where: { slug: { in: allActive.map(t => t.slug) } },
        select: { slug: true, refreshDueAt: true },
      })
      const existingMap = new Map(existingProfiles.map(p => [p.slug, p.refreshDueAt]))
      candidates = allActive
        .filter(t => {
          const due = existingMap.get(t.slug)
          // No profile yet, OR profile is due for refresh
          return !due || due < now
        })
        .slice(0, MAX_PER_RUN)
    }

    let generated = 0
    let cached = 0
    let errors = 0
    for (const t of candidates) {
      try {
        // Build inputs from TeamStats
        const h2h = (t.h2hGrid as Array<{ opponent: string; wins: number; draws: number; losses: number }>) || []
        const inputs: TeamProfileInputs = {
          name: t.name,
          sport: t.sport,
          homeWinRatePct: t.sport !== 'soccer' && t.homeGoalsFor !== null ? Number(t.homeGoalsFor) : null,
          awayWinRatePct: t.sport !== 'soccer' && t.awayGoalsFor !== null ? Number(t.awayGoalsFor) : null,
          league: t.league,
          country: t.country,
          matchesPlayed: t.matchesPlayed,
          wins: t.wins,
          draws: t.draws,
          losses: t.losses,
          goalsFor: t.goalsFor,
          goalsAgainst: t.goalsAgainst,
          bttsCount: t.bttsCount,
          over25Count: t.over25Count,
          formLast10: t.formLast10,
          v1ModelAccuracy: t.v1ModelAccuracy ? Number(t.v1ModelAccuracy) : null,
          v1ModelSampleN: t.v1ModelSampleN,
          v3ModelAccuracy: t.v3ModelAccuracy ? Number(t.v3ModelAccuracy) : null,
          v3ModelSampleN: t.v3ModelSampleN,
          recommendedModel: (t.recommendedModel as 'v1' | 'v3' | null),
          h2hTopOpponents: h2h.slice(0, 5).map(o => ({
            opponent: o.opponent,
            wins: o.wins,
            draws: o.draws,
            losses: o.losses,
          })),
        }

        const result = await generateTeamProfile(inputs)
        if (result.cached) cached++

        const refreshedAt = new Date()
        const refreshDueAt = new Date(refreshedAt.getTime() + 90 * 86400 * 1000)

        await prisma.teamProfile.upsert({
          where: { slug: t.slug },
          create: {
            slug: t.slug,
            externalTeamId: t.externalTeamId,
            profileHtml: result.html,
            prompt: result.prompt,
            modelUsed: 'gpt-4o',
            refreshedAt,
            refreshDueAt,
            version: 1,
          },
          update: {
            profileHtml: result.html,
            prompt: result.prompt,
            refreshedAt,
            refreshDueAt,
            version: { increment: 1 },
          },
        })
        generated++
      } catch (e) {
        errors++
        logger.error(`[Team Profile Refresh] Failed for ${t.slug}`, {
          tags: ['team-stats', 'profile', 'cron', 'error'],
          error: e instanceof Error ? e : undefined,
        })
      }
    }

    logger.info(`[Team Profile Refresh] ${generated} generated (${cached} from cache), ${errors} errors`, {
      tags: ['team-stats', 'profile', 'cron'],
      data: { generated, cached, errors, candidateCount: candidates.length },
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: generated })
    return NextResponse.json({
      success: true,
      generated, cached, errors,
      candidateCount: candidates.length,
      cap: MAX_PER_RUN,
    })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Team Profile Refresh] Failed', {
      tags: ['team-stats', 'profile', 'cron', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }
