/**
 * Result Post Generator — creates "Called it!" or "Tough one" social posts
 * when matches finish, with image URLs for visual tweets.
 */

import prisma from '@/lib/db'
import { TwitterGenerator } from './twitter-generator'
import { buildSocialUrl } from './url-utils'
import { generateMatchSlug } from '@/lib/match-slug'
import { logger } from '@/lib/logger'

interface ResultPostData {
  content: string
  imageUrl: string
  url: string
  matchId: string
  marketMatchId: string
  postType: string
}

/**
 * Find finished matches that need result posts and generate them.
 */
export async function generateResultPosts(limit: number = 10): Promise<ResultPostData[]> {
  const posts: ResultPostData[] = []

  try {
    // Find finished matches with predictions but no result post
    const finishedMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'FINISHED',
        finalResult: { not: undefined },
        // Exclude matches that already have a result post
        socialMediaPosts: {
          none: {
            postType: 'match_result',
            platform: 'twitter',
          },
        },
      },
      include: {
        quickPurchases: {
          where: { isActive: true, predictionType: { not: null } },
          take: 1,
          select: { predictionType: true, confidenceScore: true },
        },
      },
      orderBy: { kickoffDate: 'desc' },
      take: limit,
    })

    for (const match of finishedMatches) {
      const qp = match.quickPurchases[0]
      if (!qp?.predictionType) continue

      const result = match.finalResult as any
      if (!result?.score && !result?.home && typeof result !== 'string') continue

      // Parse score
      let scoreHome = 0
      let scoreAway = 0
      if (result?.score) {
        scoreHome = result.score.home ?? 0
        scoreAway = result.score.away ?? 0
      } else if (typeof result === 'string') {
        // Handle "H", "A", "D" format
        continue // Can't determine score from just the result letter
      }

      // Determine actual outcome
      const actualOutcome = scoreHome > scoreAway ? 'home' : scoreAway > scoreHome ? 'away' : 'draw'
      const predNorm = qp.predictionType === 'home_win' ? 'home'
        : qp.predictionType === 'away_win' ? 'away'
        : qp.predictionType

      const wasCorrect = predNorm === actualOutcome
      const confidence = qp.confidenceScore ?? 0

      // Generate content using templates
      let content: string
      const scoreText = `${match.homeTeam} ${scoreHome}-${scoreAway} ${match.awayTeam}`

      if (wasCorrect && confidence >= 60) {
        content = `FT: ${scoreText}\n\nModel had this at ${confidence}% confidence. Right on the money.`
      } else if (wasCorrect) {
        content = `FT: ${scoreText}\n\nCorrect call. The model got this one right.`
      } else if (!wasCorrect && confidence >= 60) {
        content = `FT: ${scoreText}\n\nDidn't see that coming. ${confidence}% confidence but the pitch had other plans.`
      } else {
        content = `FT: ${scoreText}\n\nMissed this one. Football always finds a way to surprise.`
      }

      // Humanize with LLM
      try {
        const humanized = await TwitterGenerator.humanizePost(content)
        if (humanized && humanized.length <= 256) {
          content = humanized
        }
      } catch {
        // Keep template version
      }

      // Build URLs
      const slug = `${generateMatchSlug(match.homeTeam, match.awayTeam)}-${match.matchId}`
      const matchUrl = buildSocialUrl(`/match/${slug}`)
      const imageUrl = `/api/social/images/match-result?matchId=${match.matchId}&format=twitter`

      posts.push({
        content,
        imageUrl,
        url: matchUrl,
        matchId: match.matchId,
        marketMatchId: match.id,
        postType: 'match_result',
      })
    }
  } catch (error) {
    logger.error('[Result Generator] Error generating result posts', {
      tags: ['social', 'result', 'error'],
      error: error instanceof Error ? error : undefined,
    })
  }

  return posts
}
