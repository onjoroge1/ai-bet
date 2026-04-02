import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'
import { TwitterGenerator } from '@/lib/social/twitter-generator'
import { buildSocialUrl } from '@/lib/social/url-utils'

export const maxDuration = 60

/**
 * GET /api/admin/social/summary/evening
 * Cron: 0 22 * * * (10 PM UTC daily)
 *
 * Generates an evening results recap with daily hit rate.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check duplicate
    const existing = await prisma.socialMediaPost.findFirst({
      where: { postType: 'evening_recap', platform: 'twitter', createdAt: { gte: today } },
    })
    if (existing) {
      return NextResponse.json({ success: true, message: 'Already posted evening recap today', skipped: true })
    }

    // Get today's finished matches with predictions
    const matches = await prisma.marketMatch.findMany({
      where: { status: 'FINISHED', kickoffDate: { gte: today }, finalResult: { not: undefined } },
      include: {
        quickPurchases: { where: { isActive: true }, take: 1, select: { predictionType: true, confidenceScore: true } },
      },
      take: 30,
    })

    const predicted = matches.filter(m => m.quickPurchases[0]?.predictionType)
    if (predicted.length === 0) {
      return NextResponse.json({ success: true, message: 'No finished matches with predictions today', skipped: true })
    }

    let correct = 0
    for (const m of predicted) {
      const result = m.finalResult as any
      const scoreH = result?.score?.home ?? 0
      const scoreA = result?.score?.away ?? 0
      const actual = scoreH > scoreA ? 'home' : scoreA > scoreH ? 'away' : 'draw'
      const pred = m.quickPurchases[0]?.predictionType
      const predNorm = pred === 'home_win' ? 'home' : pred === 'away_win' ? 'away' : pred
      if (predNorm === actual) correct++
    }

    const total = predicted.length
    const pct = Math.round((correct / total) * 100)

    let content = `Today's scorecard: ${correct}/${total} correct (${pct}%)\n\n${pct >= 60 ? 'Solid day for the model.' : pct >= 50 ? 'Mixed results but still profitable.' : 'Tough day. Football always surprises.'}\n\nFull results`

    try {
      const humanized = await TwitterGenerator.humanizePost(content)
      if (humanized && humanized.length <= 256) content = humanized
    } catch { /* keep template */ }

    await prisma.socialMediaPost.create({
      data: {
        platform: 'twitter',
        postType: 'evening_recap',
        templateId: 'evening-recap',
        content,
        url: buildSocialUrl('/sports'),
        imageUrl: '/api/social/images/daily-summary?type=evening&format=twitter',
        imageFormat: 'twitter',
        scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
        status: 'scheduled',
      },
    })

    logger.info('[Evening Recap] Created evening recap post', {
      tags: ['social', 'summary', 'evening'],
      data: { correct, total, pct },
    })

    return NextResponse.json({ success: true, correct, total, pct })
  } catch (error) {
    logger.error('[Evening Recap] Failed', { tags: ['social', 'summary', 'error'], error: error instanceof Error ? error : undefined })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
