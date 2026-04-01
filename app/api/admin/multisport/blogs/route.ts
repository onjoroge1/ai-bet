import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MultisportBlogGenerator } from '@/lib/blog/multisport-blog-generator'
import { logger } from '@/lib/logger'

export const maxDuration = 120

/**
 * GET /api/admin/multisport/blogs — List eligible matches for blog generation
 */
export async function GET(request: NextRequest) {
  try {
    // Auth: admin session or cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isCron) {
      const session = await getServerSession(authOptions)
      if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') || undefined

    const eligible = await MultisportBlogGenerator.getEligibleMatches(sport)

    return NextResponse.json({
      success: true,
      eligible: eligible.length,
      matches: eligible.map(m => ({
        eventId: m.eventId,
        sport: m.sport,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league,
        commenceTime: m.commenceTime,
        hasModel: !!m.model,
        hasTeamContext: !!m.teamContext,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/multisport/blogs — Generate blogs for multisport matches
 *
 * Body: { sport?: string, limit?: number, useLLM?: boolean, eventId?: string }
 * - sport: filter to specific sport (basketball_nba, icehockey_nhl, basketball_ncaab)
 * - limit: max blogs to generate (default 10)
 * - useLLM: humanize with GPT-4o-mini (default true)
 * - eventId: generate for a single specific match
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth: admin session or cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isCron) {
      const session = await getServerSession(authOptions)
      if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json().catch(() => ({}))
    const { sport, limit = 10, useLLM = true, eventId } = body

    logger.info('[MultisportBlog] Starting blog generation', {
      tags: ['blog', 'multisport', 'generation'],
      data: { sport, limit, useLLM, eventId },
    })

    const eligible = await MultisportBlogGenerator.getEligibleMatches(sport)

    // Filter to single match if eventId specified
    const targets = eventId
      ? eligible.filter(m => m.eventId === eventId)
      : eligible.slice(0, limit)

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible matches found for blog generation',
        generated: 0,
        eligible: eligible.length,
      })
    }

    let generated = 0
    let errors = 0
    const results: Array<{ eventId: string; match: string; created: boolean; error?: string }> = []

    for (const match of targets) {
      const result = await MultisportBlogGenerator.generateAndSave(match, { useLLM })
      results.push({
        eventId: match.eventId,
        match: `${match.homeTeam} vs ${match.awayTeam}`,
        created: result.created,
        error: result.error,
      })
      if (result.created) generated++
      else errors++
    }

    const duration = Date.now() - startTime

    logger.info('[MultisportBlog] Generation complete', {
      tags: ['blog', 'multisport', 'generation'],
      data: { generated, errors, duration: `${duration}ms` },
    })

    return NextResponse.json({
      success: true,
      generated,
      errors,
      total: targets.length,
      results,
      duration: `${duration}ms`,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[MultisportBlog] Generation failed', {
      tags: ['blog', 'multisport', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', duration: `${duration}ms` },
      { status: 500 }
    )
  }
}
