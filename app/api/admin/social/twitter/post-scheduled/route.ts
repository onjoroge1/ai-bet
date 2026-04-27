import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'
import { postTweet, postTweetWithMedia, isTwitterConfigured } from '@/lib/social/twitter-client'
import { postViaOpenTweet, isOpenTweetConfigured } from '@/lib/social/opentweet-client'
import { postTweetViaLate, postToAllPlatforms, isLateConfigured } from '@/lib/social/late-client'
import { getProductionBaseUrl } from '@/lib/social/url-utils'

/**
 * GET /api/admin/social/twitter/post-scheduled - Post scheduled Twitter posts (for cron jobs)
 * 
 * This endpoint is called by Vercel Cron to actually post scheduled tweets to Twitter.
 * It uses CRON_SECRET for authentication.
 * 
 * Schedule: Every 15-30 minutes
 * 
 * Posts scheduled tweets to Twitter using the Twitter API v2.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret — must be set in environment, no hardcoded fallback
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      logger.error('🕐 CRON: CRON_SECRET env var not set — cannot authenticate cron jobs', {
        tags: ['api', 'admin', 'social', 'twitter', 'cron', 'security'],
      })
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('🕐 CRON: Unauthorized Twitter posting attempt', {
        tags: ['api', 'admin', 'social', 'twitter', 'cron', 'security'],
        data: { hasAuthHeader: !!authHeader, secretLength: cronSecret.length },
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

    // Check posting method: Late.dev (multi-platform) > OpenTweet (X only) > Twitter API
    const useLate = isLateConfigured()
    const useOpenTweet = !useLate && isOpenTweetConfigured()
    const useTwitter = !useLate && !useOpenTweet && isTwitterConfigured()

    if (!useLate && !useOpenTweet && !useTwitter) {
      logger.warn('🕐 CRON: No posting method configured', {
        tags: ['api', 'admin', 'social', 'twitter', 'cron', 'warning'],
      })
      return NextResponse.json({
        success: false,
        message: 'No posting method configured. Set LATE_API_KEY, OPENTWEET_API_KEY, or Twitter API credentials.',
        posted: 0,
        failed: scheduledPosts.length,
      })
    }

    const postingMethod = useLate ? 'Late.dev (multi-platform)' : useOpenTweet ? 'OpenTweet' : 'Twitter API'
    logger.info(`🕐 CRON: Using ${postingMethod} for posting`, {
      tags: ['api', 'admin', 'social', 'twitter', 'cron'],
    })

    let posted = 0
    let failed = 0
    let rateLimitHit = false
    const errors: string[] = []

    for (const post of scheduledPosts) {
      // Stop processing if rate limit was hit
      if (rateLimitHit) {
        logger.info('🕐 CRON: Rate limit hit, skipping remaining posts', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron'],
          data: { remainingPosts: scheduledPosts.length - posted - failed },
        })
        break
      }

      try {
        // Build tweet text (content + URL if available)
        // Twitter counts URLs as 23 chars, but OpenTweet uses actual length
        // Truncate content to fit within 280 chars total
        let tweetContent = post.content
        const urlSuffix = post.url ? ` ${post.url}` : ''
        const maxContentLen = 280 - urlSuffix.length
        if (tweetContent.length > maxContentLen) {
          tweetContent = tweetContent.substring(0, maxContentLen - 3).trimEnd() + '...'
        }
        const tweetText = tweetContent + urlSuffix

        let tweetId: string

        if (useLate) {
          // ── Late.dev (multi-platform — posts to ALL connected platforms) ──
          try {
            // Build image URL if available
            let mediaUrl: string | undefined
            if (post.imageUrl) {
              const baseUrl = getProductionBaseUrl()
              mediaUrl = `${baseUrl}${post.imageUrl}`
            }

            const { postId: zernioPostId, posted: postedPlatforms, failed: failedPlatforms } = await postToAllPlatforms(
              tweetText,
              {
                twitterText: tweetText.length > 280 ? tweetText.substring(0, 277) + '...' : tweetText,
                mediaUrl,
                publishNow: true,
              }
            )

            tweetId = zernioPostId
            logger.info('🕐 CRON: Posted via Late.dev to multiple platforms', {
              tags: ['api', 'admin', 'social', 'late', 'cron'],
              data: { postId: post.id, zernioPostId, postedPlatforms, failedPlatforms },
            })
          } catch (lateError) {
            // Fallback to OpenTweet or Twitter if Late.dev fails
            logger.warn('🕐 CRON: Late.dev failed, trying fallback', {
              tags: ['api', 'admin', 'social', 'late', 'cron', 'fallback'],
              data: { error: lateError instanceof Error ? lateError.message : String(lateError) },
            })
            if (isOpenTweetConfigured()) {
              tweetId = await postViaOpenTweet(tweetText)
            } else if (isTwitterConfigured()) {
              tweetId = await postTweet(tweetText)
            } else {
              throw lateError
            }
          }
        } else if (useOpenTweet) {
          // ── OpenTweet (X only) ──
          tweetId = await postViaOpenTweet(tweetText)
        } else if (post.imageUrl && useTwitter) {
          // ── Twitter API with image ──
          try {
            const baseUrl = getProductionBaseUrl()
            const imgRes = await fetch(`${baseUrl}${post.imageUrl}`, {
              signal: AbortSignal.timeout(15000),
            })
            if (imgRes.ok) {
              const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
              tweetId = await postTweetWithMedia(tweetText, imgBuffer)
              logger.info('🕐 CRON: Posted tweet WITH image via Twitter API', {
                tags: ['api', 'admin', 'social', 'twitter', 'cron', 'media'],
                data: { postId: post.id, imageSize: imgBuffer.length },
              })
            } else {
              tweetId = await postTweet(tweetText)
            }
          } catch (imgError) {
            logger.warn('🕐 CRON: Media upload failed, posting text-only', {
              tags: ['api', 'admin', 'social', 'twitter', 'cron', 'media', 'fallback'],
              data: { postId: post.id, error: imgError instanceof Error ? imgError.message : String(imgError) },
            })
            tweetId = await postTweet(tweetText)
          }
        } else {
          // ── Twitter API text-only ──
          tweetId = await postTweet(tweetText)
        }

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
        logger.info('🕐 CRON: Twitter post published successfully', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron'],
          data: {
            postId: post.id,
            tweetId,
            templateId: post.templateId,
            postType: post.postType,
            textLength: tweetText.length,
            hasImage: !!post.imageUrl,
          },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Check for specific Twitter API errors
        if (error instanceof Error) {
          // Rate limit exceeded (429)
          if (error.message.includes('429') || error.message.toLowerCase().includes('rate limit')) {
            logger.warn('🕐 CRON: Twitter API rate limit exceeded', {
              tags: ['api', 'admin', 'social', 'twitter', 'cron', 'rate-limit'],
              data: { postId: post.id },
            })
            rateLimitHit = true
            // Don't mark as failed, just stop processing
            break
          }
          
          // Authentication errors (401)
          if (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized') || error.message.toLowerCase().includes('authentication')) {
            logger.error('🕐 CRON: Twitter API authentication failed', {
              tags: ['api', 'admin', 'social', 'twitter', 'cron', 'error', 'auth'],
              error: error instanceof Error ? error : undefined,
              data: { postId: post.id },
            })
            rateLimitHit = true // Stop processing on auth errors
            errors.push(`Post ${post.id}: Authentication failed - check Twitter API credentials`)
            break
          }
          
          // Forbidden (403) - account suspended or no permissions
          if (error.message.includes('403') || error.message.toLowerCase().includes('forbidden')) {
            logger.error('🕐 CRON: Twitter API forbidden (403)', {
              tags: ['api', 'admin', 'social', 'twitter', 'cron', 'error'],
              error: error instanceof Error ? error : undefined,
              data: { postId: post.id },
            })
            rateLimitHit = true // Stop processing on forbidden errors
            errors.push(`Post ${post.id}: Forbidden - account may be suspended or app lacks write permissions`)
            break
          }
        }
        
        failed++
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

    // ── Retry failed posts (max 3 retries, 15 min cooldown) ──
    let retried = 0
    if (!rateLimitHit && (hourPosts + posted) < 5 && (dayPosts + posted) < 30) {
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000)
      const retrySlots = Math.min(2, 5 - (hourPosts + posted), 30 - (dayPosts + posted))

      const failedPosts = await prisma.socialMediaPost.findMany({
        where: {
          platform: 'twitter',
          status: 'failed',
          retryCount: { lt: 3 },
          OR: [
            { lastRetryAt: null },
            { lastRetryAt: { lt: fifteenMinAgo } },
          ],
        },
        orderBy: { scheduledAt: 'asc' },
        take: retrySlots,
      })

      for (const post of failedPosts) {
        if (rateLimitHit) break
        try {
          const tweetText = post.content + (post.url ? ` ${post.url}` : '')
          const tweetId = await postTweet(tweetText)

          await prisma.socialMediaPost.update({
            where: { id: post.id },
            data: {
              status: 'posted',
              postedAt: new Date(),
              postId: tweetId,
              errorMessage: null,
              retryCount: post.retryCount + 1,
              lastRetryAt: new Date(),
            },
          })
          retried++
          logger.info('🕐 CRON: Retried post published successfully', {
            tags: ['api', 'admin', 'social', 'twitter', 'cron', 'retry'],
            data: { postId: post.id, tweetId, attempt: post.retryCount + 1 },
          })
        } catch (retryError) {
          await prisma.socialMediaPost.update({
            where: { id: post.id },
            data: {
              retryCount: post.retryCount + 1,
              lastRetryAt: new Date(),
              errorMessage: (retryError instanceof Error ? retryError.message : 'Unknown error').substring(0, 500),
            },
          })
          logger.warn('🕐 CRON: Retry failed', {
            tags: ['api', 'admin', 'social', 'twitter', 'cron', 'retry', 'error'],
            data: { postId: post.id, attempt: post.retryCount + 1 },
          })
        }
      }
    }

    const duration = Date.now() - startTime

    logger.info('🕐 CRON: Twitter posting completed', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron'],
      data: {
        posted,
        failed,
        retried,
        duration: `${duration}ms`,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Twitter posting completed',
      summary: {
        posted,
        failed,
        retried,
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

