import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
    const status = searchParams.get('status')
    const packageId = searchParams.get('packageId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const search = searchParams.get('search')

    // Build where clause
    const where: Prisma.UserPackageTipWhereInput = {
      userPackage: {
        userId: session.user.id
      }
    }

    // Add status filter
    if (status && status !== 'all') {
      where.status = status
    }

    // Add package filter
    if (packageId && packageId !== 'all') {
      where.userPackageId = packageId
    }

    // Add date range filter
    if (dateFrom || dateTo) {
      where.claimedAt = {}
      if (dateFrom) where.claimedAt.gte = new Date(dateFrom)
      if (dateTo) where.claimedAt.lte = new Date(dateTo)
    }

    // Add search filter
    if (search) {
      where.OR = [
        {
          prediction: {
            match: {
              homeTeam: {
                name: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            }
          }
        },
        {
          prediction: {
            match: {
              awayTeam: {
                name: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            }
          }
        },
        {
          prediction: {
            match: {
              league: {
                name: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            }
          }
        }
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Get tips with all related data
    const tips = await prisma.userPackageTip.findMany({
      where,
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
            packageOffer: {
              select: {
                name: true,
                packageType: true,
                colorGradientFrom: true,
                colorGradientTo: true,
                iconName: true
              }
            }
          }
        },
        tipUsage: true
      },
      orderBy: {
        claimedAt: 'desc'
      },
      skip,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.userPackageTip.count({ where })

    // Transform the data for frontend consumption
    const transformedTips = tips.map(tip => ({
      id: tip.id,
      claimedAt: tip.claimedAt.toISOString(),
      status: tip.status,
      expiresAt: tip.expiresAt?.toISOString(),
      notes: tip.notes,
      
      // Package information
      package: {
        id: tip.userPackage.id,
        name: tip.userPackage.packageOffer.name,
        type: tip.userPackage.packageOffer.packageType,
        colorGradientFrom: tip.userPackage.packageOffer.colorGradientFrom,
        colorGradientTo: tip.userPackage.packageOffer.colorGradientTo,
        iconName: tip.userPackage.packageOffer.iconName
      },
      
      // Prediction information
      prediction: {
        id: tip.prediction.id,
        predictionType: tip.prediction.predictionType,
        confidenceScore: tip.prediction.confidenceScore,
        odds: tip.prediction.odds,
        valueRating: tip.prediction.valueRating,
        explanation: tip.prediction.explanation,
        status: tip.prediction.status,
        match: {
          id: tip.prediction.match.id,
          matchDate: tip.prediction.match.matchDate.toISOString(),
          status: tip.prediction.match.status,
          homeScore: tip.prediction.match.homeScore,
          awayScore: tip.prediction.match.awayScore,
          homeTeam: {
            id: tip.prediction.match.homeTeam.id,
            name: tip.prediction.match.homeTeam.name
          },
          awayTeam: {
            id: tip.prediction.match.awayTeam.id,
            name: tip.prediction.match.awayTeam.name
          },
          league: {
            id: tip.prediction.match.league.id,
            name: tip.prediction.match.league.name
          }
        }
      },
      
      // Usage information
      usage: tip.tipUsage ? {
        id: tip.tipUsage.id,
        usedAt: tip.tipUsage.usedAt.toISOString(),
        stakeAmount: tip.tipUsage.stakeAmount,
        actualReturn: tip.tipUsage.actualReturn,
        notes: tip.tipUsage.notes
      } : null
    }))

    return NextResponse.json({
      tips: transformedTips,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error("Error fetching tips history:", error)
    return NextResponse.json({ error: "Failed to fetch tips history" }, { status: 500 })
  }
} 