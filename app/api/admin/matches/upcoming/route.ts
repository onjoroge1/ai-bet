import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'

/**
 * GET /api/admin/matches/upcoming
 * 
 * Returns all upcoming matches from MarketMatch table with status indicators:
 * - hasBlog: Whether match has a blog post
 * - hasSocialMediaPost: Whether match has a social media post
 * - hasPredictionData: Whether match has predictionData in QuickPurchase
 * - needsPredict: Whether match needs /predict to be run (missing predictionData)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'UPCOMING'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get current date for filtering upcoming matches
    const now = new Date()

    // Fetch upcoming matches from MarketMatch table
    const matches = await prisma.marketMatch.findMany({
      where: {
        status: status,
        kickoffDate: {
          gte: now // Only future matches
        },
        isActive: true
      },
      include: {
        blogPosts: {
          where: {
            isPublished: true,
            isActive: true
          },
          select: {
            id: true
          },
          take: 1 // Just need to know if exists
        },
        socialMediaPosts: {
          where: {
            status: {
              in: ['scheduled', 'posted']
            }
          },
          select: {
            id: true
          },
          take: 1 // Just need to know if exists
        },
        quickPurchases: {
          where: {
            isActive: true,
            isPredictionActive: true
          },
          select: {
            id: true,
            matchId: true,
            predictionData: true
          }
        }
      },
      orderBy: {
        kickoffDate: 'asc'
      },
      take: limit,
      skip: offset
    })

    // Extract all matchIds to also check QuickPurchase records linked by matchId (not just marketMatchId)
    const matchIds = matches.map(m => m.matchId).filter(Boolean) as string[]
    
    // Fetch QuickPurchase records that match by matchId (for backward compatibility)
    // This catches records that have matchId but may not have marketMatchId set
    const quickPurchasesByMatchId = await prisma.quickPurchase.findMany({
      where: {
        matchId: { in: matchIds },
        isActive: true,
        isPredictionActive: true
      },
      select: {
        id: true,
        matchId: true,
        predictionData: true
      }
    })

    // Create a map of matchId -> QuickPurchase records for quick lookup
    const quickPurchaseMap = new Map<string, typeof quickPurchasesByMatchId>()
    for (const qp of quickPurchasesByMatchId) {
      if (qp.matchId) {
        if (!quickPurchaseMap.has(qp.matchId)) {
          quickPurchaseMap.set(qp.matchId, [])
        }
        quickPurchaseMap.get(qp.matchId)!.push(qp)
      }
    }

    // Helper function to check if predictionData is valid
    function hasValidPredictionData(predictionData: any): boolean {
      if (!predictionData) return false
      if (predictionData === Prisma.JsonNull) return false
      if (predictionData === null) return false
      if (predictionData === undefined) return false
      
      const jsonString = JSON.stringify(predictionData)
      if (jsonString === '{}') return false
      if (jsonString === 'null') return false
      if (jsonString === '[]') return false
      
      try {
        const parsed = typeof predictionData === 'string' 
          ? JSON.parse(predictionData) 
          : predictionData
        return typeof parsed === 'object' && Object.keys(parsed).length > 0
      } catch {
        return false
      }
    }

    // Transform matches to include status indicators
    const matchesWithStatus = matches.map(match => {
      // Check if has blog
      const hasBlog = match.blogPosts.length > 0

      // Check if has social media post
      const hasSocialMediaPost = match.socialMediaPosts.length > 0

      // Get ALL QuickPurchase records for this match:
      // 1. From relation (linked via marketMatchId)
      // 2. From matchId lookup (backward compatibility - records linked only by matchId)
      const relatedQuickPurchases = match.quickPurchases
      const matchIdQuickPurchases = quickPurchaseMap.get(match.matchId) || []
      
      // Combine both sources and deduplicate by id
      const allQuickPurchases = [
        ...relatedQuickPurchases,
        ...matchIdQuickPurchases.filter(qp => 
          !relatedQuickPurchases.some(rqp => rqp.id === qp.id)
        )
      ]

      // Check if has predictionData in ANY QuickPurchase (checking both relation and matchId)
      const hasPredictionData = allQuickPurchases.some(qp => 
        hasValidPredictionData(qp.predictionData)
      )

      // Debug logging for matches with QuickPurchase but no predictionData detected
      if (allQuickPurchases.length > 0 && !hasPredictionData) {
        console.log(`[Matches API] Match ${match.matchId} has ${allQuickPurchases.length} QuickPurchase(s) but no valid predictionData`, {
          matchId: match.matchId,
          quickPurchaseIds: allQuickPurchases.map(qp => qp.id),
          predictionDataStatus: allQuickPurchases.map(qp => ({
            id: qp.id,
            hasData: !!qp.predictionData,
            isNull: qp.predictionData === null,
            isUndefined: qp.predictionData === undefined,
            jsonString: qp.predictionData ? JSON.stringify(qp.predictionData).substring(0, 100) : 'null'
          }))
        })
      }

      // FIXED: Needs /predict if NO predictionData exists (regardless of QuickPurchase existence)
      const needsPredict = !hasPredictionData

      return {
        id: match.id,
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        kickoffDate: match.kickoffDate,
        status: match.status,
        // Status indicators
        hasBlog,
        hasSocialMediaPost,
        hasPredictionData,
        needsPredict,
        // Additional info
        quickPurchaseCount: allQuickPurchases.length,
        blogCount: match.blogPosts.length,
        socialMediaPostCount: match.socialMediaPosts.length
      }
    })

    // Get total count for pagination
    const totalCount = await prisma.marketMatch.count({
      where: {
        status: status,
        kickoffDate: {
          gte: now
        },
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      matches: matchesWithStatus,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('Error fetching upcoming matches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch upcoming matches', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

