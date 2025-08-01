import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { format = 'csv', filters = {} } = await request.json()
    const userId = session.user.id

    // Build where clause based on filters
    const where: any = {
      userPackage: {
        userId: userId
      }
    }

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status
    }

    if (filters.package && filters.package !== 'all') {
      where.userPackage = {
        ...where.userPackage,
        packageOffer: {
          packageType: filters.package
        }
      }
    }

    if (filters.dateFrom || filters.dateTo) {
      where.claimedAt = {}
      if (filters.dateFrom) where.claimedAt.gte = new Date(filters.dateFrom)
      if (filters.dateTo) where.claimedAt.lte = new Date(filters.dateTo)
    }

    if (filters.search) {
      where.OR = [
        {
          prediction: {
            match: {
              homeTeam: {
                name: {
                  contains: filters.search,
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
                  contains: filters.search,
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
                  contains: filters.search,
                  mode: 'insensitive'
                }
              }
            }
          }
        }
      ]
    }

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
            packageOffer: true
          }
        },
        tipUsage: true
      },
      orderBy: {
        claimedAt: 'desc'
      }
    })

    if (format === 'csv') {
      // Generate CSV content
      const csvHeaders = [
        'Tip ID',
        'Claimed Date',
        'Status',
        'Package',
        'Match',
        'League',
        'Prediction Type',
        'Confidence Score',
        'Odds',
        'Value Rating',
        'Stake Amount',
        'Actual Return',
        'Result',
        'Notes'
      ]

      const csvRows = tips.map(tip => [
        tip.id,
        tip.claimedAt.toISOString().split('T')[0],
        tip.status,
        tip.userPackage.packageOffer.name,
        `${tip.prediction.match.homeTeam.name} vs ${tip.prediction.match.awayTeam.name}`,
        tip.prediction.match.league.name,
        tip.prediction.predictionType,
        tip.prediction.confidenceScore,
        tip.prediction.odds.toString(),
        tip.prediction.valueRating,
        tip.tipUsage?.stakeAmount?.toString() || '',
        tip.tipUsage?.actualReturn?.toString() || '',
        (tip as any).result || 'pending',
        tip.notes || ''
      ])

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      // Return CSV file
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="tips-history-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Return JSON format
    return NextResponse.json({
      tips: tips.map(tip => ({
        id: tip.id,
        claimedAt: tip.claimedAt.toISOString(),
        status: tip.status,
        package: tip.userPackage.packageOffer.name,
        match: `${tip.prediction.match.homeTeam.name} vs ${tip.prediction.match.awayTeam.name}`,
        league: tip.prediction.match.league.name,
        predictionType: tip.prediction.predictionType,
        confidenceScore: tip.prediction.confidenceScore,
        odds: tip.prediction.odds,
        valueRating: tip.prediction.valueRating,
        stakeAmount: tip.tipUsage?.stakeAmount,
        actualReturn: tip.tipUsage?.actualReturn,
        result: (tip as any).result,
        notes: tip.notes
      }))
    })

  } catch (error) {
    console.error('Error exporting tips history:', error)
    return NextResponse.json(
      { error: 'Failed to export tips history' },
      { status: 500 }
    )
  }
} 