import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe-server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/subscriptions/manage
 * Returns the current user's subscription status.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check for active UserPackage records (Weekend, Weekly, Monthly, VIP)
    const now = new Date()
    const activePackage = await prisma.userPackage.findFirst({
      where: {
        userId: session.user.id,
        status: 'active',
        expiresAt: {
          gt: now
        }
      },
      include: {
        packageOffer: {
          select: {
            name: true,
            packageType: true
          }
        }
      },
      orderBy: {
        expiresAt: 'desc'
      }
    })

    // Fetch live subscription from Stripe if we have an ID
    let stripeSubscription: {
      cancelAtPeriodEnd: boolean
      currentPeriodEnd: number | null
      status: string
    } | null = null

    if (user.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
        stripeSubscription = {
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: sub.current_period_end,
          status: sub.status,
        }
      } catch (_err) {
        logger.warn('Failed to retrieve Stripe subscription', {
          tags: ['subscriptions', 'manage'],
          data: { subId: user.stripeSubscriptionId },
        })
      }
    }

    // Compute derived access flags for the frontend
    const plan = user.subscriptionPlan ?? null
    const status = stripeSubscription?.status ?? user.subscriptionStatus ?? null
    const expiresAt = user.subscriptionExpiresAt
      ? user.subscriptionExpiresAt.toISOString()
      : stripeSubscription?.currentPeriodEnd
        ? new Date(stripeSubscription.currentPeriodEnd * 1000).toISOString()
        : null

    const blockedStatuses = ['canceled', 'cancelled', 'unpaid', 'incomplete_expired']
    const isExplicitlyBlocked =
      !!status && blockedStatuses.includes(status.toLowerCase())
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false

    const isAdmin = user.role?.toLowerCase() === 'admin'

    // If user has active package, use that instead of subscription plan
    let finalPlan = plan
    let finalExpiresAt = expiresAt
    let finalStatus = status
    let finalHasAccess = false

    if (activePackage) {
      // User has active package - this takes precedence
      finalPlan = activePackage.packageOffer?.name || 'Package'
      finalExpiresAt = activePackage.expiresAt.toISOString()
      finalStatus = 'active'
      finalHasAccess = true
    } else {
      // No active package, check subscription
      const isPremiumPlan =
        !!plan &&
        (plan.toLowerCase().includes('premium') ||
          plan.toLowerCase().includes('monthly') ||
          plan.toLowerCase().includes('vip'))

      finalHasAccess = isAdmin || (isPremiumPlan && !isExpired && !isExplicitlyBlocked)
      finalStatus = finalHasAccess ? (status ?? 'active') : status
    }

    return NextResponse.json({
      hasAccess: finalHasAccess,
      plan: isAdmin && (!finalPlan || finalPlan === 'free') ? 'VIP Monthly (Admin)' : finalPlan,
      status: finalStatus,
      expiresAt: finalExpiresAt,
      isExpired: finalExpiresAt ? new Date(finalExpiresAt) < new Date() : true,
      hasActivePackage: !!activePackage, // Include flag for frontend
      // Raw Stripe info (for portal / cancel actions)
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripe: stripeSubscription,
    })
  } catch (error) {
    logger.error('Error fetching subscription', {
      tags: ['subscriptions', 'manage'],
      data: { error: error instanceof Error ? error.message : 'Unknown' },
    })
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}

/**
 * POST /api/subscriptions/manage
 * Actions: cancel | reactivate | portal
 *
 * Body: { action: 'cancel' | 'reactivate' | 'portal', returnUrl?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, returnUrl } = body as {
      action: 'cancel' | 'reactivate' | 'portal'
      returnUrl?: string
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const BASE_URL =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // ── Customer Portal (managed by Stripe) ───────────────────────────────
    if (action === 'portal') {
      if (!user.stripeCustomerId) {
        return NextResponse.json(
          { error: 'No active subscription found' },
          { status: 400 }
        )
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl || `${BASE_URL}/dashboard/settings?tab=subscriptions`,
      })

      return NextResponse.json({ url: portalSession.url })
    }

    // ── Cancel subscription (at period end) ───────────────────────────────
    if (action === 'cancel') {
      if (!user.stripeSubscriptionId) {
        return NextResponse.json(
          { error: 'No active subscription to cancel' },
          { status: 400 }
        )
      }

      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })

      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'cancel_at_period_end' },
      })

      logger.info('Subscription set to cancel at period end', {
        tags: ['subscriptions', 'manage'],
        data: { userId: user.id },
      })

      return NextResponse.json({
        success: true,
        message: 'Subscription will be cancelled at the end of the current billing period.',
      })
    }

    // ── Reactivate (undo cancel) ───────────────────────────────────────────
    if (action === 'reactivate') {
      if (!user.stripeSubscriptionId) {
        return NextResponse.json(
          { error: 'No subscription to reactivate' },
          { status: 400 }
        )
      }

      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false,
      })

      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'active' },
      })

      logger.info('Subscription reactivated', {
        tags: ['subscriptions', 'manage'],
        data: { userId: user.id },
      })

      return NextResponse.json({
        success: true,
        message: 'Your subscription has been reactivated.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    logger.error('Error managing subscription', {
      tags: ['subscriptions', 'manage'],
      data: { error: error instanceof Error ? error.message : 'Unknown' },
    })
    return NextResponse.json({ error: 'Failed to manage subscription' }, { status: 500 })
  }
}

