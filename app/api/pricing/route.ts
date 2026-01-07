import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getDbCountryPricing } from '@/lib/server-pricing-service'
import { logger } from '@/lib/logger'

/**
 * GET /api/pricing - Get pricing plans for subscription page
 * Returns all available subscription plans with pricing
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country') || 'US' // Default to US
    
    // Try to get user's country from session if available
    const session = await getServerSession(authOptions)
    let userCountryCode = countryCode
    
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { 
          countryId: true,
          country: {
            select: { code: true }
          }
        }
      })
      if (user?.country?.code) {
        userCountryCode = user.country.code
      }
    }

    // Get country info
    const country = await prisma.country.findUnique({
      where: { code: userCountryCode.toLowerCase() },
      select: { id: true, code: true, name: true, currencyCode: true, currencySymbol: true }
    })

    const finalCountryCode = country?.code || 'us'
    const currencyCode = country?.currencyCode || 'USD'
    const currencySymbol = country?.currencySymbol || '$'

    // Define subscription plans
    const plans = [
      {
        id: 'free',
        name: 'Free',
        description: 'Get started with basic predictions',
        price: 0,
        originalPrice: null,
        period: 'forever',
        features: [
          '3 free predictions daily',
          'Basic AI analysis',
          'Community access',
          'Mobile app access'
        ],
        popular: false,
        planType: 'free'
      },
      {
        id: 'parlay_pro',
        name: 'Parlay Pro',
        description: 'Unlimited access to AI-powered parlay recommendations',
        price: 11.99, // Promotional price (60% off $29.99)
        originalPrice: 29.99,
        period: 'month',
        discount: 60,
        features: [
          'Unlimited parlay access',
          'AI-powered parlay analysis',
          'Quality filtering (tradable only)',
          'Risk assessment and edge calculations',
          'Historical parlay performance',
          'Email alerts for new parlays',
          'Priority customer support'
        ],
        popular: true,
        planType: 'subscription',
        stripePriceId: process.env.STRIPE_PARLAY_PRO_PRICE_ID || '' // Set in env
      },
      {
        id: 'premium_intelligence',
        name: 'Premium Intelligence',
        description: 'Advanced analytics and insights for serious bettors',
        price: null, // Country-specific
        originalPrice: null,
        period: 'month',
        features: [
          'All Premium Dashboard features',
          'CLV Tracker',
          'AI Intelligence feeds',
          'Advanced analytics',
          'Model comparisons',
          'Real-time updates',
          'Priority support'
        ],
        popular: false,
        planType: 'subscription',
        countrySpecific: true
      },
      {
        id: 'complete',
        name: 'Complete Package',
        description: 'Everything in Parlay Pro + Premium Intelligence',
        price: null, // Combined pricing (future)
        originalPrice: null,
        period: 'month',
        features: [
          'Everything in Parlay Pro',
          'Everything in Premium Intelligence',
          'Best value for power users',
          'Exclusive features',
          'Highest priority support'
        ],
        popular: false,
        planType: 'subscription',
        comingSoon: true
      }
    ]

    // Get country-specific pricing for Premium Intelligence
    let premiumIntelligencePrice: { price: number; currencyCode: string; currencySymbol: string } | null = null
    try {
      const premiumPricing = await getDbCountryPricing(finalCountryCode, 'monthly_sub')
      premiumIntelligencePrice = {
        price: premiumPricing.price,
        currencyCode: premiumPricing.currencyCode || currencyCode,
        currencySymbol: premiumPricing.currencySymbol || currencySymbol
      }
    } catch (error) {
      logger.warn('Failed to get Premium Intelligence pricing', {
        tags: ['api', 'pricing'],
        data: { countryCode: finalCountryCode, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      // Use default pricing
      premiumIntelligencePrice = {
        price: 79,
        currencyCode: currencyCode,
        currencySymbol: currencySymbol
      }
    }

    // Format plans with pricing
    const formattedPlans = plans.map(plan => {
      if (plan.id === 'premium_intelligence' && premiumIntelligencePrice) {
        return {
          ...plan,
          price: premiumIntelligencePrice.price,
          currencyCode: premiumIntelligencePrice.currencyCode,
          currencySymbol: premiumIntelligencePrice.currencySymbol,
        }
      }
      
      if (plan.id === 'parlay_pro') {
        return {
          ...plan,
          currencyCode: currencyCode,
          currencySymbol: currencySymbol,
        }
      }

      return {
        ...plan,
        currencyCode: currencyCode,
        currencySymbol: currencySymbol,
      }
    })

    return NextResponse.json({
      plans: formattedPlans,
      country: {
        code: finalCountryCode,
        name: country?.name || 'United States',
        currencyCode,
        currencySymbol,
      },
    })
  } catch (error) {
    logger.error('Error fetching pricing plans', {
      tags: ['api', 'pricing'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to fetch pricing plans', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

