import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'
import { generateResultPosts } from '@/lib/social/result-generator'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'

export const maxDuration = 60

/**
 * GET /api/admin/social/results/scheduled
 *
 * Cron job (every 30 min) that generates result posts for finished matches.
 * Posts are scheduled with 15-min stagger and picked up by post-scheduled cron.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  let hb: HeartbeatToken | null = null

  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    hb = await beginCron('social:results')

    logger.info('[Results Cron] Starting result post generation', {
      tags: ['social', 'results', 'cron'],
    })

    const resultPosts = await generateResultPosts(8)

    let created = 0
    for (let i = 0; i < resultPosts.length; i++) {
      const post = resultPosts[i]
      try {
        // Stagger scheduling by 15 minutes each
        const scheduledAt = new Date(Date.now() + (i * 15 * 60 * 1000) + (5 * 60 * 1000))

        await prisma.socialMediaPost.create({
          data: {
            platform: 'twitter',
            postType: post.postType,
            templateId: 'result-auto',
            content: post.content,
            url: post.url,
            matchId: post.matchId,
            marketMatchId: post.marketMatchId,
            imageUrl: post.imageUrl,
            imageFormat: 'twitter',
            scheduledAt,
            status: 'scheduled',
          },
        })
        created++
      } catch (error) {
        logger.warn('[Results Cron] Failed to create result post', {
          tags: ['social', 'results', 'cron', 'error'],
          data: { matchId: post.matchId },
        })
      }
    }

    const duration = Date.now() - startTime
    logger.info('[Results Cron] Completed', {
      tags: ['social', 'results', 'cron'],
      data: { found: resultPosts.length, created, duration: `${duration}ms` },
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: created })

    return NextResponse.json({
      success: true,
      found: resultPosts.length,
      created,
      duration: `${duration}ms`,
    })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Results Cron] Failed', {
      tags: ['social', 'results', 'cron', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
