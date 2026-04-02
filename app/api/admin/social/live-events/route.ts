import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'
import { buildSocialUrl } from '@/lib/social/url-utils'
import { generateMatchSlug } from '@/lib/match-slug'

export const maxDuration = 30

/**
 * GET /api/admin/social/live-events
 * Cron: (every 2 min) — posts for goals and red cards during live matches
 *
 * NO LLM humanization — speed matters for live events.
 * Posts are created with scheduledAt = now for immediate posting.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: max 1 live post per 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentLivePost = await prisma.socialMediaPost.findFirst({
      where: {
        postType: { in: ['live_goal', 'live_red_card'] },
        platform: 'twitter',
        createdAt: { gte: fiveMinAgo },
      },
    })
    if (recentLivePost) {
      return NextResponse.json({ success: true, message: 'Rate limited — last live post < 5 min ago', skipped: true })
    }

    // Find untweeted events (goals and red cards only)
    const events = await prisma.matchEvent.findMany({
      where: {
        tweetGenerated: false,
        eventType: { in: ['goal', 'red_card'] },
      },
      include: { marketMatch: { select: { homeTeam: true, awayTeam: true, league: true, matchId: true } } },
      orderBy: { createdAt: 'asc' },
      take: 3,
    })

    if (events.length === 0) {
      return NextResponse.json({ success: true, message: 'No untweeted events', posted: 0 })
    }

    let posted = 0
    for (const event of events) {
      const m = event.marketMatch
      if (!m) continue

      let content = ''
      const postType = event.eventType === 'goal' ? 'live_goal' : 'live_red_card'

      if (event.eventType === 'goal') {
        const scoringTeam = event.team === 'home' ? m.homeTeam : m.awayTeam
        content = `GOAL! ${scoringTeam} score!\n\n${m.homeTeam} ${event.scoreHome ?? '?'}-${event.scoreAway ?? '?'} ${m.awayTeam} (${event.minute}')`
      } else if (event.eventType === 'red_card') {
        const cardTeam = event.team === 'home' ? m.homeTeam : m.awayTeam
        content = `RED CARD in ${m.homeTeam} vs ${m.awayTeam} (${event.minute}')\n\n${cardTeam} down to 10 men`
      }

      if (!content) continue

      const slug = `${generateMatchSlug(m.homeTeam, m.awayTeam)}-${m.matchId}`
      const url = buildSocialUrl(`/match/${slug}`)

      try {
        const post = await prisma.socialMediaPost.create({
          data: {
            platform: 'twitter',
            postType,
            templateId: `live-${event.eventType}`,
            content,
            url,
            matchId: m.matchId,
            marketMatchId: event.marketMatchId,
            scheduledAt: new Date(), // Immediate
            status: 'scheduled',
          },
        })

        // Mark event as tweeted
        await prisma.matchEvent.update({
          where: { id: event.id },
          data: { tweetGenerated: true, socialPostId: post.id },
        })

        posted++
        logger.info('[Live Events] Created live event post', {
          tags: ['social', 'live', event.eventType],
          data: { matchId: m.matchId, minute: event.minute, team: event.team },
        })
      } catch (err) {
        logger.warn('[Live Events] Failed to create post', {
          tags: ['social', 'live', 'error'],
          data: { eventId: event.id },
        })
      }

      // Only post 1 event per cron run (rate limiting)
      break
    }

    return NextResponse.json({ success: true, posted, pending: events.length - posted })
  } catch (error) {
    logger.error('[Live Events] Failed', { tags: ['social', 'live', 'error'], error: error instanceof Error ? error : undefined })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
