import { NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getDbCountryPricing } from "@/lib/server-pricing-service"

// GET /api/matches - Public endpoint for matches data (no authentication required)
// Supports optional pagination: ?page=1&limit=20
// When ?page is omitted the full array is returned for backward compatibility.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const paginated = pageParam !== null
    const page = Math.max(1, parseInt(pageParam ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    console.log(`Fetching public matches data (page=${page}, limit=${limit})...`)
    
    // Get all active quick purchases from all countries
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        type: { in: ['prediction', 'tip'] },
        matchId: { not: null }
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
      ]
    })

    console.log(`Found ${quickPurchases.length} active quick purchases`)

    // Filter to only upcoming matches (not completed)
    const upcomingMatches = quickPurchases.filter((item) => {
      const matchDate = item.matchData?.date ? new Date(item.matchData.date) : null
      if (!matchDate) return false
      return matchDate > new Date()
    })

    console.log(`Found ${upcomingMatches.length} upcoming matches`)

    // Filter out matches with no confidence or zero confidence
    const validMatches = upcomingMatches.filter((item) => {
      const hasValidConfidence = item.confidenceScore && item.confidenceScore > 0
      return hasValidConfidence
    })

    console.log(`Found ${validMatches.length} valid matches with confidence scores`)

    // Transform the data with proper country-specific pricing
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
            predictionData: item.predictionData,
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
          console.error(`Error processing match ${item.id}:`, error)
          // Return null for items that can't be processed
          return null
        }
      })
    )

    // Filter out null results
    const validTransformedMatches = transformedMatches.filter(match => match !== null)

    const total = validTransformedMatches.length

    // Return flat array for legacy callers; paginated envelope when ?page is specified
    if (!paginated) {
      console.log(`Returning ${total} transformed matches (flat, no pagination)`)
      return NextResponse.json(validTransformedMatches)
    }

    const pageData = validTransformedMatches.slice(skip, skip + limit)
    console.log(`Returning ${pageData.length}/${total} transformed matches (paginated)`)

    return NextResponse.json({
      data: pageData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching public matches:', error)
    return NextResponse.json(
      { error: "Failed to fetch matches" }, 
      { status: 500 }
    )
  }
}
