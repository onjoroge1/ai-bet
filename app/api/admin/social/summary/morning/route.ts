import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'
import { TwitterGenerator } from '@/lib/social/twitter-generator'
import { buildSocialUrl } from '@/lib/social/url-utils'

export const maxDuration = 60

/**
 * GET /api/admin/social/summary/morning
 * Cron: 0 9 * * * (9 AM UTC daily)
 *
 * Generates a "Today's Top Picks" summary tweet with image.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if we already posted a morning summary today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const existing = await prisma.socialMediaPost.findFirst({
      where: { postType: 'morning_summary', platform: 'twitter', createdAt: { gte: today } },
    })
    if (existing) {
      return NextResponse.json({ success: true, message: 'Already posted morning summary today', skipped: true })
    }

    // Get top 5 upcoming matches by confidence
    const matches = await prisma.marketMatch.findMany({
      where: { status: 'UPCOMING', kickoffDate: { gte: new Date() } },
      include: {
        quickPurchases: { where: { isActive: true }, take: 1, select: { confidenceScore: true, predictionType: true } },
      },
      take: 50,
    })

    const topPicks = matches
      .filter(m => m.quickPurchases[0]?.confidenceScore && m.quickPurchases[0].confidenceScore >= 50)
      .sort((a, b) => (b.quickPurchases[0]?.confidenceScore ?? 0) - (a.quickPurchases[0]?.confidenceScore ?? 0))
      .slice(0, 5)

    if (topPicks.length === 0) {
      return NextResponse.json({ success: true, message: 'No high-confidence picks today', skipped: true })
    }

    // Generate content
    const pickLines = topPicks.map((m, i) => {
      const qp = m.quickPurchases[0]
      const conf = qp?.confidenceScore ?? 0
      return `${i + 1}. ${m.homeTeam} vs ${m.awayTeam} (${conf}%)`
    }).join('\n')

    let content = `Today's top picks:\n${pickLines}\n\nAll predictions live`

    // Humanize
    try {
      const humanized = await TwitterGenerator.humanizePost(content)
      if (humanized && humanized.length <= 256) content = humanized
    } catch { /* keep template */ }

    // Create post
    await prisma.socialMediaPost.create({
      data: {
        platform: 'twitter',
        postType: 'morning_summary',
        templateId: 'morning-summary',
        content,
        url: buildSocialUrl('/sports'),
        imageUrl: '/api/social/images/daily-summary?type=morning&format=twitter',
        imageFormat: 'twitter',
        scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
        status: 'scheduled',
      },
    })

    logger.info('[Morning Summary] Created morning picks post', {
      tags: ['social', 'summary', 'morning'],
      data: { picks: topPicks.length },
    })

    return NextResponse.json({ success: true, picks: topPicks.length })
  } catch (error) {
    logger.error('[Morning Summary] Failed', { tags: ['social', 'summary', 'error'], error: error instanceof Error ? error : undefined })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
