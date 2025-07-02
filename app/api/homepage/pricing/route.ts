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

    // Get package offers with country-specific pricing
    const packageOffers = await prisma.packageOffer.findMany({
      where: { isActive: true },
      include: {
        countryPrices: {
          where: { 
            countryId: country.id,
            isActive: true 
          }
        }
      },
      orderBy: [{ displayOrder: "asc" }]
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

    // Transform package offers
    const transformedPackageOffers = packageOffers
      .filter(offer => offer.countryPrices.length > 0)
      .map(offer => {
        const countryPrice = offer.countryPrices[0]
        return {
          id: offer.id,
          name: offer.name,
          price: `${countryPrice.currencySymbol}${countryPrice.price}`,
          originalPrice: countryPrice.originalPrice ? `${countryPrice.currencySymbol}${countryPrice.originalPrice}` : null,
          period: "package", // Package offers are one-time
          description: offer.description,
          features: offer.features,
          tipCount: offer.tipCount,
          validityDays: offer.validityDays,
          isPopular: false, // Package offers are not subscription plans
          planType: "package",
          currencyCode: countryPrice.currencyCode,
          currencySymbol: countryPrice.currencySymbol
        }
      })

    // Combine and sort all plans
    const allPlans = [...transformedPricingPlans, ...transformedPackageOffers]
      .sort((a, b) => {
        // Sort by price (convert to number for comparison)
        const priceA = parseFloat(a.price.replace(/[^\d.]/g, ''))
        const priceB = parseFloat(b.price.replace(/[^\d.]/g, ''))
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