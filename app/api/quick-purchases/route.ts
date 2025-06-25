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
    const countryPricing = getCountrySpecificPricing(userCountry.currencyCode || 'USD', userCountry.name)
    
    normalizedItems.push({
      id: item.id,
      n: item.name,
      p: countryPricing.price,
      op: countryPricing.originalPrice,
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

    // Fetch active quick purchases from ALL countries (not just user's country)
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
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
      console.log('No quick purchases found')
      return NextResponse.json([], { status: 200 })
    }

    // Debug: Log original size
    const originalSize = JSON.stringify(quickPurchases).length
    console.log('Original data size:', originalSize, 'bytes')

    // OPTIMIZATION PIPELINE
    // Step 1: Remove duplicates
    const deduplicated = deduplicateData(quickPurchases)
    console.log('After deduplication:', deduplicated.length, 'items (was', quickPurchases.length, ')')

    // Step 2: Normalize structure
    const normalized = normalizeStructure(deduplicated, userCountry)

    // Step 3: Remove nulls
    const cleaned = removeNulls(normalized)

    // Step 4: Abbreviate keys
    const compressed = abbreviateKeys(cleaned)

    // Debug: Log optimized size
    const optimizedSize = JSON.stringify(compressed).length
    const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1)
    console.log('Optimized data size:', optimizedSize, 'bytes (', reduction, '% reduction)')

    return NextResponse.json(compressed)
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