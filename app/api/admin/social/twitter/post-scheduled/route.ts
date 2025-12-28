import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'

/**
 * GET /api/admin/social/twitter/post-scheduled - Post scheduled Twitter posts (for cron jobs)
 * 
 * This endpoint is called by Vercel Cron to actually post scheduled tweets to Twitter.
 * It uses CRON_SECRET for authentication.
 * 
 * Schedule: Every 15-30 minutes
 * 
 * NOTE: This requires Twitter API integration. For now, it just marks posts as "posted"
 * In production, you'll need to integrate with Twitter API v2.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('🕐 CRON: Unauthorized Twitter posting attempt', {
        tags: ['api', 'admin', 'social', 'twitter', 'cron', 'security'],
        data: { hasAuthHeader: !!authHeader },
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check rate limits
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Check hourly limit (max 5 posts per hour)
    const hourPosts = await prisma.socialMediaPost.count({
      where: {
        platform: 'twitter',
        status: 'posted',
        postedAt: { gte: oneHourAgo },
      },
    })

    if (hourPosts >= 5) {
      logger.info('🕐 CRON: Hourly rate limit reached, skipping', {
        tags: ['api', 'admin', 'social', 'twitter', 'cron'],
        data: { hourPosts },
      })
      return NextResponse.json({
        success: true,
        message: 'Rate limit reached',
        posted: 0,
        skipped: 0,
      })
    }

    // Check daily limit (max 30 posts per day)
    const dayPosts = await prisma.socialMediaPost.count({
      where: {
        platform: 'twitter',
        status: 'posted',
        postedAt: { gte: oneDayAgo },
      },
    })

    if (dayPosts >= 30) {
      logger.info('🕐 CRON: Daily rate limit reached, skipping', {
        tags: ['api', 'admin', 'social', 'twitter', 'cron'],
        data: { dayPosts },
      })
      return NextResponse.json({
        success: true,
        message: 'Daily rate limit reached',
        posted: 0,
        skipped: 0,
      })
    }

    // Get scheduled posts ready to post
    const scheduledPosts = await prisma.socialMediaPost.findMany({
      where: {
        platform: 'twitter',
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: Math.min(5, 30 - dayPosts, 5 - hourPosts), // Respect rate limits
    })

    logger.info('🕐 CRON: Found scheduled posts to publish', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron'],
      data: { count: scheduledPosts.length },
    })

    let posted = 0
    let failed = 0
    const errors: string[] = []

    for (const post of scheduledPosts) {
      try {
        // TODO: Integrate with Twitter API v2 here
        // For now, we'll simulate posting
        // In production, use: await twitterClient.v2.tweet({ text: post.content + (post.url ? ` ${post.url}` : '') })
        
        // Simulate Twitter API call
        const tweetId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`
        
        // Update post status
        await prisma.socialMediaPost.update({
          where: { id: post.id },
          data: {
            status: 'posted',
            postedAt: new Date(),
            postId: tweetId,
          },
        })

        posted++
        logger.info('🕐 CRON: Twitter post published', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron'],
          data: {
            postId: post.id,
            tweetId,
            templateId: post.templateId,
            postType: post.postType,
          },
        })
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Post ${post.id}: ${errorMessage}`)
        
        await prisma.socialMediaPost.update({
          where: { id: post.id },
          data: {
            status: 'failed',
            errorMessage: errorMessage.substring(0, 500),
          },
        })

        logger.error('🕐 CRON: Error posting to Twitter', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron', 'error'],
          error: error instanceof Error ? error : undefined,
          data: { postId: post.id },
        })
      }
    }

    const duration = Date.now() - startTime

    logger.info('🕐 CRON: Twitter posting completed', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron'],
      data: {
        posted,
        failed,
        duration: `${duration}ms`,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Twitter posting completed',
      summary: {
        posted,
        failed,
        total: scheduledPosts.length,
      },
      errors: errors.slice(0, 10),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('🕐 CRON: Twitter posting failed', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { duration: `${duration}ms` },
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  }
}

