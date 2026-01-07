import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, formatAmountForStripe, getStripeCurrency } from '@/lib/stripe-server'
import { getDbCountryPricing } from '@/lib/server-pricing-service'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000'

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

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
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
      parlay_pro: {
        name: 'Parlay Pro',
        description: 'Unlimited access to AI-powered parlay recommendations',
        priceId: process.env.STRIPE_PARLAY_PRO_PRICE_ID, // Set in .env
        amount: 11.99, // Fallback if price ID not set
        metadata: {
          planType: 'parlay_pro',
          subscriptionType: 'monthly',
        }
      },
      premium_intelligence: {
        name: 'Premium Intelligence',
        description: 'Advanced analytics and insights for serious bettors',
        // No priceId - use country-specific pricing
        metadata: {
          planType: 'premium_intelligence',
          subscriptionType: 'monthly',
        }
      },
      complete: {
        name: 'Complete Package',
        description: 'Everything in Parlay Pro + Premium Intelligence',
        // Coming soon - not implemented yet
        metadata: {
          planType: 'complete',
          subscriptionType: 'monthly',
        }
      }
    }

    const planConfig = planConfigs[planId]
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

    if (planId === 'complete') {
      return NextResponse.json({ error: 'Complete Package coming soon' }, { status: 400 })
    }

    let stripePriceId: string | undefined
    let amount: number
    let finalCurrencyCode = currencyCode

    // Get pricing based on plan
    if (planId === 'parlay_pro') {
      // Use Stripe Price ID if set, otherwise use fallback amount
      if (planConfig.priceId) {
        stripePriceId = planConfig.priceId
        // Don't set amount when using price ID - Stripe will use the price
        amount = 0 // Not used when priceId is set
      } else {
        // Fallback: create checkout session with price_data
        amount = planConfig.amount || 11.99
        finalCurrencyCode = 'USD' // Paray Pro is USD only
      }
    } else if (planId === 'premium_intelligence') {
      // Get country-specific pricing
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
  } catch (error) {
    logger.error('Error creating subscription checkout session', {
      tags: ['api', 'subscriptions', 'checkout'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

