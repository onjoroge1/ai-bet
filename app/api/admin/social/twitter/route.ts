import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { TwitterGenerator } from '@/lib/social/twitter-generator'
import { logger } from '@/lib/logger'

/**
 * Get base URL for the application
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000'
}

/**
 * Check if a match already has an existing scheduled/posted post
 */
async function hasExistingPostForMatch(matchId: string): Promise<boolean> {
  const existing = await prisma.socialMediaPost.findFirst({
    where: {
      matchId,
      platform: 'twitter',
      status: { in: ['scheduled', 'posted'] },
    },
  })
  return !!existing
}

/**
 * Check if a parlay already has an existing scheduled/posted post
 */
async function hasExistingPostForParlay(parlayId: string): Promise<boolean> {
  const existing = await prisma.socialMediaPost.findFirst({
    where: {
      parlayId,
      platform: 'twitter',
      status: { in: ['scheduled', 'posted'] },
    },
  })
  return !!existing
}

/**
 * GET /api/admin/social/twitter - Get eligible matches/parlays for posting
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'matches' // 'matches', 'parlays', 'both'

    const result: any = {}

    if (type === 'matches' || type === 'both') {
      const matches = await TwitterGenerator.getEligibleMatches(50)
      
      // Check existing posts for each match and get available templates
      const matchesWithStatus = await Promise.all(
        matches.map(async (match) => {
          const hasPost = await hasExistingPostForMatch(match.matchId)
          const quickPurchase = match.quickPurchases[0]
          const blogPost = match.blogPosts[0]
          const baseUrl = getBaseUrl()
          
          // Build matchData for template filtering
          const matchData = {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.league,
            matchId: match.matchId,
            aiConf: quickPurchase?.confidenceScore || undefined,
            matchUrl: `${baseUrl}/match/${match.matchId}`,
            blogUrl: blogPost ? `${baseUrl}/blog/${blogPost.slug}` : undefined,
          }
          
          // Get available templates for this match (filter by match/post type, exclude live templates for UPCOMING)
          const allMatchTemplates = TwitterGenerator.getAvailableTemplates('match', matchData)
          // Also include 'upcoming' templates
          const upcomingTemplates = TwitterGenerator.getAvailableTemplates('upcoming', matchData)
          const availableTemplates = [...allMatchTemplates, ...upcomingTemplates].filter(
            t => !t.requiresLive // Exclude live templates for UPCOMING matches
          )
          
          return {
            id: match.id,
            matchId: match.matchId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.league,
            kickoffDate: match.kickoffDate.toISOString(),
            confidenceScore: quickPurchase?.confidenceScore || null,
            hasBlog: !!blogPost,
            hasExistingPost: hasPost,
            matchUrl: `${baseUrl}/match/${match.matchId}`,
            blogUrl: blogPost ? `${baseUrl}/blog/${blogPost.slug}` : undefined,
            availableTemplates: availableTemplates.map(t => ({
              id: t.id,
              name: t.name,
              category: t.category,
            })),
          }
        })
      )

      result.matches = matchesWithStatus
    }

    if (type === 'parlays' || type === 'both') {
      const parlays = await TwitterGenerator.getEligibleParlays(20)
      const baseUrl = getBaseUrl()
      
      // Get available templates for parlays
      const availableParlayTemplates = TwitterGenerator.getAvailableTemplates('parlay')
      
      const parlaysWithStatus = await Promise.all(
        parlays.map(async (parlay) => {
          const hasPost = await hasExistingPostForParlay(parlay.parlayId)
          const firstLeg = parlay.legs[0]
          
          return {
            id: parlay.id,
            parlayId: parlay.parlayId,
            legCount: parlay.legCount,
            earliestKickoff: parlay.earliestKickoff.toISOString(),
            firstLeg: firstLeg ? {
              homeTeam: firstLeg.homeTeam,
              awayTeam: firstLeg.awayTeam,
            } : undefined,
            hasExistingPost: hasPost,
            parlayBuilderUrl: `${baseUrl}/dashboard/parlays/${parlay.parlayId}`,
            availableTemplates: availableParlayTemplates.map(t => ({
              id: t.id,
              name: t.name,
              category: t.category,
            })),
          }
        })
      )

      result.parlays = parlaysWithStatus
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error('[Twitter API] Error fetching eligible posts:', {
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/social/twitter - Generate and schedule Twitter post
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      action?: 'generate_match' | 'generate_parlay' | 'generate_brand'
      matchId?: string
      parlayId?: string
      templateId?: string
      scheduledAt?: string
      postNow?: boolean
    }

    const { action, matchId, parlayId, templateId, scheduledAt, postNow = false } = body

    if (action === 'generate_match' && matchId) {
      // Generate post for match
      const match = await prisma.marketMatch.findUnique({
        where: { matchId },
        include: {
          quickPurchases: {
            where: {
              isActive: true,
              isPredictionActive: true,
              predictionData: { not: Prisma.JsonNull },
            },
            take: 1,
          },
          blogPosts: {
            where: { isPublished: true, isActive: true },
            take: 1,
          },
        },
      })

      if (!match) {
        return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 })
      }

      const quickPurchase = match.quickPurchases[0]
      const blogPost = match.blogPosts[0]
      const baseUrl = TwitterGenerator.getBaseUrl()

      const matchData = {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        matchId: match.matchId,
        aiConf: quickPurchase?.confidenceScore || undefined,
        matchUrl: `${baseUrl}/match/${match.matchId}`,
        blogUrl: blogPost ? `${baseUrl}/blog/${blogPost.slug}` : undefined,
      }

      const draft = TwitterGenerator.generateMatchPost(matchData, templateId)

      // Create scheduled post
      const post = await prisma.socialMediaPost.create({
        data: {
          platform: 'twitter',
          postType: 'match',
          templateId: draft.templateId,
          content: draft.content,
          url: draft.url,
          matchId: match.matchId,
          marketMatchId: match.id,
          blogPostId: blogPost?.id,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : (postNow ? new Date() : new Date(Date.now() + 60000)), // Default: 1 min from now
          status: 'scheduled',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Twitter post scheduled',
        data: {
          id: post.id,
          content: post.content,
          scheduledAt: post.scheduledAt,
          status: post.status,
        },
      })
    }

    if (action === 'generate_parlay' && parlayId) {
      // Generate post for parlay
      const parlay = await prisma.parlayConsensus.findUnique({
        where: { parlayId },
        include: {
          legs: {
            orderBy: { legOrder: 'asc' },
            take: 1,
          },
        },
      })

      if (!parlay) {
        return NextResponse.json({ success: false, error: 'Parlay not found' }, { status: 404 })
      }

      const firstLeg = parlay.legs[0]
      const baseUrl = TwitterGenerator.getBaseUrl()

      const parlayData = {
        parlayId: parlay.parlayId,
        parlayUrl: `${baseUrl}/dashboard/parlays/${parlay.parlayId}`,
        firstLeg: firstLeg ? {
          homeTeam: firstLeg.homeTeam,
          awayTeam: firstLeg.awayTeam,
        } : undefined,
        legCount: parlay.legCount,
      }

      const draft = TwitterGenerator.generateParlayPost(parlayData, templateId)

      const post = await prisma.socialMediaPost.create({
        data: {
          platform: 'twitter',
          postType: 'parlay',
          templateId: draft.templateId,
          content: draft.content,
          url: draft.url,
          parlayId: parlay.parlayId,
          parlayConsensusId: parlay.id,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : (postNow ? new Date() : new Date(Date.now() + 60000)),
          status: 'scheduled',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Twitter post scheduled',
        data: {
          id: post.id,
          content: post.content,
          scheduledAt: post.scheduledAt,
          status: post.status,
        },
      })
    }

    if (action === 'generate_brand') {
      // Generate brand post
      const draft = TwitterGenerator.generateBrandPost('brand')

      const post = await prisma.socialMediaPost.create({
        data: {
          platform: 'twitter',
          postType: 'brand',
          templateId: draft.templateId,
          content: draft.content,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : (postNow ? new Date() : new Date(Date.now() + 60000)),
          status: 'scheduled',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Twitter post scheduled',
        data: {
          id: post.id,
          content: post.content,
          scheduledAt: post.scheduledAt,
          status: post.status,
        },
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action or missing parameters' }, { status: 400 })
  } catch (error) {
    logger.error('[Twitter API] Error generating post:', {
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { success: false, error: 'Failed to generate post', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

