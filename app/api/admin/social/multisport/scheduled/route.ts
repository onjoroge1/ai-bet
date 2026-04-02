import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'
import { TwitterGenerator } from '@/lib/social/twitter-generator'
import { buildSocialUrl } from '@/lib/social/url-utils'

export const maxDuration = 60

const SPORTS = [
  { key: 'basketball_nba', name: 'NBA', emoji: '🏀', threshold: 0.80 },
  { key: 'icehockey_nhl', name: 'NHL', emoji: '🏒', threshold: 0.85 },
  { key: 'basketball_ncaab', name: 'NCAAB', emoji: '🏀', threshold: 0.75 },
]

/**
 * GET /api/admin/social/multisport/scheduled
 * Cron: 0 4 * * * (4 AM UTC daily)
 *
 * Generates social posts for NBA, NHL, NCAAB matches with high-confidence picks.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let totalCreated = 0
    const results: Record<string, number> = {}

    for (const sport of SPORTS) {
      try {
        const matches = await prisma.multisportMatch.findMany({
          where: {
            sport: sport.key,
            status: 'upcoming',
            commenceTime: { gte: new Date() },
          },
          orderBy: { commenceTime: 'asc' },
          take: 20,
        })

        // Filter high-confidence picks
        const highConf = matches.filter(m => {
          const model = (m.model as any) || {}
          const preds = model.predictions || model
          return (preds.confidence || 0) >= sport.threshold
        })

        let created = 0
        for (const m of highConf.slice(0, 3)) { // Max 3 per sport
          const model = (m.model as any) || {}
          const preds = model.predictions || model
          const conf = Math.round((preds.confidence || 0) * 100)
          const pick = preds.pick === 'H' ? m.homeTeam : m.awayTeam
          const odds = (m.odds as any) || {}
          const spread = odds.consensus?.home_spread

          // Check for existing post
          const existing = await prisma.socialMediaPost.findFirst({
            where: { matchId: m.eventId, platform: 'twitter', postType: 'multisport_preview' },
          })
          if (existing) continue

          let content = `${sport.emoji} ${m.homeTeam} vs ${m.awayTeam}\n\nModel pick: ${pick} (${conf}% confidence)${spread ? `\nSpread: ${spread > 0 ? '+' : ''}${spread}` : ''}`

          try {
            const humanized = await TwitterGenerator.humanizePost(content)
            if (humanized && humanized.length <= 256) content = humanized
          } catch { /* keep template */ }

          const slugH = m.homeTeam.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          const slugA = m.awayTeam.toLowerCase().replace(/[^a-z0-9]+/g, '-')

          await prisma.socialMediaPost.create({
            data: {
              platform: 'twitter',
              postType: 'multisport_preview',
              templateId: `${sport.name.toLowerCase()}-auto`,
              content,
              url: buildSocialUrl(`/sports/${sport.key}/${m.eventId}`),
              matchId: m.eventId,
              scheduledAt: new Date(Date.now() + ((totalCreated + 1) * 20 * 60 * 1000)), // Stagger 20 min
              status: 'scheduled',
            },
          })
          created++
          totalCreated++
        }
        results[sport.name] = created
      } catch (err) {
        logger.warn(`[Multisport Social] Error processing ${sport.name}`, {
          tags: ['social', 'multisport', 'error'],
        })
        results[sport.name] = 0
      }
    }

    logger.info('[Multisport Social] Generated posts', {
      tags: ['social', 'multisport'],
      data: { results, totalCreated },
    })

    return NextResponse.json({ success: true, results, totalCreated })
  } catch (error) {
    logger.error('[Multisport Social] Failed', { tags: ['social', 'multisport', 'error'], error: error instanceof Error ? error : undefined })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
