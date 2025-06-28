import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    // Get user package tips
    const userPackageTips = await prisma.userPackageTip.findMany({
      where: {
        userPackage: {
          userId: userId
        }
      },
      include: {
        prediction: {
          include: {
            match: {
              include: {
                homeTeam: true,
                awayTeam: true,
                league: true
              }
            }
          }
        },
        userPackage: {
          include: {
            packageOffer: true
          }
        }
      },
      orderBy: {
        claimedAt: 'desc'
      },
      take: limit
    })

    // Transform the data for frontend consumption
    const transformedTips = userPackageTips.map(tip => ({
      id: tip.id,
      tipName: `${tip.prediction.match.homeTeam.name} vs ${tip.prediction.match.awayTeam.name}`,
      claimedAt: tip.claimedAt.toISOString(),
      status: tip.status as 'claimed' | 'used' | 'expired',
      packageName: tip.userPackage.packageOffer.name,
      matchDetails: {
        homeTeam: tip.prediction.match.homeTeam.name,
        awayTeam: tip.prediction.match.awayTeam.name,
        prediction: tip.prediction.predictionType,
        confidence: tip.prediction.confidenceScore,
        odds: tip.prediction.odds,
        result: tip.prediction.status === 'completed' ? 
          ((tip.prediction.match.homeScore || 0) > (tip.prediction.match.awayScore || 0) ? 'home_win' :
           (tip.prediction.match.awayScore || 0) > (tip.prediction.match.homeScore || 0) ? 'away_win' : 'draw') : 
          'pending'
      }
    }))

    return NextResponse.json({
      tips: transformedTips,
      total: transformedTips.length
    })

  } catch (error) {
    console.error('Error fetching tips history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tips history' },
      { status: 500 }
    )
  }
} 