import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { Decimal } from "@prisma/client/runtime/library"

// Helper function to get country-specific pricing from environment variables
function getCountrySpecificPricing(countryCode: string, countryName?: string) {
  const countryCodeUpper = countryCode.toUpperCase()
  
  // Try multiple patterns for environment variables
  const possibleEnvVars = [
    `${countryCodeUpper}_PREDICTION_PRICE`, // USD_PREDICTION_PRICE
    `${countryCodeUpper}_PREDICTION_ORIGINAL_PRICE`, // USD_PREDICTION_ORIGINAL_PRICE
  ]
  
  // If we have a country name, also try country name patterns
  if (countryName) {
    const countryNameUpper = countryName.toUpperCase().replace(/\s+/g, '_')
    possibleEnvVars.push(
      `${countryNameUpper}_PREDICTION_PRICE`, // UNITED_STATES_PREDICTION_PRICE
      `${countryNameUpper}_PREDICTION_ORIGINAL_PRICE` // UNITED_STATES_PREDICTION_ORIGINAL_PRICE
    )
  }
  
  // Also try common country code patterns
  const commonCountryCodes: Record<string, string[]> = {
    'USD': ['USA', 'US'],
    'KES': ['KENYA', 'KE'],
    'UGX': ['UGANDA', 'UG'],
    'TZS': ['TANZANIA', 'TZ'],
    'ZAR': ['SOUTH_AFRICA', 'ZA'],
    'GHS': ['GHANA', 'GH'],
    'NGN': ['NIGERIA', 'NG']
  }
  
  const countryVariants = commonCountryCodes[countryCodeUpper] || []
  countryVariants.forEach((variant: string) => {
    possibleEnvVars.push(
      `${variant}_PREDICTION_PRICE`,
      `${variant}_PREDICTION_ORIGINAL_PRICE`
    )
  })
  
  // Debug: Log what we're looking for
  console.log('Looking for environment variables:', {
    countryCode: countryCodeUpper,
    countryName,
    possibleEnvVars: possibleEnvVars.slice(0, 10) // Log first 10 to avoid spam
  })
  
  // Try to get country-specific pricing
  let countryPrice: string | undefined
  let countryOriginalPrice: string | undefined
  let foundPattern: string | undefined
  
  for (const envVar of possibleEnvVars) {
    const price = process.env[envVar]
    const originalPrice = process.env[envVar.replace('_PRICE', '_ORIGINAL_PRICE')]
    
    if (price && originalPrice) {
      countryPrice = price
      countryOriginalPrice = originalPrice
      foundPattern = envVar
      break
    }
  }
  
  if (countryPrice && countryOriginalPrice) {
    console.log('Found country-specific pricing:', {
      pattern: foundPattern,
      price: countryPrice,
      originalPrice: countryOriginalPrice
    })
    return {
      price: parseFloat(countryPrice),
      originalPrice: parseFloat(countryOriginalPrice),
      source: `country-specific (${foundPattern})`
    }
  }
  
  // Fallback to default pricing
  const defaultPrice = parseFloat(process.env.DEFAULT_PREDICTION_PRICE || '2.99')
  const defaultOriginalPrice = parseFloat(process.env.DEFAULT_PREDICTION_ORIGINAL_PRICE || '4.99')
  
  console.log('Using default pricing:', {
    defaultPrice,
    defaultOriginalPrice,
    envVars: {
      DEFAULT_PREDICTION_PRICE: process.env.DEFAULT_PREDICTION_PRICE,
      DEFAULT_PREDICTION_ORIGINAL_PRICE: process.env.DEFAULT_PREDICTION_ORIGINAL_PRICE
    }
  })
  
  return {
    price: defaultPrice,
    originalPrice: defaultOriginalPrice,
    source: 'default'
  }
}

// GET /api/quick-purchases
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's country
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { countryId: true }
    })

    if (!user?.countryId) {
      console.log('User has no country set:', session.user.id)
      return NextResponse.json({ error: "User country not set" }, { status: 400 })
    }

    // Get user's country details
    const userCountry = await prisma.country.findUnique({
      where: { id: user.countryId },
      select: { 
        id: true,
        name: true,
        currencyCode: true,
        currencySymbol: true
      }
    })

    if (!userCountry) {
      console.log('User country not found:', user.countryId)
      return NextResponse.json({ error: "User country not found" }, { status: 400 })
    }

    // Debug: Log user country details
    console.log('User country:', userCountry)

    // Fetch active quick purchases for user's country
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        countryId: user.countryId,
        isActive: true
      },
      orderBy: { displayOrder: "asc" },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })

    if (!quickPurchases.length) {
      console.log('No quick purchases found for country:', user.countryId)
      return NextResponse.json([], { status: 200 })
    }

    // Debug: Log quickPurchases
    console.log('QuickPurchases:', quickPurchases)

    // Fetch all package prices for this country
    const packagePrices = await prisma.packageCountryPrice.findMany({
      where: { countryId: user.countryId },
    })

    if (!packagePrices.length) {
      console.log('No package prices found for country:', user.countryId)
      return NextResponse.json(quickPurchases, { status: 200 })
    }

    // Debug: Log packagePrices
    console.log('PackageCountryPrices:', packagePrices)

    const priceMap = Object.fromEntries(
      packagePrices.map((p) => [p.packageType, Number(p.price)])
    )

    // Get country-specific pricing from environment variables
    const countryPricing = getCountrySpecificPricing(userCountry.currencyCode || 'USD', userCountry.name)
    
    console.log('Country pricing applied:', {
      country: userCountry.name,
      currencyCode: userCountry.currencyCode,
      price: countryPricing.price,
      originalPrice: countryPricing.originalPrice,
      source: countryPricing.source
    })

    // Attach correct price to each quick purchase item
    const itemsWithCorrectPrice = quickPurchases.map((item) => {
      let finalPrice = Number(item.price)
      let finalOriginalPrice = item.originalPrice ? Number(item.originalPrice) : undefined

      // For prediction type items, use country-specific environment variable prices
      if (item.type === 'prediction' || item.type === 'tip') {
        finalPrice = countryPricing.price
        finalOriginalPrice = countryPricing.originalPrice
      } else {
        // For other types, use package prices if available, otherwise keep existing price
        finalPrice = priceMap[item.type] !== undefined ? priceMap[item.type] : Number(item.price)
      }

      return {
        ...item,
        price: finalPrice,
        originalPrice: finalOriginalPrice
      }
    })

    // Debug: Log itemsWithCorrectPrice
    console.log('ItemsWithCorrectPrice:', itemsWithCorrectPrice)

    return NextResponse.json(itemsWithCorrectPrice)
  } catch (error) {
    console.error("Error fetching quick purchases:", error)
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Internal Server Error", 
        details: error.message 
      }, { status: 500 })
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 