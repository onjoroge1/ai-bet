import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const completedMatchesWhere = {
      match: {
        matchDate: {
          lt: new Date() // Only matches that have already happened
        }
      }
    }

    // Get total predictions count for completed matches only
    const totalPredictions = await prisma.prediction.count({
      where: completedMatchesWhere
    })

    // Get predictions by status for completed matches only
    const predictionsByStatus = await prisma.prediction.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      where: completedMatchesWhere
    })

    // Get predictions by result (calculated) for completed matches only
    const allPredictions = await prisma.prediction.findMany({
      where: completedMatchesWhere,
      include: {
        match: true
      }
    })

    let wonCount = 0
    let lostCount = 0
    let pendingCount = 0
    let voidCount = 0

    allPredictions.forEach(prediction => {
      if (prediction.match.status === 'finished' && prediction.match.homeScore !== null && prediction.match.awayScore !== null) {
        const homeScore = prediction.match.homeScore
        const awayScore = prediction.match.awayScore
        
        if (prediction.predictionType === 'home_win' && homeScore > awayScore) {
          wonCount++
        } else if (prediction.predictionType === 'away_win' && awayScore > homeScore) {
          wonCount++
        } else if (prediction.predictionType === 'draw' && homeScore === awayScore) {
          wonCount++
        } else {
          lostCount++
        }
      } else if (prediction.match.status === 'cancelled' || prediction.match.status === 'postponed') {
        voidCount++
      } else {
        pendingCount++
      }
    })

    // Calculate success rate
    const totalCompleted = wonCount + lostCount
    const successRate = totalCompleted > 0 ? Math.round((wonCount / totalCompleted) * 100) : 0

    // Get average confidence score for completed matches only
    const avgConfidence = await prisma.prediction.aggregate({
      _avg: {
        confidenceScore: true
      },
      where: completedMatchesWhere
    })

    // Get predictions by value rating for completed matches only
    const predictionsByValueRating = await prisma.prediction.groupBy({
      by: ['valueRating'],
      _count: {
        valueRating: true
      },
      where: completedMatchesWhere
    })

    // Get recent predictions (last 30 days) for completed matches only
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentPredictions = await prisma.prediction.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        },
        ...completedMatchesWhere
      }
    })

    // Get unique leagues count for completed matches only
    const uniqueLeagues = await prisma.prediction.groupBy({
      by: ['matchId'],
      _count: {
        matchId: true
      },
      where: completedMatchesWhere
    })

    return NextResponse.json({
      totalPredictions,
      predictionsByStatus: predictionsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<string, number>),
      results: {
        won: wonCount,
        lost: lostCount,
        pending: pendingCount,
        void: voidCount
      },
      successRate,
      averageConfidence: Math.round(avgConfidence._avg.confidenceScore || 0),
      predictionsByValueRating: predictionsByValueRating.reduce((acc, item) => {
        acc[item.valueRating] = item._count.valueRating
        return acc
      }, {} as Record<string, number>),
      recentPredictions,
      topLeagues: uniqueLeagues.length
    })

  } catch (error) {
    console.error('Error fetching predictions history stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch predictions history stats' },
      { status: 500 }
    )
  }
} 