import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

/**
 * Quick Purchases API
 *
 * Features:
 * - Country-specific pricing from PackageCountryPrice table
 * - Filters out predictions already purchased by the user via Purchase table
 * - Only shows unpurchased tips in the "Top Predictions" section
 * - Server-side filtering for type, date, confidence (via query params)
 * - Batched pricing lookups to avoid N+1 queries
 */

interface QuickPurchaseResponse {
  id: string
  name: string
  price: number
  originalPrice: number
  type: string
  matchId: string | null
  matchData: Record<string, unknown> | null
  predictionType: string | null
  confidenceScore: number | null
  odds: number | null
  valueRating: string | null
  analysisSummary: string | null
  isActive: boolean
  createdAt: Date
  country: {
    currencyCode: string
    currencySymbol: string
  }
  // UI-specific fields (only sent when needed)
  description?: string
  features?: string[]
  iconName?: string
  colorGradientFrom?: string
  colorGradientTo?: string
  isUrgent?: boolean
  timeLeft?: string | null
  isPopular?: boolean
  discountPercentage?: number | null
  isPredictionActive?: boolean
  displayOrder?: number
  targetLink?: string | null
  countryId?: string
  updatedAt?: Date
  predictionData?: Record<string, unknown> | null
  tipCount?: number
}

/** Maps QuickPurchase types to PackageCountryPrice packageTypes */
function getPackageType(quickPurchaseType: string): string {
  switch (quickPurchaseType) {
    case 'prediction': return 'prediction'
    case 'tip': return 'tip'
    case 'package': return 'weekly_pass'
    case 'vip': return 'monthly_sub'
    default: return 'prediction'
  }
}

/** Generates the correct ID for premium packages */
function generatePackageId(countryId: string, packageType: string, quickPurchaseId: string): string {
  if (packageType === 'weekend_pass' || packageType === 'weekly_pass' || packageType === 'monthly_sub') {
    return `${countryId}_${packageType}`
  }
  return quickPurchaseId
}

/**
 * Batch-fetch pricing for all needed package types in ONE query.
 * Returns a Map<packageType, { price, originalPrice }>.
 */
async function batchGetPricing(
  countryCode: string
): Promise<Map<string, { price: number; originalPrice: number }>> {
  const pricingMap = new Map<string, { price: number; originalPrice: number }>()

  // Find country once
  const country = await prisma.country.findUnique({
    where: { code: countryCode.toLowerCase() },
  })

  if (!country) {
    // Default fallback pricing
    const defaults: Record<string, { price: number; originalPrice: number }> = {
      prediction: { price: 1, originalPrice: 1 },
      tip: { price: 1, originalPrice: 1 },
      weekly_pass: { price: 6.8, originalPrice: 8 },
      monthly_sub: { price: 21, originalPrice: 30 },
    }
    for (const [type, pricing] of Object.entries(defaults)) {
      pricingMap.set(type, pricing)
    }
    return pricingMap
  }

  // Fetch ALL pricing rows for this country in a single query
  const priceRows = await prisma.packageCountryPrice.findMany({
    where: { countryId: country.id },
  })

  // Index by packageType
  for (const row of priceRows) {
    pricingMap.set(row.packageType, {
      price: Number(row.price),
      originalPrice: Number(row.originalPrice ?? row.price),
    })
  }

  // Fill in fallbacks for missing types
  const fallbackBase = 1.99
  const tipCounts: Record<string, number> = {
    prediction: 1, tip: 1, weekend_pass: 5, weekly_pass: 8, monthly_sub: 30,
  }
  const discounts: Record<string, number> = {
    prediction: 0, tip: 0, weekend_pass: 0.10, weekly_pass: 0.15, monthly_sub: 0.30,
  }

  for (const type of Object.keys(tipCounts)) {
    if (!pricingMap.has(type)) {
      const tips = tipCounts[type] ?? 1
      const discount = discounts[type] ?? 0
      const originalPrice = fallbackBase * tips
      const price = originalPrice * (1 - discount)
      pricingMap.set(type, { price, originalPrice })
    }
  }

  return pricingMap
}

