import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from "@prisma/client"
import { getDbCountryPricing } from '@/lib/server-pricing-service'

/**
 * Quick Purchases API
 * 
 * Features:
 * - Country-specific pricing from PackageCountryPrice table
 * - Filters out predictions already purchased by the user via Purchase table
 * - Only shows unpurchased tips in the "Top Predictions" section
 * - Maintains all other package types (VIP, packages, etc.)
 */

const prismaClient = new PrismaClient()

interface QuickPurchaseWithRelations {
  id: string
  name: string
  price: number
  originalPrice: number
  description: string
  features: string[]
  type: string
  iconName: string
  colorGradientFrom: string
  colorGradientTo: string
  isUrgent: boolean
  timeLeft: string | null
  isPopular: boolean
  discountPercentage: number | null
  isActive: boolean
  displayOrder: number
  targetLink: string | null
  countryId: string
  createdAt: Date
  updatedAt: Date
  matchId: string | null
  matchData: Record<string, unknown> | null
  predictionData: Record<string, unknown> | null
  predictionType: string | null
  confidenceScore: number | null
  odds: number | null
  valueRating: string | null
  analysisSummary: string | null
  isPredictionActive: boolean
  country: {
    currencyCode: string
    currencySymbol: string
  }
}

// Helper function to get country-specific pricing from the database
async function getCountryPricingFromDb(countryCode: string, packageType: string = 'prediction') {
  return await getDbCountryPricing(countryCode, packageType)
}

// Helper function to map QuickPurchase types to PackageCountryPrice packageTypes
function getPackageType(quickPurchaseType: string): string {
  switch (quickPurchaseType) {
    case 'prediction':
      return 'prediction';
    case 'tip':
      return 'tip';
    case 'package':
      return 'weekly_pass';
    case 'vip':
      return 'monthly_sub';
    default:
      return 'prediction';
  }
}

// Helper function to generate the correct ID for premium packages
function generatePackageId(countryId: string, packageType: string, quickPurchaseId: string): string {
  // For premium packages, use the countryId_packageType format
  if (packageType === 'weekend_pass' || packageType === 'weekly_pass' || packageType === 'monthly_sub') {
    return `${countryId}_${packageType}`;
  }
  // For other types (tips, predictions), use the original QuickPurchase ID
  return quickPurchaseId;
}

