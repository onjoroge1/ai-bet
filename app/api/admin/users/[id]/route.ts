import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users/[id]
 *
 * Returns full drill-down for one user — profile, subscription, payment history,
 * active packages, recent notifications, quick-action context. Used by the
 * admin user-detail page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        country: { select: { name: true, code: true, currencyCode: true, currencySymbol: true } },
        purchases: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            status: true,
            packageType: true,
            createdAt: true,
          },
        },
        userPackages: {
          orderBy: { purchasedAt: 'desc' },
          take: 20,
          include: {
            packageOffer: { select: { name: true, tipCount: true } },
          },
        },
      },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Recent notifications (separate query — not on user relation)
    const notifications = await prisma.userNotification.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, title: true, message: true, type: true, category: true, isRead: true, createdAt: true },
    }).catch(() => [])

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
        emailNotifications: user.emailNotifications,
        country: user.country,
        // Subscription
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        // Tracking
        signupSource: user.signupSource,
        firstPaidAt: user.firstPaidAt,
        lastPurchaseAt: user.lastPurchaseAt,
        lifetimeValue: Number(user.lifetimeValue ?? 0),
        // Activity
        predictionCredits: user.predictionCredits,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        // Referral
        referralCode: user.referralCode,
        totalReferrals: user.totalReferrals,
      },
      purchases: user.purchases.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        status: p.status,
        packageType: p.packageType,
        createdAt: p.createdAt,
      })),
      activePackages: user.userPackages
        .filter(pkg => pkg.status === 'active')
        .map(pkg => ({
          id: pkg.id,
          name: pkg.packageOffer?.name || pkg.packageType,
          packageType: pkg.packageType,
          tipsRemaining: pkg.tipsRemaining,
          totalTips: pkg.totalTips,
          expiresAt: pkg.expiresAt,
          purchasedAt: pkg.purchasedAt,
          pricePaid: Number(pkg.pricePaid ?? 0),
          status: pkg.status,
        })),
      packageHistory: user.userPackages
        .filter(pkg => pkg.status !== 'active')
        .map(pkg => ({
          id: pkg.id,
          name: pkg.packageOffer?.name || pkg.packageType,
          status: pkg.status,
          purchasedAt: pkg.purchasedAt,
          expiresAt: pkg.expiresAt,
        })),
      notifications,
    })
  } catch (error) {
    logger.error('Admin user-detail fetch failed', { error, userId: id })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
