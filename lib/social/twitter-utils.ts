import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

/**
 * Utility functions for Twitter automation
 * Data fetching and validation functions
 */

/**
 * Get eligible matches for Twitter posting
 * Same criteria as blog generation: matches with predictionData
 */
export async function getEligibleMatches(limit: number = 50) {
  const matches = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      isActive: true,
      quickPurchases: {
        some: {
          isActive: true,
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
        },
      },
    },
    select: {
      id: true,
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
      kickoffDate: true,
      quickPurchases: {
        where: {
          isActive: true,
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
        },
        select: {
          id: true,
          confidenceScore: true,
          matchId: true,
        },
        take: 1,
      },
      blogPosts: {
        where: { isPublished: true, isActive: true },
        select: {
          id: true,
          slug: true,
        },
        take: 1,
      },
    },
    orderBy: { kickoffDate: 'asc' },
    take: limit,
  })

  return matches
}

/**
 * Get eligible parlays for Twitter posting
 */
export async function getEligibleParlays(limit: number = 20) {
  const now = new Date()
  
  const parlays = await prisma.parlayConsensus.findMany({
    where: {
      status: 'active',
      earliestKickoff: { gt: now }, // Only upcoming parlays
    },
    select: {
      id: true,
      parlayId: true,
      legCount: true,
      earliestKickoff: true,
      legs: {
        select: {
          homeTeam: true,
          awayTeam: true,
          legOrder: true,
        },
        orderBy: { legOrder: 'asc' },
        take: 1, // Get first leg for template
      },
    },
    orderBy: { earliestKickoff: 'asc' },
    take: limit,
  })

  return parlays
}

/**
 * Check if match already has Twitter posts
 */
export async function hasExistingPostForMatch(matchId: string, platform: string = 'twitter'): Promise<boolean> {
  const count = await prisma.socialMediaPost.count({
    where: {
      matchId,
      platform,
      status: { in: ['posted', 'scheduled'] },
    },
  })
  return count > 0
}

/**
 * Check if parlay already has Twitter posts
 */
export async function hasExistingPostForParlay(parlayId: string, platform: string = 'twitter'): Promise<boolean> {
  const count = await prisma.socialMediaPost.count({
    where: {
      parlayId,
      platform,
      status: { in: ['posted', 'scheduled'] },
    },
  })
  return count > 0
}

/**
 * Get base URL for generating match/parlay URLs
 */
export function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://snapbet.ai'
}

