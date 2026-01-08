import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { TwitterGenerator } from '@/lib/social/twitter-generator'
import { logger } from '@/lib/logger'
import { buildSocialUrl } from '@/lib/social/url-utils'

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
 * GET /api/admin/social/twitter - Get eligible matches/parlays for posting or available templates for a match
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')
    const action = searchParams.get('action') // 'templates' to get available templates
    
    // If requesting available templates for a specific match
    if (action === 'templates' && matchId) {
      const match = await prisma.marketMatch.findUnique({
        where: { matchId },
        include: {
          quickPurchases: {
            where: {
              isActive: true,
              isPredictionActive: true,
            },
            take: 1,
            select: {
              confidenceScore: true,
              predictionData: true
            }
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

      // Extract confidence (same logic as generate_match)
      let aiConf: number | undefined = undefined
      const quickPurchase = match.quickPurchases[0]
      
      if (quickPurchase) {
        if (quickPurchase.confidenceScore !== null && quickPurchase.confidenceScore !== undefined) {
          aiConf = quickPurchase.confidenceScore
        } else if (quickPurchase.predictionData) {
          const predictionData = quickPurchase.predictionData as any
          const mlPrediction = predictionData?.comprehensive_analysis?.ml_prediction || 
                              predictionData?.predictions ||
                              predictionData?.prediction?.predictions ||
                              predictionData?.ml_prediction
          
          if (mlPrediction?.confidence !== undefined && mlPrediction?.confidence !== null) {
            aiConf = typeof mlPrediction.confidence === 'number' && mlPrediction.confidence <= 1
              ? Math.round(mlPrediction.confidence * 100)
              : Math.round(mlPrediction.confidence)
          } else if (predictionData?.analysis?.confidence !== undefined) {
            aiConf = typeof predictionData.analysis.confidence === 'number' && predictionData.analysis.confidence <= 1
              ? Math.round(predictionData.analysis.confidence * 100)
              : Math.round(predictionData.analysis.confidence)
          } else if (predictionData?.confidence !== undefined) {
            aiConf = typeof predictionData.confidence === 'number' && predictionData.confidence <= 1
              ? Math.round(predictionData.confidence * 100)
              : Math.round(predictionData.confidence)
          }
        }
      }

      const matchData = {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        matchId: match.matchId,
        aiConf,
        matchUrl: '',
        blogUrl: undefined,
      }

      // Get available templates
      const hasBlog = match.blogPosts.length > 0
      const allMatchTemplates = TwitterGenerator.getAvailableTemplates('match', matchData)
      const upcomingTemplates = TwitterGenerator.getAvailableTemplates('upcoming', matchData)
      const availableTemplates = [...allMatchTemplates, ...upcomingTemplates].filter(
        t => !t.requiresLive // Exclude live templates for UPCOMING matches
      )

      return NextResponse.json({
        success: true,
        templates: availableTemplates.map(t => ({
          id: t.id,
          name: t.name,
          category: t.category,
          requiresConfidence: t.requiresConfidence || false
        })),
        hasConfidence: aiConf !== undefined,
        hasBlog
      })
    }

    // Original GET logic for eligible matches/parlays
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
          
          // Build matchData for template filtering using buildSocialUrl to prevent double slashes
          const matchData = {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.league,
            matchId: match.matchId,
            aiConf: quickPurchase?.confidenceScore || undefined,
            matchUrl: buildSocialUrl(`/match/${match.matchId}`),
            blogUrl: blogPost ? buildSocialUrl(`/blog/${blogPost.slug}`) : undefined,
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
            matchUrl: buildSocialUrl(`/match/${match.matchId}`),
            blogUrl: blogPost ? buildSocialUrl(`/blog/${blogPost.slug}`) : undefined,
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
            parlayBuilderUrl: buildSocialUrl(`/dashboard/parlays/${parlay.parlayId}`),
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

      // Extract confidence score and explanation - try multiple sources (same logic as predict endpoint)
      let aiConf: number | undefined = undefined
      let explanation: string | undefined = undefined
      
      if (quickPurchase) {
        // First try confidenceScore field
        if (quickPurchase.confidenceScore !== null && quickPurchase.confidenceScore !== undefined) {
          aiConf = quickPurchase.confidenceScore
        } else if (quickPurchase.predictionData) {
          // Try to extract from predictionData (multiple possible structures)
          const predictionData = quickPurchase.predictionData as any
          
          // Extract explanation from analysis.explanation
          if (predictionData?.analysis?.explanation) {
            explanation = typeof predictionData.analysis.explanation === 'string' 
              ? predictionData.analysis.explanation 
              : undefined
          }
          
          // Try comprehensive_analysis.ml_prediction.confidence
          const mlPrediction = predictionData?.comprehensive_analysis?.ml_prediction || 
                              predictionData?.predictions ||
                              predictionData?.prediction?.predictions ||
                              predictionData?.ml_prediction
          
          if (mlPrediction?.confidence !== undefined && mlPrediction?.confidence !== null) {
            // Convert to percentage if it's a decimal (0-1 range)
            aiConf = typeof mlPrediction.confidence === 'number' && mlPrediction.confidence <= 1
              ? Math.round(mlPrediction.confidence * 100)
              : Math.round(mlPrediction.confidence)
          } 
          // Try analysis.confidence
          else if (predictionData?.analysis?.confidence !== undefined && predictionData?.analysis?.confidence !== null) {
            aiConf = typeof predictionData.analysis.confidence === 'number' && predictionData.analysis.confidence <= 1
              ? Math.round(predictionData.analysis.confidence * 100)
              : Math.round(predictionData.analysis.confidence)
          }
          // Try top-level confidence
          else if (predictionData?.confidence !== undefined && predictionData?.confidence !== null) {
            aiConf = typeof predictionData.confidence === 'number' && predictionData.confidence <= 1
              ? Math.round(predictionData.confidence * 100)
              : Math.round(predictionData.confidence)
          }
        }
      }

      const matchData = {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        matchId: match.matchId,
        aiConf,
        matchUrl: buildSocialUrl(`/match/${match.matchId}`),
        blogUrl: blogPost ? buildSocialUrl(`/blog/${blogPost.slug}`) : undefined,
        explanation,
      }

      // Validate template requirements before generating
      if (templateId) {
        const template = TwitterGenerator.getTemplateById(templateId)
        if (!template) {
          return NextResponse.json({ 
            success: false, 
            error: `Template "${templateId}" not found` 
          }, { status: 400 })
        }
        
        if (template.requiresConfidence && aiConf === undefined) {
          return NextResponse.json({ 
            success: false, 
            error: `Template "${template.name}" requires a confidence score, but this match doesn't have one available. Please select a different template.` 
          }, { status: 400 })
        }
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

      const parlayData = {
        parlayId: parlay.parlayId,
        parlayUrl: buildSocialUrl(`/dashboard/parlays/${parlay.parlayId}`),
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

