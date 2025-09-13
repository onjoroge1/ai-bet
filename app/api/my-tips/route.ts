import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import type { 
  PredictionPayload, 
  FormattedPrediction, 
  MarketData, 
  GoalsData, 
  BttsData, 
  HandicapData 
} from "@/types/api"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const latest = searchParams.get('latest')
    const limit = latest ? 1 : undefined

    // Get user's current country for currency display
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { country: true }
    })

    if (!user?.country) {
      return NextResponse.json({ error: "User country not found" }, { status: 404 })
    }

    // Get purchases with prediction data and match information
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: session.user.id,
        status: 'completed'
      },
      include: {
        quickPurchase: {
          include: {
            country: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    // Transform the data to include prediction details
    const tips = purchases.map((purchase) => {
      const qp = purchase.quickPurchase
      
      // The prediction payload is directly in qp.predictionData (not nested under 'prediction')
      const predictionPayload = qp.predictionData || null
      
      // Helper variable to avoid repeated null checks
      const confidenceScore = qp.confidenceScore || 0
      
      // Transform raw prediction data into frontend-expected format
      const formattedPrediction: FormattedPrediction = predictionPayload ? {
        match: predictionPayload.match_info || {},
        prediction: qp.predictionType || 'unknown',
        odds: qp.odds?.toString() || '0',
        confidence: confidenceScore,
        analysis: qp.analysisSummary || predictionPayload.comprehensive_analysis?.ai_verdict?.detailed_reasoning || '',
        valueRating: qp.valueRating || 'Medium',
        
        // Extract detailed reasoning from comprehensive analysis
        detailedReasoning: predictionPayload.comprehensive_analysis?.detailed_reasoning ? [
          predictionPayload.comprehensive_analysis.detailed_reasoning.form_analysis,
          predictionPayload.comprehensive_analysis.detailed_reasoning.injury_impact,
          predictionPayload.comprehensive_analysis.detailed_reasoning.tactical_factors,
          predictionPayload.comprehensive_analysis.detailed_reasoning.historical_context
        ].filter((item): item is string => Boolean(item)) : [],
        
        // Extract additional markets from the additional_markets object
        extraMarkets: predictionPayload.additional_markets ? Object.entries(predictionPayload.additional_markets).map(([market, data]): MarketData => {
          // Transform the raw market data into frontend-expected format
          let prediction = ''
          let probability = 0
          let reasoning = ''
          
          if (market === 'total_goals') {
            const goalsData = data as GoalsData
            // Find the highest probability among all goal thresholds
            const goalEntries = Object.entries(goalsData)
            let bestProbability = 0
            let bestThreshold = ''
            
            for (const [threshold, probability] of goalEntries) {
              const prob = probability as number
              if (prob > bestProbability) {
                bestProbability = prob
                bestThreshold = threshold
              }
            }
            
            // Format the prediction based on the best threshold
            if (bestThreshold.startsWith('over_')) {
              const thresholdValue = bestThreshold.replace('over_', '').replace('_', '.')
              prediction = `Over ${thresholdValue} Goals`
              reasoning = `High scoring patterns suggest over ${thresholdValue} goals is likely`
            } else if (bestThreshold.startsWith('under_')) {
              const thresholdValue = bestThreshold.replace('under_', '').replace('_', '.')
              prediction = `Under ${thresholdValue} Goals`
              reasoning = `Defensive patterns suggest under ${thresholdValue} goals is likely`
            } else {
              // Fallback for unexpected threshold format
              prediction = `Total Goals - ${bestThreshold.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`
              reasoning = 'Analysis based on goal-scoring patterns'
            }
            
            probability = Math.round(bestProbability * 100)
          } else if (market === 'both_teams_score') {
            const bttsData = data as BttsData
            if (bttsData.yes > bttsData.no) {
              prediction = 'Both Teams to Score'
              probability = Math.round(bttsData.yes * 100)
              reasoning = 'Both teams have strong attacking form'
            } else {
              prediction = 'Not Both Teams to Score'
              probability = Math.round(bttsData.no * 100)
              reasoning = 'One team likely to keep a clean sheet'
            }
          } else if (market === 'asian_handicap') {
            const handicapData = data as HandicapData
            // Find the highest probability among all handicap options
            const handicapEntries = Object.entries(handicapData)
            let bestProbability = 0
            let bestOption = ''
            
            for (const [option, probability] of handicapEntries) {
              const prob = probability as number
              if (prob > bestProbability) {
                bestProbability = prob
                bestOption = option
              }
            }
            
            // Format the prediction based on the best option
            if (bestOption.startsWith('home_')) {
              const handicapValue = bestOption.replace('home_', '')
              prediction = `Home Team Asian Handicap ${handicapValue}`
              reasoning = `Home team expected to perform well with ${handicapValue} handicap`
            } else if (bestOption.startsWith('away_')) {
              const handicapValue = bestOption.replace('away_', '')
              prediction = `Away Team Asian Handicap ${handicapValue}`
              reasoning = `Away team expected to perform well with ${handicapValue} handicap`
            } else if (bestOption === 'yes') {
              prediction = 'Asian Handicap - Yes'
              reasoning = 'Asian handicap market is likely to be active'
            } else if (bestOption === 'no') {
              prediction = 'Asian Handicap - No'
              reasoning = 'Asian handicap market is unlikely to be active'
            } else if (bestOption.startsWith('over_')) {
              const thresholdValue = bestOption.replace('over_', '').replace('_', '.')
              prediction = `Asian Handicap Over ${thresholdValue}`
              reasoning = `Asian handicap suggests over ${thresholdValue} goals is likely`
            } else if (bestOption.startsWith('under_')) {
              const thresholdValue = bestOption.replace('under_', '').replace('_', '.')
              prediction = `Asian Handicap Under ${thresholdValue}`
              reasoning = `Asian handicap suggests under ${thresholdValue} goals is likely`
            } else {
              // Fallback for unexpected option format
              prediction = `Asian Handicap - ${bestOption.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`
              reasoning = 'Analysis based on Asian handicap patterns'
            }
            
            probability = Math.round(bestProbability * 100)
          } else {
            // Generic fallback for other markets
            prediction = market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            probability = 50
            reasoning = 'Analysis based on team performance data'
          }
          
          return {
            market: market === 'asian_handicap' ? 'Asian Handicap' : market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            prediction,
            probability,
            reasoning
          }
        }) : [],
        
        // Extract things to avoid from betting intelligence
        thingsToAvoid: predictionPayload.comprehensive_analysis?.betting_intelligence?.avoid_bets || [],
        
        // Extract risk level from risk analysis
        riskLevel: predictionPayload.comprehensive_analysis?.risk_analysis?.overall_risk || 'Medium',
        
        confidenceStars: Math.floor(confidenceScore / 20), // Convert percentage to 1-5 stars
        
        // Extract probability snapshot from ai_verdict
        probabilitySnapshot: predictionPayload.comprehensive_analysis?.ai_verdict?.probability_assessment || {},
        
        // Extract AI verdict
        aiVerdict: predictionPayload.comprehensive_analysis?.ai_verdict || {},
        
        // Extract ML prediction
        mlPrediction: predictionPayload.comprehensive_analysis?.ml_prediction ? {
          ...predictionPayload.comprehensive_analysis.ml_prediction,
          // Ensure confidence is a percentage (not decimal)
          confidence: typeof predictionPayload.comprehensive_analysis.ml_prediction.confidence === 'number' 
            ? (predictionPayload.comprehensive_analysis.ml_prediction.confidence <= 1 
                ? Math.round(predictionPayload.comprehensive_analysis.ml_prediction.confidence * 100)
                : predictionPayload.comprehensive_analysis.ml_prediction.confidence)
            : confidenceScore
        } : {
          confidence: confidenceScore
        },
        
        // Extract risk analysis
        riskAnalysis: predictionPayload.comprehensive_analysis?.risk_analysis || {},
        
        // Extract betting intelligence
        bettingIntelligence: predictionPayload.comprehensive_analysis?.betting_intelligence || {},
        
        // Extract confidence breakdown
        confidenceBreakdown: predictionPayload.comprehensive_analysis?.confidence_breakdown || '',
        
        // Extract additional markets (same as extraMarkets but for compatibility)
        additionalMarkets: predictionPayload.additional_markets ? Object.entries(predictionPayload.additional_markets).map(([market, data]): MarketData => {
          // Transform the raw market data into frontend-expected format
          let prediction = ''
          let probability = 0
          let reasoning = ''
          
          if (market === 'total_goals') {
            const goalsData = data as GoalsData
            // Find the highest probability among all goal thresholds
            const goalEntries = Object.entries(goalsData)
            let bestProbability = 0
            let bestThreshold = ''
            
            for (const [threshold, probability] of goalEntries) {
              const prob = probability as number
              if (prob > bestProbability) {
                bestProbability = prob
                bestThreshold = threshold
              }
            }
            
            // Format the prediction based on the best threshold
            if (bestThreshold.startsWith('over_')) {
              const thresholdValue = bestThreshold.replace('over_', '').replace('_', '.')
              prediction = `Over ${thresholdValue} Goals`
              reasoning = `High scoring patterns suggest over ${thresholdValue} goals is likely`
            } else if (bestThreshold.startsWith('under_')) {
              const thresholdValue = bestThreshold.replace('under_', '').replace('_', '.')
              prediction = `Under ${thresholdValue} Goals`
              reasoning = `Defensive patterns suggest under ${thresholdValue} goals is likely`
            } else {
              // Fallback for unexpected threshold format
              prediction = `Total Goals - ${bestThreshold.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`
              reasoning = 'Analysis based on goal-scoring patterns'
            }
            
            probability = Math.round(bestProbability * 100)
          } else if (market === 'both_teams_score') {
            const bttsData = data as BttsData
            if (bttsData.yes > bttsData.no) {
              prediction = 'Both Teams to Score'
              probability = Math.round(bttsData.yes * 100)
              reasoning = 'Both teams have strong attacking form'
            } else {
              prediction = 'Not Both Teams to Score'
              probability = Math.round(bttsData.no * 100)
              reasoning = 'One team likely to keep a clean sheet'
            }
          } else if (market === 'asian_handicap') {
            const handicapData = data as HandicapData
            // Find the highest probability among all handicap options
            const handicapEntries = Object.entries(handicapData)
            let bestProbability = 0
            let bestOption = ''
            
            for (const [option, probability] of handicapEntries) {
              const prob = probability as number
              if (prob > bestProbability) {
                bestProbability = prob
                bestOption = option
              }
            }
            
            // Format the prediction based on the best option
            if (bestOption === 'yes') {
              prediction = 'Asian Handicap - Yes'
              reasoning = 'Asian handicap market is likely to be active'
            } else if (bestOption === 'no') {
              prediction = 'Asian Handicap - No'
              reasoning = 'Asian handicap market is unlikely to be active'
            } else if (bestOption.startsWith('over_')) {
              const thresholdValue = bestOption.replace('over_', '').replace('_', '.')
              prediction = `Asian Handicap Over ${thresholdValue}`
              reasoning = `Asian handicap suggests over ${thresholdValue} goals is likely`
            } else if (bestOption.startsWith('under_')) {
              const thresholdValue = bestOption.replace('under_', '').replace('_', '.')
              prediction = `Asian Handicap Under ${thresholdValue}`
              reasoning = `Asian handicap suggests under ${thresholdValue} goals is likely`
            } else if (bestOption.startsWith('home_')) {
              const handicapValue = bestOption.replace('home_', '')
              prediction = `Home Team Asian Handicap ${handicapValue}`
              reasoning = `Home team expected to perform well with ${handicapValue} handicap`
            } else if (bestOption.startsWith('away_')) {
              const handicapValue = bestOption.replace('away_', '')
              prediction = `Away Team Asian Handicap ${handicapValue}`
              reasoning = `Away team expected to perform well with ${handicapValue} handicap`
            } else {
              // Fallback for unexpected option format
              prediction = `Asian Handicap - ${bestOption.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`
              reasoning = 'Analysis based on Asian handicap patterns'
            }
            
            probability = Math.round(bestProbability * 100)
          } else {
            // Generic fallback for other markets
            prediction = market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            probability = 50
            reasoning = 'Analysis based on team performance data'
          }
          
          return {
            market: market === 'asian_handicap' ? 'Asian Handicap' : market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            prediction,
            probability,
            reasoning
          }
        }) : [],
        
        // Extract analysis metadata
        analysisMetadata: predictionPayload.analysis_metadata || {},
        
        processingTime: predictionPayload.processing_time || 0,
        timestamp: predictionPayload.timestamp || new Date().toISOString()
      } : {
        // Fallback data when predictionPayload is null
        match: {},
        prediction: qp.predictionType || 'unknown',
        odds: qp.odds?.toString() || '0',
        confidence: confidenceScore,
        analysis: qp.analysisSummary || 'AI-powered prediction analysis',
        valueRating: qp.valueRating || 'Medium',
        detailedReasoning: [qp.analysisSummary || 'Based on comprehensive AI analysis'],
        extraMarkets: [],
        thingsToAvoid: ['High-risk accumulator bets', 'Betting against the prediction'],
        riskLevel: confidenceScore >= 80 ? 'Low' : confidenceScore >= 60 ? 'Medium' : 'High',
        confidenceStars: Math.floor(confidenceScore / 20),
        probabilitySnapshot: {
          home: qp.predictionType === 'home_win' ? 0.6 : 0.2,
          away: qp.predictionType === 'away_win' ? 0.6 : 0.2,
          draw: qp.predictionType === 'draw' ? 0.6 : 0.2
        },
        aiVerdict: {
          recommended_outcome: qp.predictionType?.replace(/_/g, ' ') || 'unknown',
          confidence_level: confidenceScore >= 80 ? 'High' : confidenceScore >= 60 ? 'Medium' : 'Low'
        },
        mlPrediction: {
          confidence: confidenceScore
        },
        riskAnalysis: {
          key_risks: ['Market volatility may affect odds'],
          overall_risk: confidenceScore >= 80 ? 'Low' : confidenceScore >= 60 ? 'Medium' : 'High',
          upset_potential: 'Standard risk level for this type of prediction'
        },
        bettingIntelligence: {
          primary_bet: `${qp.predictionType?.replace(/_/g, ' ')} with odds around ${qp.odds}`,
          value_bets: [`${qp.predictionType?.replace(/_/g, ' ')} and over 1.5 goals`],
          avoid_bets: ['High-risk accumulator bets', 'Betting against the prediction']
        },
        confidenceBreakdown: `The ${confidenceScore >= 80 ? 'high' : confidenceScore >= 60 ? 'medium' : 'low'} confidence level is based on the AI model prediction and analysis.`,
        additionalMarkets: [],
        analysisMetadata: {
          analysis_type: 'comprehensive',
          data_sources: ['ai_model', 'historical_data'],
          ai_model: 'gpt-4o'
        },
        processingTime: 0,
        timestamp: new Date().toISOString()
      }
      
      return {
        id: purchase.id,
        purchaseId: purchase.id, // For receipt display
        purchaseDate: purchase.createdAt,
        amount: qp.price, // Use the current price from QuickPurchase instead of stored purchase amount
        paymentMethod: purchase.paymentMethod,
        // Add tip type to distinguish between monetary and credit purchases
        tipType: purchase.paymentMethod === 'credits' ? 'credit_claim' : 'purchase',
        creditsSpent: purchase.paymentMethod === 'credits' ? 1 : null,
        // Match information from the matchData if available, fallback to prediction data
        homeTeam: (qp.matchData as any)?.home_team || predictionPayload?.match_info?.home_team || 'TBD',
        awayTeam: (qp.matchData as any)?.away_team || predictionPayload?.match_info?.away_team || 'TBD',
        matchDate: (qp.matchData as any)?.date || predictionPayload?.match_info?.date || null,
        venue: (qp.matchData as any)?.venue || predictionPayload?.match_info?.venue || null,
        league: (qp.matchData as any)?.league || predictionPayload?.match_info?.league || null,
        matchStatus: (qp.matchData as any)?.status || predictionPayload?.match_info?.status || null,
        // Enriched prediction data
        predictionType: qp.predictionType || null,
        confidenceScore: qp.confidenceScore || null,
        odds: qp.odds || null,
        valueRating: qp.valueRating || null,
        analysisSummary: qp.analysisSummary || null,
        // QuickPurchase details
        name: qp.name,
        type: qp.type,
        price: qp.price,
        description: qp.description,
        features: qp.features || [],
        isUrgent: qp.isUrgent || false,
        timeLeft: qp.timeLeft || null,
        // Use user's current country for currency display (not the QuickPurchase's country)
        currencySymbol: user.country?.currencySymbol || '$',
        currencyCode: user.country?.currencyCode || 'USD',
        // Pass the deeply nested prediction data to the frontend
        predictionData: predictionPayload,
        // Add formatted prediction data for frontend components
        prediction: formattedPrediction,
      }
    })

    // If latest=1 is requested, return the first tip in the expected format
    if (latest === '1') {
      return NextResponse.json({
        tips: tips,
        total: tips.length
      })
    }

    return NextResponse.json(tips)
  } catch (error) {
    console.error("Error fetching user's tips:", error)
    return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 })
  }
} 