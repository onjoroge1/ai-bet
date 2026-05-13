import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { generateTeamProfile, type TeamProfileInputs } from '@/lib/team-stats/profile-prompt'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/team-profile/generate
 *
 * Manual one-team trigger for admin use — bypasses the daily cron's
 * 20/run cap. Body: { slug: string, force?: boolean }
 *
 * - If `force=false` (default), respects existing refreshDueAt
 * - If `force=true`, regenerates regardless
 *
 * Auth: admin gate via /api/admin middleware.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as
      | { slug?: string; force?: boolean } | null
    if (!body?.slug) {
      return NextResponse.json({ success: false, error: 'slug required' }, { status: 400 })
    }

    const team = await prisma.teamStats.findUnique({ where: { slug: body.slug } })
    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }

    if (!body.force) {
      const existing = await prisma.teamProfile.findUnique({ where: { slug: body.slug } })
      if (existing && existing.refreshDueAt > new Date()) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'Not yet due',
          refreshDueAt: existing.refreshDueAt,
        })
      }
    }

    const h2h = (team.h2hGrid as Array<{ opponent: string; wins: number; draws: number; losses: number }>) || []
    const inputs: TeamProfileInputs = {
      name: team.name,
      league: team.league,
      country: team.country,
      matchesPlayed: team.matchesPlayed,
      wins: team.wins,
      draws: team.draws,
      losses: team.losses,
      goalsFor: team.goalsFor,
      goalsAgainst: team.goalsAgainst,
      bttsCount: team.bttsCount,
      over25Count: team.over25Count,
      formLast10: team.formLast10,
      v1ModelAccuracy: team.v1ModelAccuracy ? Number(team.v1ModelAccuracy) : null,
      v1ModelSampleN: team.v1ModelSampleN,
      v3ModelAccuracy: team.v3ModelAccuracy ? Number(team.v3ModelAccuracy) : null,
      v3ModelSampleN: team.v3ModelSampleN,
      recommendedModel: (team.recommendedModel as 'v1' | 'v3' | null),
      h2hTopOpponents: h2h.slice(0, 5).map(o => ({
        opponent: o.opponent,
        wins: o.wins,
        draws: o.draws,
        losses: o.losses,
      })),
    }

    const result = await generateTeamProfile(inputs)

    const refreshedAt = new Date()
    const refreshDueAt = new Date(refreshedAt.getTime() + 90 * 86400 * 1000)
    await prisma.teamProfile.upsert({
      where: { slug: team.slug },
      create: {
        slug: team.slug,
        externalTeamId: team.externalTeamId,
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

    return NextResponse.json({
      success: true,
      slug: team.slug,
      cached: result.cached,
      refreshedAt,
      refreshDueAt,
    })
  } catch (error) {
    console.error('[Team Profile Generate] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
