import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getDbCountryPricing } from '@/lib/server-pricing-service'

const BASE_URL = process.env.BACKEND_URL || process.env.BACKEND_API_URL || "http://localhost:8000"
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

/**
 * Get match details by match_id
 * GET /api/match/[match_id]
 * Returns: Match data from market API and QuickPurchase info if available
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const { match_id: matchId } = await params
    const session = await getServerSession(authOptions)

    // Fetch match data from market API
    const marketUrl = `${BASE_URL}/market?status=upcoming&limit=100`
    const marketResponse = await fetch(marketUrl, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      next: { revalidate: 60 }
    })

    let matchData = null
    if (marketResponse.ok) {
      const marketData = await marketResponse.json()
      matchData = marketData.matches?.find((m: any) => 
        m.match_id?.toString() === matchId.toString()
      )
    }

    // If not found in market API, try to get from database via QuickPurchase
    if (!matchData) {
      const quickPurchase = await prisma.quickPurchase.findFirst({
        where: {
          matchId: matchId,
          type: { in: ['prediction', 'tip'] },
          isActive: true
        },
        include: {
          country: true
        }
      })

      if (quickPurchase) {
        const matchDataFromQP = quickPurchase.matchData as any
        if (matchDataFromQP) {
          matchData = {
            match_id: matchId,
            status: 'UPCOMING',
            kickoff_at: matchDataFromQP.date || new Date().toISOString(),
            league: {
              id: null,
              name: matchDataFromQP.league || null
            },
            home: {
              name: matchDataFromQP.home_team || 'Home Team',
              team_id: null,
              logo_url: null
            },
            away: {
              name: matchDataFromQP.away_team || 'Away Team',
              team_id: null,
              logo_url: null
            },
            odds: {
              novig_current: {
                home: 0.33,
                draw: 0.33,
                away: 0.34
              }
            },
            models: {
              v1_consensus: quickPurchase.predictionData ? {
                pick: quickPurchase.predictionType || 'home',
                confidence: (quickPurchase.confidenceScore || 0) / 100,
                probs: {
                  home: 0.33,
                  draw: 0.33,
                  away: 0.34
                }
              } : null,
              v2_lightgbm: null
            }
          }
        }
      }
    }

    // Get QuickPurchase info for this match (for pricing and purchase)
    let quickPurchaseInfo = null
    let userCountryCode = 'US' // Default fallback
    
    if (session?.user) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          country: {
            select: {
              code: true,
              currencyCode: true,
              currencySymbol: true
            }
          }
        }
      })

      // Get user's country code for pricing
      userCountryCode = user?.country?.code?.toUpperCase() || 'US'

      const quickPurchases = await prisma.quickPurchase.findMany({
        where: {
          matchId: matchId,
          type: { in: ['prediction', 'tip'] },
          isActive: true
        },
        include: {
          country: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // Find QuickPurchase for user's country, or use first available
      if (user?.countryId && quickPurchases.length > 0) {
        quickPurchaseInfo = quickPurchases.find(qp => qp.countryId === user.countryId) 
          || quickPurchases[0]
      } else if (quickPurchases.length > 0) {
        quickPurchaseInfo = quickPurchases[0]
      }

      if (quickPurchaseInfo) {
        const matchDataFromQP = quickPurchaseInfo.matchData as any
        const predictionDataFromQP = quickPurchaseInfo.predictionData as any
        
        // Enrich match data with QuickPurchase data if market API didn't return it
        if (!matchData || matchData.home?.name === 'Home Team') {
          if (matchDataFromQP) {
            matchData = {
              ...matchData,
              home: {
                ...matchData?.home,
                name: matchDataFromQP.home_team || matchData?.home?.name || 'Home Team'
              },
              away: {
                ...matchData?.away,
                name: matchDataFromQP.away_team || matchData?.away?.name || 'Away Team'
              },
              league: {
                ...matchData?.league,
                name: matchDataFromQP.league || matchData?.league?.name
              }
            }
          }
        }

        // Apply country-specific pricing from PackageCountryPrice table
        try {
          const packageType = quickPurchaseInfo.type === 'prediction' || quickPurchaseInfo.type === 'tip' 
            ? 'prediction' 
            : 'prediction' // Default to prediction for all match-related purchases
          
          const countryPricing = await getDbCountryPricing(userCountryCode, packageType)
          
          // Override price and currency with country-specific pricing
          quickPurchaseInfo = {
            ...quickPurchaseInfo,
            price: countryPricing.price,
            originalPrice: countryPricing.originalPrice || countryPricing.price,
            country: {
              currencyCode: countryPricing.currencyCode,
              currencySymbol: countryPricing.currencySymbol,
              code: userCountryCode,
              ...(user?.country || {})
            }
          }
        } catch (error) {
          console.error('Error getting country-specific pricing:', error)
          // Fallback to QuickPurchase price if country pricing lookup fails
        }
      }
    } else {
      // For unauthenticated users, still get QuickPurchase info but use default pricing
      const quickPurchases = await prisma.quickPurchase.findMany({
        where: {
          matchId: matchId,
          type: { in: ['prediction', 'tip'] },
          isActive: true
        },
        include: {
          country: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      })

      if (quickPurchases.length > 0) {
        quickPurchaseInfo = quickPurchases[0]
        
        // Try to get default US pricing for unauthenticated users
        try {
          const countryPricing = await getDbCountryPricing('US', 'prediction')
          quickPurchaseInfo = {
            ...quickPurchaseInfo,
            price: countryPricing.price,
            originalPrice: countryPricing.originalPrice || countryPricing.price,
            country: {
              currencyCode: countryPricing.currencyCode,
              currencySymbol: countryPricing.currencySymbol,
              code: 'US',
              ...(quickPurchaseInfo.country || {})
            }
          }
        } catch (error) {
          console.error('Error getting default pricing for unauthenticated user:', error)
        }
      }
    }

    if (!matchData) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      match: matchData,
      quickPurchase: quickPurchaseInfo ? {
        id: quickPurchaseInfo.id,
        name: quickPurchaseInfo.name,
        price: quickPurchaseInfo.price,
        originalPrice: (quickPurchaseInfo as any).originalPrice || quickPurchaseInfo.price,
        description: quickPurchaseInfo.description,
        confidenceScore: quickPurchaseInfo.confidenceScore,
        predictionType: quickPurchaseInfo.predictionType,
        valueRating: quickPurchaseInfo.valueRating,
        analysisSummary: quickPurchaseInfo.analysisSummary,
        country: quickPurchaseInfo.country || {
          currencyCode: 'USD',
          currencySymbol: '$',
          code: userCountryCode
        }
      } : null
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    })
  } catch (error) {
    console.error('Error fetching match details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch match details' },
      { status: 500 }
    )
  }
}

