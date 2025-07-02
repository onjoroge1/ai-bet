import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/homepage/predictions
export async function GET() {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    // First, try to get predictions for today/tomorrow
    let predictions = await prisma.prediction.findMany({
      where: {
        // Upcoming matches (today and tomorrow)
        match: {
          matchDate: {
            gte: today,
            lte: tomorrow,
          },
          status: {
            in: ['upcoming', 'live']
          }
        },
        // High confidence or high value rating
        OR: [
          { confidenceScore: { gte: 70 } },
          { valueRating: { in: ['High', 'Very High'] } },
          { showInDailyTips: true },
          { isFeatured: true }
        ]
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        }
      },
      orderBy: [
        { confidenceScore: 'desc' },
        { valueRating: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 5
    })

    // If no today/tomorrow predictions, get from next 7 days
    if (predictions.length === 0) {
      predictions = await prisma.prediction.findMany({
        where: {
          match: {
            matchDate: {
              gte: today,
              lte: nextWeek,
            },
            status: {
              in: ['upcoming', 'live']
            }
          },
          OR: [
            { confidenceScore: { gte: 60 } },
            { valueRating: { in: ['High', 'Very High'] } },
            { showInDailyTips: true },
            { isFeatured: true }
          ]
        },
        include: {
          match: {
            include: {
              homeTeam: true,
              awayTeam: true,
              league: true,
            }
          }
        },
        orderBy: [
          { confidenceScore: 'desc' },
          { valueRating: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 5
      })
    }

    // If still no predictions, get the best available predictions regardless of date
    if (predictions.length === 0) {
      predictions = await prisma.prediction.findMany({
        where: {
          OR: [
            { confidenceScore: { gte: 70 } },
            { valueRating: { in: ['High', 'Very High'] } },
            { showInDailyTips: true },
            { isFeatured: true }
          ]
        },
        include: {
          match: {
            include: {
              homeTeam: true,
              awayTeam: true,
              league: true,
            }
          }
        },
        orderBy: [
          { confidenceScore: 'desc' },
          { valueRating: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 5
      })
    }

    logger.info('GET /api/homepage/predictions - Success', {
      tags: ['api', 'homepage', 'predictions'],
      data: { 
        predictionsCount: predictions.length,
        dateRange: { from: today.toISOString(), to: nextWeek.toISOString() }
      }
    })

    return NextResponse.json(predictions)
  } catch (error) {
    logger.error('GET /api/homepage/predictions - Error', {
      tags: ['api', 'homepage', 'predictions'],
      error: error instanceof Error ? error : undefined
    })
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
} 