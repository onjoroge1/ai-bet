import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, formatAmountForStripe, getStripeCurrency } from '@/lib/stripe-server'
import { getDbCountryPricing } from '@/lib/server-pricing-service'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// VERCEL_URL doesn't include https:// — ensure we always have a full URL with scheme
const rawUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || 'http://localhost:3000'
const BASE_URL = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

/**
 * POST /api/subscriptions/checkout - Create Stripe Checkout Session for subscription
 * 
 * Body: { planId: string, successUrl?: string, cancelUrl?: string }
 * 
 * Plans: 'parlay_pro' | 'premium_intelligence' | 'complete'
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { planId, successUrl, cancelUrl } = body

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    logger.info('Checkout request received', {
      tags: ['api', 'subscriptions', 'checkout'],
      data: { planId, planIdType: typeof planId, userId: session.user.id }
    })

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
        countryId: true,
        country: {
          select: {
            code: true,
            currencyCode: true,
            currencySymbol: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Admin users already have full access via role check (lib/premium-access).
    // Block them from accidentally creating a real Stripe subscription on top
    // of their admin role — would charge the company card with no benefit.
    if (user.role?.toLowerCase() === 'admin') {
      logger.info('Checkout blocked for admin user — already has full access', {
        tags: ['api', 'subscriptions', 'checkout', 'admin'],
        data: { userId: user.id },
      })
      return NextResponse.json({
        error: 'You already have full admin access. No subscription needed.',
        code: 'ADMIN_HAS_ACCESS',
      }, { status: 409 })
    }

    // Require email verification before paying.
    // Disposable-email signups would otherwise pay without ever proving the
    // address is valid, blocking dispute resolution and notifications.
    if (!user.emailVerified) {
      logger.warn('Checkout blocked: email not verified', {
        tags: ['api', 'subscriptions', 'checkout', 'auth'],
        data: { userId: user.id, email: user.email },
      })
      return NextResponse.json({
        error: 'Please verify your email address before subscribing. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED',
        resendUrl: '/resend-verification',
      }, { status: 403 })
    }

    const userCountryCode = user.country?.code || 'us'
    const currencyCode = user.country?.currencyCode || 'USD'
    const currencySymbol = user.country?.currencySymbol || '$'

    // Define plan configurations
    const planConfigs: Record<string, {
      name: string
      description: string
      priceId?: string // Stripe Price ID (set in env)
      amount?: number // Fallback amount if price ID not set
      metadata: Record<string, string>
    }> = {
      // Starter tier (legacy: parlay_pro)
      parlay_pro: {
        name: 'Starter',
        description: 'Basic predictions and match analysis',
        amount: 9.99,
        metadata: { planType: 'starter', subscriptionType: 'monthly' }
      },
      starter_monthly: {
        name: 'Starter',
        description: 'Basic predictions and match analysis',
        amount: 9.99,
        metadata: { planType: 'starter', subscriptionType: 'monthly' }
      },
      // Pro tier
      pro_monthly: {
        name: 'Pro',
        description: 'Unlimited SnapBet Picks, all sports, AI parlays, player predictions',
        metadata: { planType: 'pro', subscriptionType: 'monthly' }
      },
      // VIP tier (legacy: premium_intelligence)
      premium_intelligence: {
        name: 'VIP',
        description: 'Everything in Pro plus Edge Finder, AI Builder, advanced analytics',
        metadata: { planType: 'vip', subscriptionType: 'monthly' }
      },
      vip_monthly: {
        name: 'VIP',
        description: 'Everything in Pro plus Edge Finder, AI Builder, advanced analytics',
        metadata: { planType: 'vip', subscriptionType: 'monthly' }
      },
      // Complete (coming soon)
      complete: {
        name: 'Complete Package',
        description: 'Everything included',
        metadata: { planType: 'complete', subscriptionType: 'monthly' }
      }
    }

    const planConfig = planConfigs[planId]
    if (!planConfig) {
      return NextResponse.json({
        error: `Invalid plan ID: "${planId}". Valid plans: ${Object.keys(planConfigs).join(', ')}`,
      }, { status: 400 })
    }

    if (planId === 'complete') {
      return NextResponse.json({ error: 'Complete Package coming soon' }, { status: 400 })
    }

    // Check if user already has an active subscription at the same or higher tier
    const subUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionStatus: true, subscriptionPlan: true },
    })

    if (subUser?.subscriptionStatus && ['active', 'trialing'].includes(subUser.subscriptionStatus)) {
      const tierOrder: Record<string, number> = { starter: 1, pro: 2, vip: 3, complete: 4 }
      const requestedTier = planConfig.metadata?.planType
      const existingPlan = subUser.subscriptionPlan?.toLowerCase() || ''
      const existingLevel = tierOrder[existingPlan] ?? 0
      const requestedLevel = tierOrder[requestedTier || ''] ?? 0

      if (requestedLevel <= existingLevel) {
        return NextResponse.json({
          error: `You already have an active ${existingPlan} subscription. Manage it in your dashboard settings.`,
          existingPlan,
        }, { status: 409 })
      }
    }

    let stripePriceId: string | undefined
    let amount: number
    let finalCurrencyCode = currencyCode

    // Get pricing based on plan
    const isStarterPlan = ['parlay_pro', 'starter_monthly'].includes(planId)
    const isProOrVipPlan = ['pro_monthly', 'premium_intelligence', 'vip_monthly'].includes(planId)

    if (isStarterPlan) {
      // Starter: fixed price
      amount = planConfig.amount || 9.99
      finalCurrencyCode = 'USD'
    } else if (isProOrVipPlan) {
      // Pro & VIP: use country-specific pricing
      try {
        const countryPricing = await getDbCountryPricing(userCountryCode, 'monthly_sub')
        amount = countryPricing.price
        finalCurrencyCode = countryPricing.currencyCode || currencyCode
      } catch (error) {
        logger.error('Failed to get Premium Intelligence pricing', {
          tags: ['api', 'subscriptions', 'checkout'],
          data: { userId: user.id, countryCode: userCountryCode, error: error instanceof Error ? error.message : 'Unknown error' }
        })
        return NextResponse.json(
          { error: 'Failed to get pricing for your country. Please contact support.' },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json({ error: 'Invalid plan configuration' }, { status: 400 })
    }

    // Build success and cancel URLs
    const defaultSuccessUrl = `${BASE_URL}/dashboard/settings?tab=subscriptions&success=true`
    const defaultCancelUrl = `${BASE_URL}/pricing?plan=${planId}&canceled=true`
    const finalSuccessUrl = successUrl || defaultSuccessUrl
    const finalCancelUrl = cancelUrl || defaultCancelUrl

    // Create Stripe Checkout Session
    const sessionParams: any = {
      mode: 'subscription',
      customer_email: user.email,
      metadata: {
        userId: user.id,
        userEmail: user.email,
        ...planConfig.metadata,
        countryCode: userCountryCode,
      },
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      allow_promotion_codes: true,
    }

    // Add line items
    if (stripePriceId) {
      // Use existing Stripe Price ID (recommended)
      sessionParams.line_items = [
        {
          price: stripePriceId,
          quantity: 1,
        }
      ]
    } else {
      // Create price_data on the fly (fallback)
      sessionParams.line_items = [
        {
          price_data: {
            currency: getStripeCurrency(finalCurrencyCode),
            product_data: {
              name: planConfig.name,
              description: planConfig.description,
            },
            unit_amount: formatAmountForStripe(amount, finalCurrencyCode),
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        }
      ]
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams)

    logger.info('Created subscription checkout session', {
      tags: ['api', 'subscriptions', 'checkout'],
      data: {
        userId: user.id,
        planId,
        sessionId: checkoutSession.id,
        amount: stripePriceId ? 'from_price_id' : amount,
        currency: finalCurrencyCode,
      }
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error'
    const stripeCode = error?.code || error?.type || ''
    const stripeDeclineCode = error?.decline_code || ''

    logger.error('Error creating subscription checkout session', {
      tags: ['api', 'subscriptions', 'checkout'],
      data: {
        error: errorMessage,
        stripeCode,
        stripeDeclineCode,
        stack: error?.stack?.substring(0, 500),
      }
    })
    return NextResponse.json(
      {
        error: `Failed to create checkout session: ${errorMessage}`,
        details: errorMessage,
        stripeCode,
      },
      { status: 500 }
    )
  }
}

