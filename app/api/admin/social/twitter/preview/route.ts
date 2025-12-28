import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { TwitterGenerator } from '@/lib/social/twitter-generator'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/social/twitter/preview - Generate preview of Twitter post (without saving)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      action?: 'generate_match' | 'generate_parlay'
      matchId?: string
      parlayId?: string
      templateId?: string
    }

    const { action, matchId, parlayId, templateId } = body

    if (!templateId) {
      return NextResponse.json({ success: false, error: 'Template ID is required' }, { status: 400 })
    }

    if (action === 'generate_match' && matchId) {
      // Generate preview for match
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
      const template = TwitterGenerator.getTemplateById(draft.templateId)

      return NextResponse.json({
        success: true,
        message: 'Preview generated',
        data: {
          content: draft.content,
          url: draft.url,
          templateId: draft.templateId,
          templateName: template?.name || '',
          postType: draft.postType,
        },
      })
    }

    if (action === 'generate_parlay' && parlayId) {
      // Generate preview for parlay
      const parlay = await prisma.parlayConsensus.findUnique({
        where: { parlayId },
        include: {
          legs: {
            select: {
              homeTeam: true,
              awayTeam: true,
              legOrder: true,
            },
            orderBy: { legOrder: 'asc' },
            take: 1,
          },
        },
      })

      if (!parlay) {
        return NextResponse.json({ success: false, error: 'Parlay not found' }, { status: 404 })
      }

      const baseUrl = TwitterGenerator.getBaseUrl()

      const parlayData = {
        parlayId: parlay.parlayId,
        parlayUrl: `${baseUrl}/dashboard/parlays/${parlay.parlayId}`,
        firstLeg: parlay.legs[0] ? {
          homeTeam: parlay.legs[0].homeTeam,
          awayTeam: parlay.legs[0].awayTeam,
        } : undefined,
        legCount: parlay.legCount || 0,
      }

      const draft = TwitterGenerator.generateParlayPost(parlayData, templateId)
      const template = TwitterGenerator.getTemplateById(draft.templateId)

      return NextResponse.json({
        success: true,
        message: 'Preview generated',
        data: {
          content: draft.content,
          url: draft.url,
          templateId: draft.templateId,
          templateName: template?.name || '',
          postType: draft.postType,
        },
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action or missing parameters' }, { status: 400 })
  } catch (error) {
    logger.error('[Twitter API] Error generating preview:', {
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { success: false, error: 'Failed to generate preview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

