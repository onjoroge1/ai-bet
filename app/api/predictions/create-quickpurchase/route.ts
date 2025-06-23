import prisma from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { Redis } from '@upstash/redis'

// Initialize Redis client
const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
})

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600

// Define the prediction response type
interface PredictionResponse {
  match_info: {
    match_id: number
    home_team: string
    away_team: string
    venue: string
    date: string
    league: string
    match_importance: string
  }
  comprehensive_analysis: {
    ml_prediction: {
      home_win: number
      draw: number
      away_win: number
      confidence: number
      model_type: string
    }
    ai_verdict: {
      recommended_outcome: string
      confidence_level: string
      probability_assessment: {
        home: number
        draw: number
        away: number
      }
    }
    detailed_reasoning: {
      ml_model_weight: string
      injury_impact: string
      form_analysis: string
      tactical_factors: string
      historical_context: string
    }
    betting_intelligence: {
      primary_bet: string
      value_bets: string[]
      avoid_bets: string[]
    }
    risk_analysis: {
      overall_risk: string
      key_risks: string[]
      upset_potential: string
    }
    confidence_breakdown: string
  }
  additional_markets: {
    total_goals: {
      over_2_5: number
      under_2_5: number
    }
    both_teams_score: {
      yes: number
      no: number
    }
    asian_handicap: {
      home_handicap: number
      away_handicap: number
    }
  }
  analysis_metadata: {
    analysis_type: string
    data_sources: string[]
    analysis_timestamp: string
    ml_model_accuracy: string
    ai_model: string
    processing_time: number
  }
  processing_time: number
  timestamp: string
}