// GET /api/quick-purchases
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's country
    const user = await prismaClient.user.findUnique({
      where: { id: session.user.id },
      select: { countryId: true }
    })

    if (!user?.countryId) {
      return NextResponse.json({ error: "User country not found" }, { status: 404 })
    }

    // Get user's country details
    const userCountry = await prismaClient.country.findUnique({
      where: { id: user.countryId },
      select: { 
        code: true,
        currencyCode: true,
        currencySymbol: true
      }
    })

    if (!userCountry) {
      return NextResponse.json({ error: "Country not found" }, { status: 404 })
    }

    // Get all predictions that the user has already purchased or claimed
    // CORRECTED: Use Purchase table instead of wrong tables
    const userPurchasedPredictions = await prismaClient.purchase.findMany({
      where: {
        userId: session.user.id,
        status: 'completed',
        quickPurchase: {
          type: { in: ['prediction', 'tip'] }
        }
      },
      select: {
        quickPurchase: {
          select: {
            matchId: true
          }
        }
      }
    })

    // Extract match IDs from completed purchases
    const purchasedMatchIds = new Set(
      userPurchasedPredictions
        .map(p => p.quickPurchase?.matchId)
        .filter((matchId): matchId is string => matchId !== null)
    )

    // Log the purchased match IDs for debugging
    console.log(`Purchased match IDs for user ${session.user.id}:`, Array.from(purchasedMatchIds))

    // Fetch active quick purchases from ALL countries (not just user's country)
    const quickPurchases = await prismaClient.quickPurchase.findMany({
      where: {
        isActive: true
      },
      orderBy: { displayOrder: "asc" },
      include: {
        country: true
      }
    })

    // Transform and apply country-specific pricing (async)
    const transformedPurchases: QuickPurchaseWithRelations[] = (await Promise.all(
      quickPurchases.map(async (purchase) => {
        try {
          const packageType = getPackageType(purchase.type)
          
          // Always get pricing from PackageCountryPrice table - single source of truth
          const countryPricing = await getCountryPricingFromDb(userCountry.code || 'US', packageType)
          
          // Use PackageCountryPrice for ALL types, not just predictions
          // This ensures consistent pricing across all package types
          const finalPrice = countryPricing.price
          const finalOriginalPrice = countryPricing.originalPrice
          
          // Generate the correct ID for premium packages
          const correctId = generatePackageId(user.countryId || 'default', packageType, purchase.id)
          
          return {
            id: correctId,
            name: purchase.name,
            price: finalPrice,
            originalPrice: finalOriginalPrice,
            description: purchase.description,
            features: purchase.features,
            type: purchase.type,
            iconName: purchase.iconName,
            colorGradientFrom: purchase.colorGradientFrom,
            colorGradientTo: purchase.colorGradientTo,
            isUrgent: purchase.isUrgent,
            timeLeft: purchase.timeLeft,
            isPopular: purchase.isPopular,
            discountPercentage: purchase.discountPercentage,
            isActive: purchase.isActive,
            displayOrder: purchase.displayOrder,
            targetLink: purchase.targetLink,
            countryId: purchase.countryId,
            createdAt: purchase.createdAt,
            updatedAt: purchase.updatedAt,
            matchId: purchase.matchId,
            matchData: purchase.matchData as Record<string, unknown> | null,
            predictionData: purchase.predictionData as Record<string, unknown> | null,
            predictionType: purchase.predictionType,
            confidenceScore: purchase.confidenceScore,
            odds: purchase.odds ? Number(purchase.odds) : null,
            valueRating: purchase.valueRating,
            analysisSummary: purchase.analysisSummary,
            isPredictionActive: purchase.isPredictionActive,
            country: {
              currencyCode: userCountry.currencyCode || 'USD',
              currencySymbol: userCountry.currencySymbol || '$'
            }
          }
        } catch (error) {
          console.error(`Error getting pricing for ${purchase.name}:`, error)
          // If PackageCountryPrice lookup fails, log error but don't fallback to QuickPurchase prices
          // This ensures we maintain the single source of truth principle
          return null // Return null instead of throwing to filter out later
        }
      })
    )).filter((item): item is QuickPurchaseWithRelations => item !== null)

    // Filter out predictions that the user has already purchased or claimed
    const availablePurchases = transformedPurchases.filter(purchase => {
      // If it's not a prediction type, always show it (packages, VIP, etc.)
      if (purchase.type !== 'prediction' && purchase.type !== 'tip') {
        return true
      }
      
      // If it has a matchId, check if the user has already purchased that match
      if (purchase.matchId) {
        const isAlreadyPurchased = purchasedMatchIds.has(purchase.matchId)
        
        if (isAlreadyPurchased) {
          console.log(`Filtering out already purchased prediction: ${purchase.name} (Match: ${purchase.matchId})`)
        }
        
        return !isAlreadyPurchased
      }
      
      // If no matchId, show it (fallback)
      return true
    })

    // Log filtering results for debugging
    console.log(`Quick purchases filtering results for user ${session.user.id}:`)
    console.log(`- Total available: ${transformedPurchases.length}`)
    console.log(`- Total predictions purchased/claimed: ${purchasedMatchIds.size}`) // Changed from purchasedPredictionIds to purchasedMatchIds
    console.log(`- Available after filtering: ${availablePurchases.length}`)
    console.log(`- Filtered out: ${transformedPurchases.length - availablePurchases.length}`)
    
    // Log what was filtered out for debugging
    const filteredOut = transformedPurchases.filter(purchase => {
      if (purchase.type !== 'prediction' && purchase.type !== 'tip') return false
      if (!purchase.matchId) return false
      
      return purchasedMatchIds.has(purchase.matchId!)
    })
    
    if (filteredOut.length > 0) {
      console.log(`Filtered out items:`)
      filteredOut.forEach(item => {
        console.log(`  - ${item.name} (Match: ${item.matchId})`)
      })
    }

    return NextResponse.json(availablePurchases)
  } catch (error) {
    console.error("Error fetching quick purchases:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prismaClient.user.findUnique({
      where: { id: session.user.id },
      include: { country: true }
    })

    if (!user?.countryId) {
      return NextResponse.json({ error: "User country not found" }, { status: 404 })
    }

    const quickPurchases = await prismaClient.quickPurchase.findMany({
      where: { 
        isActive: true,
        countryId: user.countryId
      },
      orderBy: { displayOrder: "asc" },
      include: {
        country: true
      }
    })

    // Transform the data to match the expected interface with PackageCountryPrice pricing
    const transformedPurchases: QuickPurchaseWithRelations[] = (await Promise.all(
      quickPurchases.map(async (purchase) => {
        try {
          const packageType = getPackageType(purchase.type)
          
          // Always get pricing from PackageCountryPrice table - single source of truth
          const countryPricing = await getCountryPricingFromDb(user.country?.code || 'US', packageType)
          
          // Generate the correct ID for premium packages
          const correctId = generatePackageId(user.countryId!, packageType, purchase.id)
          
          return {
            id: correctId,
            name: purchase.name,
            price: countryPricing.price,
            originalPrice: countryPricing.originalPrice,
            description: purchase.description,
            features: purchase.features,
            type: purchase.type,
            iconName: purchase.iconName,
            colorGradientFrom: purchase.colorGradientFrom,
            colorGradientTo: purchase.colorGradientTo,
            isUrgent: purchase.isUrgent,
            timeLeft: purchase.timeLeft,
            isPopular: purchase.isPopular,
            discountPercentage: purchase.discountPercentage,
            isActive: purchase.isActive,
            displayOrder: purchase.displayOrder,
            targetLink: purchase.targetLink,
            countryId: purchase.countryId,
            createdAt: purchase.createdAt,
            updatedAt: purchase.updatedAt,
            matchId: purchase.matchId,
            matchData: purchase.matchData as Record<string, unknown> | null,
            predictionData: purchase.predictionData as Record<string, unknown> | null,
            predictionType: purchase.predictionType,
            confidenceScore: purchase.confidenceScore,
            odds: purchase.odds ? Number(purchase.odds) : null,
            valueRating: purchase.valueRating,
            analysisSummary: purchase.analysisSummary,
            isPredictionActive: purchase.isPredictionActive,
            country: {
              currencyCode: user.country?.currencyCode || 'USD',
              currencySymbol: user.country?.currencySymbol || '$'
            }
          }
        } catch (error) {
          console.error(`Error getting pricing for ${purchase.name}:`, error)
          return null // Return null instead of throwing to filter out later
        }
      })
    )).filter((item): item is QuickPurchaseWithRelations => item !== null)

    return NextResponse.json(transformedPurchases)
  } catch (error) {
    console.error("Error fetching quick purchases:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}