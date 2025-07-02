import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country') || 'US' // Default to US

    // Get country ID from country code
    const country = await prisma.country.findFirst({
      where: { code: countryCode },
      select: { id: true, currencyCode: true, currencySymbol: true }
    })

    if (!country) {
      return NextResponse.json(
        { error: "Country not found" },
        { status: 404 }
      )
    }

    // Get pricing plans for the country
    const pricingPlans = await prisma.pricingPlan.findMany({
      where: { 
        countryId: country.id,
        isActive: true 
      },
      orderBy: [
        { planType: "asc" },
        { priceAmount: "asc" }
      ]
    })

    // Transform pricing plans
    const transformedPricingPlans = pricingPlans.map(plan => ({
      id: plan.id,
      name: plan.name,
      price: `${country.currencySymbol}${plan.priceAmount}`,
      originalPrice: plan.originalPrice ? `${country.currencySymbol}${plan.originalPrice}` : null,
      period: plan.billingPeriod,
      description: plan.description || "Premium predictions and insights",
      features: plan.features ? JSON.parse(plan.features as string) : [],
      isPopular: plan.isPopular,
      planType: plan.planType,
      currencyCode: country.currencyCode,
      currencySymbol: country.currencySymbol
    }))

    // Get premium package prices from PackageCountryPrice
    const premiumPackageTypes = ["prediction", "weekend_pass", "weekly_pass", "monthly_sub"]
    const premiumPackages = await prisma.packageCountryPrice.findMany({
      where: {
        countryId: country.id,
        packageType: { in: premiumPackageTypes }
      },
      include: { country: true }
    })

    // Define package metadata for the frontend
    const packageMetadata: Record<string, {
      name: string
      description: string
      tipCount: number
      validityDays: number
      features: string[]
      iconName: string
      colorGradientFrom: string
      colorGradientTo: string
      displayOrder: number
    }> = {
      prediction: {
        name: 'Single Tip',
        description: 'One premium prediction with detailed analysis',
        tipCount: 1,
        validityDays: 1,
        features: [
          '1 Premium Tip',
          'Detailed Analysis',
          'Confidence Score',
          '24-Hour Validity'
        ],
        iconName: 'Zap',
        colorGradientFrom: '#3B82F6',
        colorGradientTo: '#1D4ED8',
        displayOrder: 1
      },
      weekend_pass: {
        name: 'Weekend Package',
        description: 'Weekend special with 5 tips (Friday-Sunday)',
        tipCount: 5,
        validityDays: 3,
        features: [
          '5 Premium Tips',
          'Weekend Coverage',
          'Live Updates',
          'Priority Support',
          '3-Day Validity'
        ],
        iconName: 'Calendar',
        colorGradientFrom: '#8B5CF6',
        colorGradientTo: '#7C3AED',
        displayOrder: 2
      },
      weekly_pass: {
        name: 'Weekly Package',
        description: 'Full week coverage with 8 premium tips',
        tipCount: 8,
        validityDays: 7,
        features: [
          '8 Premium Tips',
          'Weekly Analysis',
          'Trend Reports',
          'VIP Chat Access',
          '7-Day Validity'
        ],
        iconName: 'TrendingUp',
        colorGradientFrom: '#10B981',
        colorGradientTo: '#059669',
        displayOrder: 3
      },
      monthly_sub: {
        name: 'Monthly Subscription',
        description: 'VIP Zone - Unlimited tips for the entire month',
        tipCount: -1, // -1 indicates unlimited
        validityDays: 30,
        features: [
          'Unlimited Tips',
          'VIP Zone Access',
          'Priority Support',
          'Advanced Analytics',
          '30-Day Validity',
          'Exclusive Content'
        ],
        iconName: 'Crown',
        colorGradientFrom: '#F59E0B',
        colorGradientTo: '#D97706',
        displayOrder: 4
      }
    }

    // Transform premium packages for frontend (matching PackageOffer structure)
    const transformedPremiumPackages = premiumPackages.map(pkg => {
      const meta = packageMetadata[pkg.packageType] || {
        name: pkg.packageType,
        description: 'Premium package',
        tipCount: 1,
        validityDays: 1,
        features: ['Premium Tips'],
        iconName: 'Gift',
        colorGradientFrom: '#8B5CF6',
        colorGradientTo: '#EC4899',
        displayOrder: 99
      }

      return {
        id: `${pkg.countryId}_${pkg.packageType}`,
        name: meta.name,
        packageType: pkg.packageType,
        description: meta.description,
        tipCount: meta.tipCount,
        validityDays: meta.validityDays,
        features: meta.features,
        iconName: meta.iconName,
        colorGradientFrom: meta.colorGradientFrom,
        colorGradientTo: meta.colorGradientTo,
        displayOrder: meta.displayOrder,
        isActive: true,
        countryPrices: [{
          id: pkg.id,
          price: Number(pkg.price),
          originalPrice: pkg.originalPrice ? Number(pkg.originalPrice) : undefined,
          currencyCode: pkg.country.currencyCode || 'USD',
          currencySymbol: pkg.country.currencySymbol || '$',
          country: {
            name: pkg.country.name || 'Unknown',
            code: pkg.country.code || 'US',
            currencyCode: pkg.country.currencyCode || 'USD',
            currencySymbol: pkg.country.currencySymbol || '$'
          }
        }]
      }
    })
    .sort((a, b) => a.displayOrder - b.displayOrder)

    // Combine and sort all plans
    const allPlans = [...transformedPricingPlans, ...transformedPremiumPackages]
      .sort((a, b) => {
        // Extract prices for comparison
        let priceA: number
        let priceB: number
        
        // Handle pricing plans (have direct price property)
        if ('price' in a) {
          priceA = parseFloat(a.price.replace(/[^\d.]/g, ''))
        } else {
          // Handle package offers (have countryPrices array)
          priceA = a.countryPrices[0]?.price || 0
        }
        
        if ('price' in b) {
          priceB = parseFloat(b.price.replace(/[^\d.]/g, ''))
        } else {
          priceB = b.countryPrices[0]?.price || 0
        }
        
        return priceA - priceB
      })

    return NextResponse.json({
      plans: allPlans,
      country: {
        code: countryCode,
        currencyCode: country.currencyCode,
        currencySymbol: country.currencySymbol
      }
    })
  } catch (error) {
    console.error("Error fetching pricing plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch pricing plans" },
      { status: 500 }
    )
  }
} 