/**
 * GET /api/quick-purchases
 *
 * Query params:
 * - view=matches  → lightweight response for /dashboard/matches (excludes predictionData, description, features, etc.)
 * - page=1        → pagination page (default: 1)
 * - limit=50      → items per page (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const view = searchParams.get('view') // 'matches' = lightweight
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

    // Get user's country in a single query (combined user + country lookup)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        countryId: true,
        country: {
          select: {
            code: true,
            currencyCode: true,
            currencySymbol: true,
          },
        },
      },
    })

    if (!user?.countryId || !user.country) {
      return NextResponse.json({ error: 'User country not found' }, { status: 404 })
    }

    const userCountry = user.country

    // Get user's purchased match IDs
    const userPurchasedPredictions = await prisma.purchase.findMany({
      where: {
        userId: session.user.id,
        status: 'completed',
        quickPurchase: {
          type: { in: ['prediction', 'tip'] },
        },
      },
      select: {
        quickPurchase: {
          select: { matchId: true },
        },
      },
    })

    const purchasedMatchIds = new Set(
      userPurchasedPredictions
        .map((p) => p.quickPurchase?.matchId)
        .filter((matchId): matchId is string => matchId !== null)
    )

    // Build the WHERE clause — filter server-side instead of client-side
    const isMatchesView = view === 'matches'

    // Choose which fields to select based on view
    const selectFields = {
      id: true,
      name: true,
      price: true,
      originalPrice: true,
      type: true,
      matchId: true,
      matchData: true,
      predictionType: true,
      confidenceScore: true,
      odds: true,
      valueRating: true,
      analysisSummary: true,
      isActive: true,
      createdAt: true,
      countryId: true,
      isPredictionActive: true,
      displayOrder: true,
      // Only include heavyweight fields when NOT in matches view
      ...(!isMatchesView && {
        description: true,
        features: true,
        iconName: true,
        colorGradientFrom: true,
        colorGradientTo: true,
        isUrgent: true,
        timeLeft: true,
        isPopular: true,
        discountPercentage: true,
        targetLink: true,
        updatedAt: true,
        predictionData: true,
      }),
    }

    // Server-side filtering for matches view
    const now = new Date().toISOString()
    const whereClause = isMatchesView
      ? {
          isActive: true,
          type: { in: ['prediction', 'tip'] as string[] },
          matchId: { not: null } as { not: null },
          confidenceScore: { gt: 0 },
          // Ensure the prediction has actual data — users should not pay for an empty object
          predictionData: { not: Prisma.DbNull },
          // Only show future/upcoming matches, not past ones
          matchData: {
            path: ['date'],
            gte: now,
          },
        }
      : { isActive: true }

    // Fetch with server-side filtering + pagination
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: whereClause,
      orderBy: { displayOrder: 'asc' },
      select: selectFields,
      skip: (page - 1) * limit,
      take: limit,
    })

    // Batch-fetch pricing for all types in ONE round-trip (instead of N+1)
    const pricingMap = await batchGetPricing(userCountry.code || 'US')

    // Transform items using the batched pricing (zero extra DB calls)
    const transformedPurchases: QuickPurchaseResponse[] = quickPurchases
      .map((purchase) => {
        const packageType = getPackageType(purchase.type)
        const pricing = pricingMap.get(packageType) ?? { price: 1.99, originalPrice: 2.99 }
        const correctId = generatePackageId(user.countryId!, packageType, purchase.id)

        const base: QuickPurchaseResponse = {
          id: correctId,
          name: purchase.name,
          price: pricing.price,
          originalPrice: pricing.originalPrice,
          type: purchase.type,
          matchId: purchase.matchId,
          matchData: purchase.matchData as Record<string, unknown> | null,
          predictionType: purchase.predictionType,
          confidenceScore: purchase.confidenceScore,
          odds: purchase.odds ? Number(purchase.odds) : null,
          valueRating: purchase.valueRating,
          analysisSummary: purchase.analysisSummary,
          isActive: purchase.isActive,
          createdAt: purchase.createdAt,
          country: {
            currencyCode: userCountry.currencyCode || 'USD',
            currencySymbol: userCountry.currencySymbol || '$',
          },
        }

        // Attach extra fields for full view
        if (!isMatchesView) {
          const full = purchase as typeof purchase & {
            description?: string
            features?: string[]
            iconName?: string
            colorGradientFrom?: string
            colorGradientTo?: string
            isUrgent?: boolean
            timeLeft?: string | null
            isPopular?: boolean
            discountPercentage?: number | null
            targetLink?: string | null
            updatedAt?: Date
            predictionData?: unknown
          }
          base.description = full.description
          base.features = full.features
          base.iconName = full.iconName
          base.colorGradientFrom = full.colorGradientFrom
          base.colorGradientTo = full.colorGradientTo
          base.isUrgent = full.isUrgent
          base.timeLeft = full.timeLeft
          base.isPopular = full.isPopular
          base.discountPercentage = full.discountPercentage
          base.targetLink = full.targetLink
          base.updatedAt = full.updatedAt
          base.predictionData = full.predictionData as Record<string, unknown> | null
          base.isPredictionActive = purchase.isPredictionActive
          base.displayOrder = purchase.displayOrder
          base.countryId = purchase.countryId
        }

        return base
      })

    // Filter out already-purchased predictions
    const availablePurchases = transformedPurchases.filter((purchase) => {
      if (purchase.type !== 'prediction' && purchase.type !== 'tip') return true
      if (purchase.matchId && purchasedMatchIds.has(purchase.matchId)) return false
      return true
    })

    return NextResponse.json(availablePurchases)
  } catch (error) {
    console.error('Error fetching quick purchases:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/quick-purchases
 * Legacy endpoint for fetching by country (used by other parts of the app)
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        countryId: true,
        country: {
          select: {
            code: true,
            currencyCode: true,
            currencySymbol: true,
          },
        },
      },
    })

    if (!user?.countryId || !user.country) {
      return NextResponse.json({ error: 'User country not found' }, { status: 404 })
    }

    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        countryId: user.countryId,
      },
      orderBy: { displayOrder: 'asc' },
    })

    // Batch pricing
    const pricingMap = await batchGetPricing(user.country.code || 'US')

    const transformedPurchases = quickPurchases.map((purchase) => {
      const packageType = getPackageType(purchase.type)
      const pricing = pricingMap.get(packageType) ?? { price: 1.99, originalPrice: 2.99 }
      const correctId = generatePackageId(user.countryId!, packageType, purchase.id)

      return {
        id: correctId,
        name: purchase.name,
        price: pricing.price,
        originalPrice: pricing.originalPrice,
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
        matchData: purchase.matchData,
        predictionData: purchase.predictionData,
        predictionType: purchase.predictionType,
        confidenceScore: purchase.confidenceScore,
        odds: purchase.odds ? Number(purchase.odds) : null,
        valueRating: purchase.valueRating,
        analysisSummary: purchase.analysisSummary,
        isPredictionActive: purchase.isPredictionActive,
        country: {
          currencyCode: user.country?.currencyCode || 'USD',
          currencySymbol: user.country?.currencySymbol || '$',
        },
      }
    })

    return NextResponse.json(transformedPurchases)
  } catch (error) {
    console.error('Error fetching quick purchases:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
