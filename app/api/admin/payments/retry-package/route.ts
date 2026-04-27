import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/payments/retry-package
 * Body: { packagePurchaseId: string, note?: string }
 *
 * Retries package creation for a previously-failed PackagePurchase row.
 * Mirrors the package-creation portion of webhook handlePaymentSuccess
 * (the user was charged successfully — that part is fine — only the
 * post-payment provisioning failed).
 *
 * On success:
 *  - Creates UserPackage with appropriate tipCount/validity for the package type
 *  - Adds tipCount credits to user.predictionCredits (capped via Prisma increment)
 *  - Flips PackagePurchase.status = 'completed_via_retry' (distinguishable in audit)
 *  - Notifies the user that their package is now active
 *
 * Idempotent: if status is anything other than PACKAGE_CREATION_FAILED, returns 409.
 */

// Mirrors the switch statement inside createUserPackage in the webhook.
// Centralised here so retries don't drift from the original definition.
function packageDefaults(packageType: string): { tipCount: number; validityDays: number; name: string } {
  switch (packageType) {
    case 'prediction':
      return { tipCount: 1, validityDays: 1, name: 'Single Tip' }
    case 'weekend_pass':
      return { tipCount: 5, validityDays: 3, name: 'Weekend Package' }
    case 'weekly_pass':
      return { tipCount: 8, validityDays: 7, name: 'Weekly Package' }
    case 'monthly_sub':
      return { tipCount: -1, validityDays: 30, name: 'Monthly Subscription' } // -1 = unlimited
    default:
      return { tipCount: 1, validityDays: 1, name: packageType }
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { packagePurchaseId, note } = await request.json()
    if (!packagePurchaseId) {
      return NextResponse.json({ error: 'packagePurchaseId required' }, { status: 400 })
    }

    const pp = await prisma.packagePurchase.findUnique({
      where: { id: packagePurchaseId },
      include: { user: { select: { id: true, email: true, country: { select: { currencyCode: true, currencySymbol: true } } } } },
    })

    if (!pp) {
      return NextResponse.json({ error: 'PackagePurchase not found' }, { status: 404 })
    }

    if (pp.status !== 'PACKAGE_CREATION_FAILED') {
      return NextResponse.json({
        error: `Cannot retry a row in status "${pp.status}". Only PACKAGE_CREATION_FAILED rows are retryable.`,
      }, { status: 409 })
    }

    // Try to resolve the canonical PackageOfferCountryPrice (preferred) or fall back
    // to packageType-based defaults if the offer was deleted/missing.
    let tipCount: number
    let validityDays: number
    let packageName: string
    let pricePaid = Number(pp.amount)
    let currencyCode = pp.user?.country?.currencyCode || 'USD'
    let currencySymbol = pp.user?.country?.currencySymbol || '$'
    let packageOfferId: string | null = null

    // packageOfferId on PackagePurchase may be a PackageOfferCountryPrice id (synthesized
    // earlier in webhook flow) or a real PackageOffer id. Try CountryPrice first.
    if (pp.packageOfferId) {
      const offerCountryPrice = await prisma.packageOfferCountryPrice.findUnique({
        where: { id: pp.packageOfferId },
        include: { packageOffer: true },
      })
      if (offerCountryPrice) {
        tipCount = offerCountryPrice.packageOffer.tipCount
        validityDays = offerCountryPrice.packageOffer.validityDays
        packageName = offerCountryPrice.packageOffer.name
        currencyCode = offerCountryPrice.currencyCode
        currencySymbol = offerCountryPrice.currencySymbol
        packageOfferId = offerCountryPrice.packageOfferId
      } else {
        // Fall back to packageType defaults
        const def = packageDefaults(pp.packageType)
        tipCount = def.tipCount
        validityDays = def.validityDays
        packageName = def.name
      }
    } else {
      const def = packageDefaults(pp.packageType)
      tipCount = def.tipCount
      validityDays = def.validityDays
      packageName = def.name
    }

    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
    const creditsToAdd = tipCount > 0 ? tipCount : 0 // unlimited (-1) doesn't add prediction credits

    // Atomic: create UserPackage, increment credits (if applicable), flip PackagePurchase
    const [userPackage] = await prisma.$transaction([
      prisma.userPackage.create({
        data: {
          userId: pp.userId,
          packageOfferId: packageOfferId ?? pp.packageOfferId ?? '',
          expiresAt,
          tipsRemaining: tipCount > 0 ? tipCount : 0,
          totalTips: tipCount,
          pricePaid: new Prisma.Decimal(pricePaid),
          currencyCode,
          currencySymbol,
          status: 'active',
          packageType: pp.packageType,
        },
      }),
      ...(creditsToAdd > 0 ? [
        prisma.user.update({
          where: { id: pp.userId },
          data: {
            predictionCredits: { increment: creditsToAdd },
            totalCreditsEarned: { increment: creditsToAdd },
          },
        }),
      ] : []),
      prisma.packagePurchase.update({
        where: { id: pp.id },
        data: { status: 'completed_via_retry' },
      }),
    ])

    logger.info('[Admin] Retried package creation succeeded', {
      tags: ['admin', 'payments', 'retry-package'],
      data: {
        packagePurchaseId: pp.id,
        userId: pp.userId,
        userPackageId: userPackage.id,
        creditsAdded: creditsToAdd,
        adminUserId: session.user.id,
        note,
      },
    })

    // Notify the user
    try {
      const { NotificationService } = await import('@/lib/notification-service')
      await NotificationService.createNotification({
        userId: pp.userId,
        title: 'Package Activated',
        message: `Your ${packageName} purchase has been activated.${creditsToAdd > 0 ? ` ${creditsToAdd} prediction credits have been added to your account.` : ''} Sorry for the delay!`,
        type: 'success',
        category: 'payment',
        actionUrl: '/dashboard/my-tips',
      })
    } catch (e) {
      logger.error('[Admin] retry-package: failed to notify user', { error: e instanceof Error ? e : undefined })
    }

    return NextResponse.json({
      success: true,
      userPackageId: userPackage.id,
      creditsAdded: creditsToAdd,
      packageName,
      expiresAt,
    })
  } catch (error) {
    logger.error('[Admin] Retry package failed', {
      tags: ['admin', 'payments', 'retry-package', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: 'Retry failed', detail: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}
