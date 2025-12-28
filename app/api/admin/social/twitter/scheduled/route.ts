import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { TwitterGenerator } from '@/lib/social/twitter-generator'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

/**
 * GET /api/admin/social/twitter/scheduled - Scheduled Twitter post generation (for cron jobs)
 * 
 * This endpoint is called by Vercel Cron to automatically generate Twitter posts
 * for matches and parlays that don't have posts yet.
 * It uses CRON_SECRET for authentication instead of user sessions.
 * 
 * Schedule: Daily (after blog generation)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('🕐 CRON: Unauthorized Twitter post generation attempt', {
        tags: ['api', 'admin', 'social', 'twitter', 'cron', 'security'],
        data: { hasAuthHeader: !!authHeader },
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('🕐 CRON: Starting scheduled Twitter post generation', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron', 'generation'],
      data: { startTime: new Date(startTime).toISOString() },
    })

    const baseUrl = TwitterGenerator.getBaseUrl()
    let matchesGenerated = 0
    let parlaysGenerated = 0
    let skipped = 0
    const errors: string[] = []

    // Generate posts for matches
    const eligibleMatches = await TwitterGenerator.getEligibleMatches(50)
    
    logger.info('🕐 CRON: Found eligible matches for Twitter posting', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron'],
      data: { eligibleCount: eligibleMatches.length },
    })

    for (const match of eligibleMatches) {
      try {
        // Check if already posted
        const hasPost = await TwitterGenerator.hasExistingPostForMatch(match.matchId)
        if (hasPost) {
          skipped++
          continue
        }

        const quickPurchase = match.quickPurchases[0]
        const blogPost = match.blogPosts[0]

        const matchData = {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          league: match.league,
          matchId: match.matchId,
          aiConf: quickPurchase?.confidenceScore || undefined,
          matchUrl: `${baseUrl}/match/${match.matchId}`,
          blogUrl: blogPost ? `${baseUrl}/blog/${blogPost.slug}` : undefined,
        }

        const draft = TwitterGenerator.generateMatchPost(matchData)

        // Schedule post (default: 1 hour from now to spread out posts)
        const scheduledAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

        await prisma.socialMediaPost.create({
          data: {
            platform: 'twitter',
            postType: 'match',
            templateId: draft.templateId,
            content: draft.content,
            url: draft.url,
            matchId: match.matchId,
            marketMatchId: match.id,
            blogPostId: blogPost?.id,
            scheduledAt,
            status: 'scheduled',
          },
        })

        matchesGenerated++
        logger.info('🕐 CRON: Twitter post generated for match', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron'],
          data: { matchId: match.matchId, templateId: draft.templateId },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Match ${match.matchId}: ${errorMessage}`)
        logger.error('🕐 CRON: Error generating Twitter post for match', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron', 'error'],
          error: error instanceof Error ? error : undefined,
          data: { matchId: match.matchId },
        })
      }
    }

    // Generate posts for parlays (selectively - max 2-3 per day)
    const eligibleParlays = await TwitterGenerator.getEligibleParlays(10)
    
    // Only generate for top 2-3 parlays (by confidence/edge)
    const topParlays = eligibleParlays.slice(0, 3)

    logger.info('🕐 CRON: Found eligible parlays for Twitter posting', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron'],
      data: { eligibleCount: eligibleParlays.length, selectedCount: topParlays.length },
    })

    for (const parlay of topParlays) {
      try {
        // Check if already posted
        const hasPost = await TwitterGenerator.hasExistingPostForParlay(parlay.parlayId)
        if (hasPost) {
          skipped++
          continue
        }

        const firstLeg = parlay.legs[0]
        const parlayData = {
          parlayId: parlay.parlayId,
          parlayUrl: `${baseUrl}/dashboard/parlays/${parlay.parlayId}`,
          firstLeg: firstLeg ? {
            homeTeam: firstLeg.homeTeam,
            awayTeam: firstLeg.awayTeam,
          } : undefined,
          legCount: parlay.legCount,
        }

        const draft = TwitterGenerator.generateParlayPost(parlayData)

        // Schedule post (2 hours after match posts)
        const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000)

        await prisma.socialMediaPost.create({
          data: {
            platform: 'twitter',
            postType: 'parlay',
            templateId: draft.templateId,
            content: draft.content,
            url: draft.url,
            parlayId: parlay.parlayId,
            parlayConsensusId: parlay.id,
            scheduledAt,
            status: 'scheduled',
          },
        })

        parlaysGenerated++
        logger.info('🕐 CRON: Twitter post generated for parlay', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron'],
          data: { parlayId: parlay.parlayId, templateId: draft.templateId },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Parlay ${parlay.parlayId}: ${errorMessage}`)
        logger.error('🕐 CRON: Error generating Twitter post for parlay', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron', 'error'],
          error: error instanceof Error ? error : undefined,
          data: { parlayId: parlay.parlayId },
        })
      }
    }

    const duration = Date.now() - startTime

    logger.info('🕐 CRON: Scheduled Twitter post generation completed', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron', 'generation'],
      data: {
        matchesGenerated,
        parlaysGenerated,
        skipped,
        errors: errors.length,
        duration: `${duration}ms`,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Scheduled Twitter post generation completed',
      summary: {
        matchesGenerated,
        parlaysGenerated,
        total: matchesGenerated + parlaysGenerated,
        skipped,
        errors: errors.length,
      },
      errors: errors.slice(0, 10),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('🕐 CRON: Twitter post generation failed', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron', 'generation', 'error'],
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

