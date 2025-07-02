import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

// POST /api/admin/predictions/enrich-from-quickpurchases
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { limit = 50 } = await req.json()

    logger.info('Starting Prediction enrichment from QuickPurchase data', {
      tags: ['api', 'admin', 'predictions', 'enrich-quickpurchases'],
      data: { limit, startTime: new Date(startTime).toISOString() }
    })

    // Find QuickPurchase records with high confidence predictions (>60%)
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: { not: null },
        confidenceScore: { gte: 60 },
        isPredictionActive: true,
        predictionData: { not: Prisma.JsonNull },
        matchData: { not: Prisma.JsonNull }
      },
      include: {
        country: true
      },
      take: limit,
      orderBy: {
        confidenceScore: 'desc'
      }
    })

    logger.info('Found QuickPurchase records for enrichment', {
      tags: ['api', 'admin', 'predictions', 'enrich-quickpurchases'],
      data: { 
        totalFound: quickPurchases.length,
        confidenceRange: quickPurchases.length > 0 ? {
          min: Math.min(...quickPurchases.map(qp => qp.confidenceScore || 0)),
          max: Math.max(...quickPurchases.map(qp => qp.confidenceScore || 0))
        } : null
      }
    })

    if (quickPurchases.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No QuickPurchase records found with confidence >= 60%',
        enriched: 0,
        skipped: 0,
        errors: []
      })
    }

    const results = {
      enriched: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Process each QuickPurchase record
    for (const quickPurchase of quickPurchases) {
      try {
        // Extract match data
        const matchData = quickPurchase.matchData as any
        const predictionData = quickPurchase.predictionData as any

        if (!matchData || !predictionData) {
          results.skipped++
          continue
        }

        // Check if prediction already exists for this match
        const existingPrediction = await prisma.prediction.findFirst({
          where: {
            matchId: quickPurchase.matchId!
          }
        })

        if (existingPrediction) {
          logger.debug('Prediction already exists for match', {
            tags: ['api', 'admin', 'predictions', 'enrich-quickpurchases'],
            data: { matchId: quickPurchase.matchId, predictionId: existingPrediction.id }
          })
          results.skipped++
          continue
        }

        // Create or find teams and league
        const homeTeamName = matchData.home_team || matchData.homeTeam || 'Unknown Home Team'
        const awayTeamName = matchData.away_team || matchData.awayTeam || 'Unknown Away Team'
        const leagueName = matchData.league || 'Unknown League'

        // Create or find the league
        const league = await prisma.league.upsert({
          where: { name: leagueName },
          update: {},
          create: {
            name: leagueName,
            sport: 'football',
          },
        })

        // Create or find teams
        const [homeTeam, awayTeam] = await Promise.all([
          prisma.team.upsert({
            where: {
              name_leagueId: {
                name: homeTeamName,
                leagueId: league.id,
              },
            },
            update: {},
            create: {
              name: homeTeamName,
              leagueId: league.id,
            },
          }),
          prisma.team.upsert({
            where: {
              name_leagueId: {
                name: awayTeamName,
                leagueId: league.id,
              },
            },
            update: {},
            create: {
              name: awayTeamName,
              leagueId: league.id,
            },
          }),
        ])

        // Create the match
        const match = await prisma.match.create({
          data: {
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            leagueId: league.id,
            matchDate: new Date(matchData.date || matchData.matchDate || new Date()),
            status: 'upcoming',
            homeScore: null,
            awayScore: null,
            minutePlayed: null,
          }
        })

        // Extract prediction details
        const predictionType = quickPurchase.predictionType || predictionData.recommended_outcome || 'Unknown'
        const confidenceScore = quickPurchase.confidenceScore || predictionData.confidence || 0
        const odds = quickPurchase.odds || new Prisma.Decimal(1.5)
        const valueRating = quickPurchase.valueRating || 'Medium'
        const explanation = quickPurchase.analysisSummary || predictionData.detailed_reasoning || 'AI-powered prediction'

        // Determine if it should be free based on confidence
        const isFree = confidenceScore >= 80

        // Create the prediction
        const prediction = await prisma.prediction.create({
          data: {
            matchId: match.id,
            predictionType,
            confidenceScore,
            odds,
            valueRating,
            explanation,
            isFree,
            isFeatured: confidenceScore >= 85,
            status: 'pending',
            showInDailyTips: confidenceScore >= 70,
            showInWeeklySpecials: confidenceScore >= 90,
            type: 'single',
            matchesInAccumulator: undefined,
            potentialReturn: null,
            stake: null,
            totalOdds: null,
          }
        })

        results.enriched++
        logger.debug('Successfully created prediction from QuickPurchase', {
          tags: ['api', 'admin', 'predictions', 'enrich-quickpurchases'],
          data: { 
            quickPurchaseId: quickPurchase.id,
            predictionId: prediction.id,
            matchId: match.id,
            confidenceScore,
            predictionType
          }
        })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`Failed to process QuickPurchase ${quickPurchase.id}: ${errorMessage}`)
        logger.error('Failed to process QuickPurchase record', {
          tags: ['api', 'admin', 'predictions', 'enrich-quickpurchases'],
          data: { 
            quickPurchaseId: quickPurchase.id,
            error: errorMessage
          }
        })
      }
    }

    const processingTime = Date.now() - startTime

    logger.info('Completed Prediction enrichment from QuickPurchase data', {
      tags: ['api', 'admin', 'predictions', 'enrich-quickpurchases'],
      data: { 
        processingTime,
        results
      }
    })

    return NextResponse.json({
      success: true,
      message: `Enrichment completed in ${processingTime}ms`,
      ...results,
      processingTime
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    logger.error('Failed to enrich predictions from QuickPurchase data', {
      tags: ['api', 'admin', 'predictions', 'enrich-quickpurchases'],
      data: { 
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error',
      processingTime
    }, { status: 500 })
  }
}

// GET /api/admin/predictions/enrich-from-quickpurchases - Get enrichment statistics
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get statistics about QuickPurchase records that could be enriched
    const stats = await prisma.$transaction([
      // Total QuickPurchase records with match data
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          isPredictionActive: true
        }
      }),
      // QuickPurchase records with confidence >= 60%
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          confidenceScore: { gte: 60 },
          isPredictionActive: true
        }
      }),
      // QuickPurchase records with confidence >= 80%
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          confidenceScore: { gte: 80 },
          isPredictionActive: true
        }
      }),
      // QuickPurchase records with confidence >= 90%
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          confidenceScore: { gte: 90 },
          isPredictionActive: true
        }
      }),
      // Total predictions in database
      prisma.prediction.count()
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalQuickPurchasesWithMatches: stats[0],
        quickPurchasesWithConfidence60Plus: stats[1],
        quickPurchasesWithConfidence80Plus: stats[2],
        quickPurchasesWithConfidence90Plus: stats[3],
        totalPredictions: stats[4]
      }
    })

  } catch (error) {
    logger.error('Failed to get enrichment statistics', {
      tags: ['api', 'admin', 'predictions', 'enrich-quickpurchases'],
      error: error instanceof Error ? error : undefined
    })

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error'
    }, { status: 500 })
  }
} 