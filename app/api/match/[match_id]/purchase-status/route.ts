import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

/**
 * Check if user has purchased a match by match_id
 * GET /api/match/[match_id]/purchase-status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const { match_id: matchId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ 
        isPurchased: false, 
        isAuthenticated: false 
      })
    }

    // Find QuickPurchase items with this matchId
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: matchId,
        type: { in: ['prediction', 'tip'] },
        isActive: true
      },
      select: {
        id: true
      }
    })

    if (quickPurchases.length === 0) {
      return NextResponse.json({
        isPurchased: false,
        isAuthenticated: true,
        quickPurchaseId: null
      })
    }

    const quickPurchaseIds = quickPurchases.map(qp => qp.id)

    // Check if user has any completed purchases for these QuickPurchase items
    const purchase = await prisma.purchase.findFirst({
      where: {
        userId: session.user.id,
        quickPurchaseId: { in: quickPurchaseIds },
        status: 'completed'
      },
      select: {
        id: true,
        quickPurchaseId: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      isPurchased: !!purchase,
      isAuthenticated: true,
      quickPurchaseId: purchase?.quickPurchaseId || quickPurchaseIds[0] || null,
      purchaseDate: purchase?.createdAt || null
    })
  } catch (error) {
    console.error('Error checking purchase status:', error)
    return NextResponse.json(
      { error: 'Failed to check purchase status' },
      { status: 500 }
    )
  }
}

