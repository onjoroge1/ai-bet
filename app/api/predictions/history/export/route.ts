import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { format = 'csv', filters = {} } = await request.json()

    // Build where clause
    const where: any = {
      // Only show predictions for completed matches (past matches)
      match: {
        matchDate: {
          lt: new Date() // Only matches that have already happened
        }
      }
    }

    // Apply filters
    if (filters.search) {
      where.OR = [
        {
          match: {
            homeTeam: {
              name: {
                contains: filters.search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          match: {
            awayTeam: {
              name: {
                contains: filters.search,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          match: {
            league: {
              name: {
                contains: filters.search,
                mode: 'insensitive'
              }
            }
          }
        }
      ]
    }

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.league) {
      where.match = {
        ...where.match,
        league: {
          name: filters.league
        }
      }
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
    }

    // Get predictions with all related data
    const predictions = await prisma.prediction.findMany({
      where,
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate results for each prediction
    const predictionsWithResults = predictions.map(prediction => {
      let result = 'pending'
      
      if (prediction.match.status === 'finished' && prediction.match.homeScore !== null && prediction.match.awayScore !== null) {
        const homeScore = prediction.match.homeScore
        const awayScore = prediction.match.awayScore
        
        if (prediction.predictionType === 'home_win' && homeScore > awayScore) {
          result = 'won'
        } else if (prediction.predictionType === 'away_win' && awayScore > homeScore) {
          result = 'won'
        } else if (prediction.predictionType === 'draw' && homeScore === awayScore) {
          result = 'won'
        } else {
          result = 'lost'
        }
      } else if (prediction.match.status === 'cancelled' || prediction.match.status === 'postponed') {
        result = 'void'
      }
      
      return {
        ...prediction,
        result
      }
    })

    if (format === 'csv') {
      // Generate CSV content
      const csvHeaders = [
        'Prediction ID',
        'Created Date',
        'Match',
        'League',
        'Match Date',
        'Match Status',
        'Home Score',
        'Away Score',
        'Prediction Type',
        'Confidence Score',
        'Odds',
        'Value Rating',
        'Result',
        'Is Featured',
        'Is Free',
        'Explanation'
      ]

      const csvRows = predictionsWithResults.map(prediction => [
        prediction.id,
        prediction.createdAt.toISOString().split('T')[0],
        `${prediction.match.homeTeam.name} vs ${prediction.match.awayTeam.name}`,
        prediction.match.league.name,
        prediction.match.matchDate.toISOString().split('T')[0],
        prediction.match.status,
        prediction.match.homeScore?.toString() || '',
        prediction.match.awayScore?.toString() || '',
        prediction.predictionType,
        prediction.confidenceScore,
        prediction.odds.toString(),
        prediction.valueRating,
        prediction.result,
        prediction.isFeatured ? 'Yes' : 'No',
        prediction.isFree ? 'Yes' : 'No',
        prediction.explanation || ''
      ])

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      // Return CSV file
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="predictions-history-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Return JSON format
    return NextResponse.json({
      predictions: predictionsWithResults.map(prediction => ({
        id: prediction.id,
        createdAt: prediction.createdAt.toISOString(),
        match: `${prediction.match.homeTeam.name} vs ${prediction.match.awayTeam.name}`,
        league: prediction.match.league.name,
        matchDate: prediction.match.matchDate.toISOString(),
        matchStatus: prediction.match.status,
        homeScore: prediction.match.homeScore,
        awayScore: prediction.match.awayScore,
        predictionType: prediction.predictionType,
        confidenceScore: prediction.confidenceScore,
        odds: prediction.odds,
        valueRating: prediction.valueRating,
        result: prediction.result,
        isFeatured: prediction.isFeatured,
        isFree: prediction.isFree,
        explanation: prediction.explanation
      }))
    })

  } catch (error) {
    console.error('Error exporting predictions history:', error)
    return NextResponse.json(
      { error: 'Failed to export predictions history' },
      { status: 500 }
    )
  }
} 