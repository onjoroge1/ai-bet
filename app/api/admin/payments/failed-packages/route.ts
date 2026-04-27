import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/payments/failed-packages
 *
 * Returns PackagePurchase rows where createUserPackage failed during the
 * webhook (status = 'PACKAGE_CREATION_FAILED'). The user has been charged
 * but never received their package — these need admin intervention.
 *
 * Pairs with POST /api/admin/payments/retry-package which retries the
 * package creation.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const includeResolved = searchParams.get('includeResolved') === 'true'

    const where = includeResolved
      ? { status: { in: ['PACKAGE_CREATION_FAILED', 'completed_via_retry'] } }
      : { status: 'PACKAGE_CREATION_FAILED' }

    const rows = await prisma.packagePurchase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: { id: true, email: true, fullName: true, predictionCredits: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      count: rows.length,
      rows: rows.map(r => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.user.email,
        userName: r.user.fullName,
        userCurrentCredits: r.user.predictionCredits,
        amount: r.amount.toString(),
        paymentMethod: r.paymentMethod,
        packageType: r.packageType,
        packageOfferId: r.packageOfferId,
        countryId: r.countryId,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    })
  } catch (error) {
    logger.error('[Admin] Failed to list PACKAGE_CREATION_FAILED rows', {
      tags: ['admin', 'payments', 'failed-packages'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
