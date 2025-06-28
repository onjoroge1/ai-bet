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

    // Get all user package tips for the user
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
      }
    })

    // Calculate statistics
    const totalTips = userPackageTips.length
    const claimedTips = userPackageTips.filter(tip => tip.status === 'claimed').length
    const usedTips = userPackageTips.filter(tip => tip.status === 'used').length
    const expiredTips = userPackageTips.filter(tip => tip.status === 'expired').length

    // Calculate success rate (for used tips)
    const usedTipsWithResults = userPackageTips.filter(tip => 
      tip.status === 'used' && tip.prediction.status === 'completed'
    )
    
    const successfulTips = usedTipsWithResults.filter(tip => {
      const prediction = tip.prediction
      
      if (!prediction || prediction.status !== 'completed') return false
      
      // Simple success calculation based on prediction type
      const predictionType = prediction.predictionType
      const homeScore = prediction.match.homeScore || 0
      const awayScore = prediction.match.awayScore || 0
      
      switch (predictionType) {
        case 'home_win':
          return homeScore > awayScore
        case 'away_win':
          return awayScore > homeScore
        case 'draw':
          return homeScore === awayScore
        default:
          return false
      }
    }).length

    const successRate = usedTipsWithResults.length > 0 
      ? Math.round((successfulTips / usedTipsWithResults.length) * 100) 
      : 0

    // Calculate average confidence
    const tipsWithConfidence = userPackageTips.filter(tip => 
      tip.prediction.confidenceScore
    )
    
    const totalConfidence = tipsWithConfidence.reduce((sum, tip) => {
      return sum + (tip.prediction.confidenceScore || 0)
    }, 0)
    
    const averageConfidence = tipsWithConfidence.length > 0 
      ? Math.round(totalConfidence / tipsWithConfidence.length) 
      : 0

    return NextResponse.json({
      totalTips,
      claimedTips,
      usedTips,
      expiredTips,
      successRate,
      averageConfidence
    })

  } catch (error) {
    console.error('Error fetching tips history stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tips history statistics' },
      { status: 500 }
    )
  }
} 