// POST /api/predictions/create-quickpurchase - Create a QuickPurchase from prediction data
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { matchId, countryId, price, name, description } = await request.json()

    if (!matchId || !countryId || !price) {
      return NextResponse.json(
        { error: 'Match ID, country ID, and price are required' },
        { status: 400 }
      )
    }

    // Check if a QuickPurchase already exists for this match
    const existingQuickPurchase = await prisma.quickPurchase.findFirst({
      where: {
        matchId: matchId.toString(),
        countryId,
        isPredictionActive: true
      }
    })

    if (existingQuickPurchase) {
      return NextResponse.json(
        { error: 'A QuickPurchase already exists for this match in this country' },
        { status: 409 }
      )
    }

    // Fetch prediction data from external API
    const backendUrl = `${process.env.BACKEND_URL}/predict`
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
      },
      body: JSON.stringify({
        match_id: Number(matchId),
        include_analysis: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`Backend responded with status ${response.status}: ${errorText}`)
      logger.error('Backend API error', {
        tags: ['api', 'predictions', 'create-quickpurchase'],
        error
      })
      throw error
    }

    const prediction = await response.json() as PredictionResponse

    // Extract key data from prediction
    const matchInfo = prediction.match_info
    const analysis = prediction.comprehensive_analysis
    const aiVerdict = analysis.ai_verdict

    // Determine prediction type and odds
    const probabilities = analysis.ml_prediction
    let predictionType = 'unknown'
    let odds = 2.0 // Default odds
    let confidenceScore = Math.round(analysis.ml_prediction.confidence)

    if (probabilities.home_win > probabilities.draw && probabilities.home_win > probabilities.away_win) {
      predictionType = 'home_win'
      odds = 1 / (probabilities.home_win / 100)
    } else if (probabilities.away_win > probabilities.draw && probabilities.away_win > probabilities.home_win) {
      predictionType = 'away_win'
      odds = 1 / (probabilities.away_win / 100)
    } else {
      predictionType = 'draw'
      odds = 1 / (probabilities.draw / 100)
    }

    // Determine value rating based on confidence and odds
    let valueRating = 'Medium'
    if (confidenceScore >= 80 && odds > 2.5) {
      valueRating = 'Very High'
    } else if (confidenceScore >= 70 && odds > 2.0) {
      valueRating = 'High'
    } else if (confidenceScore < 50) {
      valueRating = 'Low'
    }

    // Create analysis summary
    const analysisSummary = `${aiVerdict.recommended_outcome} - ${aiVerdict.confidence_level} confidence. ${analysis.detailed_reasoning.form_analysis}`

    // Create features array
    const features = [
      `AI-powered prediction with ${confidenceScore}% confidence`,
      `Comprehensive match analysis`,
      `Risk assessment and betting intelligence`,
      `Additional market insights`,
      `Detailed reasoning and tactical analysis`
    ]

    // Create QuickPurchase
    const quickPurchase = await prisma.quickPurchase.create({
      data: {
        name: name || `${matchInfo.home_team} vs ${matchInfo.away_team} - Expert Prediction`,
        price: parseFloat(price),
        description: description || `Get our AI-powered prediction for ${matchInfo.home_team} vs ${matchInfo.away_team} in ${matchInfo.league}`,
        features,
        type: 'tip',
        iconName: 'Zap',
        colorGradientFrom: 'from-blue-500',
        colorGradientTo: 'to-cyan-500',
        isUrgent: true,
        timeLeft: '24h',
        isPopular: false,
        isActive: true,
        displayOrder: 1,
        countryId,
        
        // Prediction data
        matchId: matchId.toString(),
        matchData: matchInfo as any,
        predictionData: prediction as any,
        predictionType,
        confidenceScore,
        odds,
        valueRating,
        analysisSummary,
        isPredictionActive: true
      },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })

    // Cache the prediction data
    const cacheKey = `prediction:${matchId}:true`
    await redis.set(cacheKey, prediction, { ex: CACHE_TTL })

    logger.info('POST /api/predictions/create-quickpurchase - QuickPurchase created', {
      tags: ['api', 'predictions', 'create-quickpurchase'],
      data: {
        quickPurchaseId: quickPurchase.id,
        matchId,
        countryId,
        predictionType,
        confidenceScore
      }
    })

    return NextResponse.json({
      success: true,
      quickPurchase,
      message: 'QuickPurchase created successfully with prediction data'
    })

  } catch (error) {
    logger.error('POST /api/predictions/create-quickpurchase - Error', {
      tags: ['api', 'predictions', 'create-quickpurchase'],
      error: error instanceof Error ? error : undefined
    })

    return NextResponse.json(
      { 
        error: 'Failed to create QuickPurchase',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET /api/predictions/create-quickpurchase - Get available matches for creating QuickPurchases
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('league_id') || '39'
    const limit = searchParams.get('limit') || '10'

    // Fetch upcoming matches
    const queryParams = new URLSearchParams({
      league_id: leagueId,
      limit: limit,
      exclude_finished: 'true'
    })

    const response = await fetch(
      `${process.env.BACKEND_URL}/matches/upcoming?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch matches: ${response.status}`)
    }

    const responseData = await response.json()
    
    // Extract matches from the external API response structure
    // The actual structure is: responseData.matches.matches (nested)
    const matchesData = responseData.matches?.matches || responseData.matches
    
    // Extract matches from the response - handle different possible structures
    let matches = []
    if (Array.isArray(matchesData)) {
      // Direct array response from external API
      matches = matchesData
    } else if (matchesData && typeof matchesData === 'object') {
      // Object response - try different possible keys
      if (matchesData.matches && Array.isArray(matchesData.matches)) {
        matches = matchesData.matches
      } else if (matchesData.data && Array.isArray(matchesData.data)) {
        matches = matchesData.data
      } else if (matchesData.results && Array.isArray(matchesData.results)) {
        matches = matchesData.results
      } else {
        // Try to find any array property
        const arrayKeys = Object.keys(matchesData).filter(key => 
          Array.isArray(matchesData[key])
        )
        if (arrayKeys.length > 0) {
          matches = matchesData[arrayKeys[0]]
        }
      }
    }

    // Check if we have matches to process
    if (!Array.isArray(matches) || matches.length === 0) {
      logger.error('No matches found in API response', {
        tags: ['api', 'predictions', 'create-quickpurchase'],
        data: {
          leagueId,
          actualType: typeof matches,
          actualValue: matches,
          originalResponse: responseData
        }
      })
      throw new Error('No matches found in API response')
    }

    // Filter out matches that already have QuickPurchases
    const matchesWithQuickPurchaseStatus = await Promise.all(
      matches.map(async (match: any) => {
        const existingQuickPurchase = await prisma.quickPurchase.findFirst({
          where: {
            matchId: match.match_id.toString(),
            isPredictionActive: true
          }
        })

        return {
          ...match,
          hasQuickPurchase: !!existingQuickPurchase,
          quickPurchaseId: existingQuickPurchase?.id || null
        }
      })
    )

    return NextResponse.json({
      matches: matchesWithQuickPurchaseStatus,
      filters: {
        league_id: leagueId,
        limit: parseInt(limit)
      }
    })

  } catch (error) {
    logger.error('GET /api/predictions/create-quickpurchase - Error', {
      tags: ['api', 'predictions', 'create-quickpurchase'],
      error: error instanceof Error ? error : undefined
    })

    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    )
  }
} 