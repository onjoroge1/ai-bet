import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

// GET /api/admin/predictions/debug-quickpurchases - Debug QuickPurchase records
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all QuickPurchase records with basic info
    const allQuickPurchases = await prisma.quickPurchase.findMany({
      select: {
        id: true,
        name: true,
        matchId: true,
        isPredictionActive: true,
        predictionData: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Limit to last 20 for debugging
    })

    // Get counts for different categories
    const counts = await prisma.$transaction([
      // Total QuickPurchase records
      prisma.quickPurchase.count(),
      // Records with matchId
      prisma.quickPurchase.count({
        where: { matchId: { not: null } }
      }),
      // Records without prediction data
      prisma.quickPurchase.count({
        where: { predictionData: { equals: Prisma.JsonNull } }
      }),
      // Records with prediction data
      prisma.quickPurchase.count({
        where: { predictionData: { not: Prisma.JsonNull } }
      }),
      // Records that are prediction active
      prisma.quickPurchase.count({
        where: { isPredictionActive: true }
      }),
      // Records that match enrichment criteria
      prisma.quickPurchase.count({
        where: {
          matchId: { not: null },
          predictionData: { equals: Prisma.JsonNull },
          isPredictionActive: true
        }
      })
    ])

    // Get sample records for each category
    const samples = await prisma.$transaction([
      // Sample with matchId
      prisma.quickPurchase.findMany({
        where: { matchId: { not: null } },
        select: { id: true, name: true, matchId: true, predictionData: true, isPredictionActive: true },
        take: 5
      }),
      // Sample without prediction data
      prisma.quickPurchase.findMany({
        where: { predictionData: { equals: Prisma.JsonNull } },
        select: { id: true, name: true, matchId: true, predictionData: true, isPredictionActive: true },
        take: 5
      }),
      // Sample that are prediction active
      prisma.quickPurchase.findMany({
        where: { isPredictionActive: true },
        select: { id: true, name: true, matchId: true, predictionData: true, isPredictionActive: true },
        take: 5
      })
    ])

    return NextResponse.json({
      success: true,
      data: {
        totalQuickPurchases: counts[0],
        withMatchId: counts[1],
        withoutPredictionData: counts[2],
        withPredictionData: counts[3],
        predictionActive: counts[4],
        matchingEnrichmentCriteria: counts[5],
        allRecords: allQuickPurchases,
        samples: {
          withMatchId: samples[0],
          withoutPredictionData: samples[1],
          predictionActive: samples[2]
        }
      }
    })

  } catch (error) {
    logger.error('Failed to debug QuickPurchase records', {
      tags: ['api', 'admin', 'predictions', 'debug'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
