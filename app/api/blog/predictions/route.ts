import { NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getDbCountryPricing } from "@/lib/server-pricing-service"

// GET /api/blog/predictions - Blog-specific predictions endpoint (max 4 predictions)
export async function GET() {
  try {
    console.log('Fetching blog predictions...')
    
    // Enhanced query with your specific requirements
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        type: { in: ['prediction', 'tip'] },
        matchId: { not: null },
        confidenceScore: { gt: 0 },
        matchData: {
          path: ['date'],
          gt: new Date().toISOString()
        }
      },
      include: {
        country: {
          select: {
            code: true,
            currencyCode: true,
            currencySymbol: true
          }
        }
      },
      orderBy: [
        { displayOrder: "asc" },
        { createdAt: "desc" }
      ],
      take: 4 // Limit to 4 predictions for blog
    })

    console.log(`Found ${quickPurchases.length} blog predictions`)

    // All filtering is now done in the database query
    // No need for additional client-side filtering
    const validMatches = quickPurchases

    console.log(`Found ${validMatches.length} valid blog predictions`)

    // Transform the data with proper country-specific pricing (same as main matches API)
    const transformedMatches = await Promise.all(
      validMatches.map(async (item) => {
        try {
          // Get country-specific pricing for predictions
          const countryPricing = await getDbCountryPricing(item.country.code, 'prediction')
          
          return {
            id: item.id,
            name: item.name,
            price: countryPricing.price,
            originalPrice: countryPricing.originalPrice,
            type: item.type,
            matchId: item.matchId,
            matchData: item.matchData,
            // predictionData: item.predictionData, // Removed to reduce data size
            predictionType: item.predictionType,
            confidenceScore: item.confidenceScore,
            odds: item.odds,
            valueRating: item.valueRating,
            analysisSummary: item.analysisSummary,
            isActive: item.isActive,
            createdAt: item.createdAt.toISOString(),
            country: {
              currencyCode: countryPricing.currencyCode,
              currencySymbol: item.country.currencySymbol
            },
            features: item.features,
            iconName: item.iconName,
            colorGradientFrom: item.colorGradientFrom,
            colorGradientTo: item.colorGradientTo,
            isUrgent: item.isUrgent,
            timeLeft: item.timeLeft,
            isPopular: item.isPopular,
            discountPercentage: item.discountPercentage,
            tipCount: item.tipCount
          }
        } catch (error) {
          console.error(`Error processing blog prediction ${item.id}:`, error)
          return null
        }
      })
    )

    // Filter out null results
    const validTransformedMatches = transformedMatches.filter(match => match !== null)

    console.log(`Returning ${validTransformedMatches.length} blog predictions`)

    return NextResponse.json(validTransformedMatches)
  } catch (error) {
    console.error('Error fetching blog predictions:', error)
    return NextResponse.json(
      { error: "Failed to fetch blog predictions" }, 
      { status: 500 }
    )
  }
}

