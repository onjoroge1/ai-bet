import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * POST /api/parlays/purchase - Purchase a parlay
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { parlayId, amount, paymentMethod } = body

    if (!parlayId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: parlayId, amount' },
        { status: 400 }
      )
    }

    // Verify parlay exists and is active
    const parlay = await prisma.parlayConsensus.findUnique({
      where: { parlayId },
      include: { legs: true }
    })

    if (!parlay) {
      return NextResponse.json({ error: 'Parlay not found' }, { status: 404 })
    }

    if (parlay.status !== 'active') {
      return NextResponse.json({ error: 'Parlay is not active' }, { status: 400 })
    }

    // Calculate potential return
    const potentialReturn = Number(amount) * Number(parlay.impliedOdds)

    // Create purchase record
    const purchase = await prisma.parlayPurchase.create({
      data: {
        userId: session.user.id,
        parlayId: parlay.id, // Use internal Prisma ID
        amount: Number(amount),
        paymentMethod: paymentMethod || 'stripe',
        status: 'pending',
        potentialReturn,
        purchasedAt: new Date()
      },
      include: {
        parlay: {
          include: {
            legs: {
              orderBy: { legOrder: 'asc' }
            }
          }
        }
      }
    })

    logger.info('Parlay purchase created', {
      tags: ['api', 'parlays', 'purchase'],
      data: {
        purchaseId: purchase.id,
        parlayId: parlay.parlayId,
        userId: session.user.id,
        amount: Number(amount)
      }
    })

    // TODO: Integrate with Stripe payment processing
    // For now, mark as completed (in production, this would be done after payment confirmation)
    // await prisma.parlayPurchase.update({
    //   where: { id: purchase.id },
    //   data: { status: 'completed' }
    // })

    return NextResponse.json({
      success: true,
      purchase: {
        id: purchase.id,
        parlayId: parlay.parlayId,
        amount: Number(purchase.amount),
        potentialReturn: Number(purchase.potentialReturn),
        status: purchase.status,
        purchasedAt: purchase.purchasedAt.toISOString(),
        parlay: {
          legCount: parlay.legCount,
          legs: parlay.legs.map(leg => ({
            matchId: leg.matchId,
            homeTeam: leg.homeTeam,
            awayTeam: leg.awayTeam,
            outcome: leg.outcome,
            modelProb: Number(leg.modelProb)
          })),
          impliedOdds: Number(parlay.impliedOdds),
          edgePct: Number(parlay.edgePct),
          confidenceTier: parlay.confidenceTier
        }
      }
    })
  } catch (error) {
    logger.error('Error purchasing parlay', {
      tags: ['api', 'parlays', 'purchase'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to purchase parlay', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/parlays/purchase - Get user's parlay purchases
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { userId: session.user.id }
    if (status) {
      where.status = status
    }

    const purchases = await prisma.parlayPurchase.findMany({
      where,
      include: {
        parlay: {
          include: {
            legs: {
              orderBy: { legOrder: 'asc' }
            }
          }
        }
      },
      orderBy: { purchasedAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      count: purchases.length,
      purchases: purchases.map(purchase => ({
        id: purchase.id,
        parlayId: purchase.parlay.parlayId,
        amount: Number(purchase.amount),
        potentialReturn: purchase.potentialReturn ? Number(purchase.potentialReturn) : null,
        actualReturn: purchase.actualReturn ? Number(purchase.actualReturn) : null,
        status: purchase.status,
        purchasedAt: purchase.purchasedAt.toISOString(),
        settledAt: purchase.settledAt?.toISOString() || null,
        parlay: {
          legCount: purchase.parlay.legCount,
          legs: purchase.parlay.legs.map(leg => ({
            matchId: leg.matchId,
            homeTeam: leg.homeTeam,
            awayTeam: leg.awayTeam,
            outcome: leg.outcome
          })),
          impliedOdds: Number(purchase.parlay.impliedOdds),
          edgePct: Number(purchase.parlay.edgePct),
          confidenceTier: purchase.parlay.confidenceTier
        }
      }))
    })
  } catch (error) {
    logger.error('Error fetching parlay purchases', {
      tags: ['api', 'parlays', 'purchase'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to fetch purchases', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

