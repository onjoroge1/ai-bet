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

// OPTIMIZATION: Remove null/undefined values
function removeNulls(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeNulls).filter(v => v !== null && v !== undefined)
  }
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, removeNulls(v)])
    )
  }
  return obj
}

// OPTIMIZATION: Abbreviate common field names
function abbreviateKeys(obj: any): any {
  const keyMap: Record<string, string> = {
    'predictionType': 'pt',
    'confidenceScore': 'cs',
    'analysisSummary': 'as',
    'isPredictionActive': 'ipa',
    'createdAt': 'ca',
    'updatedAt': 'ua',
    'originalPrice': 'op',
    'valueRating': 'vr',
    'currencyCode': 'cc',
    'currencySymbol': 'cs',
    'displayOrder': 'do',
    'discountPercentage': 'dp',
    'isUrgent': 'iu',
    'isPopular': 'ip',
    'timeLeft': 'tl',
    'targetLink': 'tlk',
    'iconName': 'in',
    'colorGradientFrom': 'cgf',
    'colorGradientTo': 'cgt',
    'matchData': 'md',
    'predictionData': 'pd',
    'home_team': 'ht',
    'away_team': 'at',
    'is_finished': 'if',
    'is_upcoming': 'iu',
    'status_short': 'ss',
    'prediction_ready': 'pr'
  }

  if (Array.isArray(obj)) {
    return obj.map(abbreviateKeys)
  }
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        keyMap[k] || k,
        abbreviateKeys(v)
      ])
    )
  }
  return obj
}

// OPTIMIZATION: Remove duplicates by match and country
function deduplicateData(items: any[]): any[] {
  const matchGroups: Record<string, any[]> = {}
  
  items.forEach(item => {
    const matchKey = `${item.matchData?.home_team || 'unknown'}_vs_${item.matchData?.away_team || 'unknown'}`
    if (!matchGroups[matchKey]) {
      matchGroups[matchKey] = []
    }
    matchGroups[matchKey].push(item)
  })

  const uniqueItems: any[] = []
  Object.values(matchGroups).forEach(group => {
    const seenCountries = new Set()
    group.forEach(item => {
      const countryCode = item.country?.currencyCode
      if (!seenCountries.has(countryCode)) {
        seenCountries.add(countryCode)
        uniqueItems.push(item)
      }
    })
  })

  return uniqueItems
}

// OPTIMIZATION: Normalize structure with lookup tables
function normalizeStructure(items: any[], userCountry: any) {
  const matches: Record<string, any> = {}
  const predictions: Record<string, any> = {}
  const countries: Record<string, any> = {}
  const normalizedItems: any[] = []

  items.forEach(item => {
    // Extract match data
    if (item.matchData && item.matchId) {
      matches[item.matchId] = {
        d: item.matchData.date?.replace(/\.\d{3}Z$/, 'Z'), // Shortened date
        v: item.matchData.venue,
        l: item.matchData.league,
        ht: item.matchData.home_team,
        at: item.matchData.away_team,
        s: item.matchData.status_short || item.matchData.status
      }
    }

    // Extract prediction data
    if (item.predictionData && item.matchId) {
      const pred = item.predictionData.prediction
      if (pred?.comprehensive_analysis?.ai_verdict) {
        const verdict = pred.comprehensive_analysis.ai_verdict
        predictions[item.matchId] = {
          cl: verdict.confidence_level,
          ro: verdict.recommended_outcome,
          p: verdict.probability_assessment,
          ml: pred.comprehensive_analysis.ml_prediction,
          pb: pred.comprehensive_analysis.betting_intelligence?.primary_bet
        }
      }
    }

    // Extract country data
    if (item.country) {
      countries[item.country.currencyCode] = {
        c: item.country.currencyCode,
        s: item.country.currencySymbol
      }
    }

    // Create simplified item with user's country pricing
    const countryPricing = getCountryPricingFromEnv(userCountry.code)
    
    normalizedItems.push({
      id: item.id,
      n: item.name,
      p: countryPricing[`${userCountry.code}_PREDICTION_PRICE`] || Number(item.price),
      op: countryPricing[`${userCountry.code}_PREDICTION_PRICE`] || Number(item.originalPrice),
      t: item.type,
      mi: item.matchId,
      cc: userCountry.currencyCode,
      cs: item.confidenceScore,
      o: item.odds,
      vr: item.valueRating,
      ia: item.isActive,
      ca: item.createdAt ? new Date(item.createdAt).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined // Convert Date to string first
    })
  })

  return {
    m: matches, // matches
    pr: predictions, // predictions  
    c: countries, // countries
    i: normalizedItems // items
  }
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
        const countryPricing = await getCountryPricingFromDb(userCountry.code)
        // Apply country-specific pricing if available
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