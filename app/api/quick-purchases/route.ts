import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { Decimal } from "@prisma/client/runtime/library"
import { PrismaClient } from "@prisma/client"
import { logger } from '@/lib/logger'
import { getCountryPricing, getQuickPurchasePricing, getDbCountryPricing } from '@/lib/pricing-service'

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
async function getCountryPricingFromDb(countryCode: string) {
  return await getDbCountryPricing(countryCode, 'prediction')
}

// GET /api/quick-purchases
export async function GET(request: Request) {
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
    const transformedPurchases: QuickPurchaseWithRelations[] = await Promise.all(
      quickPurchases.map(async (purchase) => {
        try {
          const countryPricing = await getCountryPricingFromDb(userCountry.code)
          // Apply country-specific pricing from database
          let finalPrice = Number(purchase.price)
          let finalOriginalPrice = Number(purchase.originalPrice)
          
          if (purchase.type === "prediction" && countryPricing.price) {
            finalPrice = countryPricing.price
            finalOriginalPrice = countryPricing.originalPrice
          }
          // For other types (tip, package), fallback to purchase.price
          
          return {
            id: purchase.id,
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
          // Return the purchase with original pricing if database lookup fails
          return {
            id: purchase.id,
            name: purchase.name,
            price: Number(purchase.price),
            originalPrice: Number(purchase.originalPrice),
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
        }
      })
    )

    return NextResponse.json(transformedPurchases)
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const quickPurchases = await prismaClient.quickPurchase.findMany({
      where: { 
        isActive: true,
        countryId: user.countryId || undefined
      },
      orderBy: { displayOrder: "asc" },
      include: {
        country: true
      }
    })

    // Transform the data to match the expected interface
    const transformedPurchases: QuickPurchaseWithRelations[] = quickPurchases.map((purchase) => ({
      id: purchase.id,
      name: purchase.name,
      price: Number(purchase.price),
      originalPrice: Number(purchase.originalPrice),
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
        currencyCode: purchase.country.currencyCode || 'USD',
        currencySymbol: purchase.country.currencySymbol || '$'
      }
    }))

    return NextResponse.json(transformedPurchases)
  } catch (error) {
    console.error("Error fetching quick purchases:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 