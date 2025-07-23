import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import type { PredictionPayload, FormattedPrediction } from "@/types/api"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quickPurchaseId } = await req.json()

    if (!quickPurchaseId) {
      return NextResponse.json({ error: "Quick purchase ID is required" }, { status: 400 })
    }

    // Get the quick purchase details
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { id: quickPurchaseId },
      include: { country: true }
    })

    if (!quickPurchase) {
      return NextResponse.json({ error: "Quick purchase not found" }, { status: 404 })
    }

    if (!quickPurchase.isActive) {
      return NextResponse.json({ error: "Quick purchase is not active" }, { status: 400 })
    }

    // Check if user has enough credits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { predictionCredits: true }
    })

    if (!user || user.predictionCredits < 1) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 400 })
    }

    // Check if user already purchased this tip
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId: session.user.id,
        quickPurchaseId: quickPurchaseId,
        status: 'completed'
      }
    })

    if (existingPurchase) {
      return NextResponse.json({ error: "Tip already purchased" }, { status: 400 })
    }

    // Create purchase record
    const purchase = await prisma.purchase.create({
      data: {
        userId: session.user.id,
        quickPurchaseId: quickPurchaseId,
        amount: 0, // Free with credits
        paymentMethod: 'credits',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Deduct credits from user
    await prisma.user.update({
      where: { id: session.user.id },
      data: { predictionCredits: user.predictionCredits - 1 }
    })

    // If this QuickPurchase contains prediction data, include it in the response
    if (quickPurchase.predictionData && quickPurchase.isPredictionActive) {
      const predictionData = quickPurchase.predictionData as PredictionPayload
      const matchData = quickPurchase.matchData as Record<string, unknown>
      
      // Format the prediction data for delivery
      const formattedPrediction: FormattedPrediction = {
        match: {
          home_team: (matchData?.home_team as string) || 'Unknown',
          away_team: (matchData?.away_team as string) || 'Unknown',
          league: (matchData?.league as string) || 'Unknown',
          date: (matchData?.date as string) || new Date().toISOString(),
          venue: (matchData?.venue as string) || 'Unknown',
          match_importance: (matchData?.match_importance as string) || 'Regular'
        },
        prediction: quickPurchase.predictionType || 'unknown',
        odds: quickPurchase.odds?.toString() || '2.0',
        confidence: quickPurchase.confidenceScore || 0,
        analysis: quickPurchase.analysisSummary || 'No analysis available',
        valueRating: quickPurchase.valueRating || 'Medium',
        detailedReasoning: predictionData?.comprehensive_analysis?.detailed_reasoning ? [
          predictionData.comprehensive_analysis.detailed_reasoning.ml_model_weight,
          predictionData.comprehensive_analysis.detailed_reasoning.injury_impact,
          predictionData.comprehensive_analysis.detailed_reasoning.form_analysis,
          predictionData.comprehensive_analysis.detailed_reasoning.tactical_factors,
          predictionData.comprehensive_analysis.detailed_reasoning.historical_context
        ].filter((item): item is string => Boolean(item)) : [],
        extraMarkets: [],
        additionalMarkets: [],
        thingsToAvoid: predictionData?.comprehensive_analysis?.betting_intelligence?.avoid_bets || [],
        riskLevel: predictionData?.comprehensive_analysis?.risk_analysis?.overall_risk || 'Medium',
        confidenceStars: Math.floor((quickPurchase.confidenceScore || 0) / 20),
        probabilitySnapshot: predictionData?.comprehensive_analysis?.ai_verdict?.probability_assessment || {},
        aiVerdict: predictionData?.comprehensive_analysis?.ai_verdict || {},
        mlPrediction: {
          confidence: quickPurchase.confidenceScore || 0
        },
        riskAnalysis: predictionData?.comprehensive_analysis?.risk_analysis || {},
        bettingIntelligence: predictionData?.comprehensive_analysis?.betting_intelligence || {},
        confidenceBreakdown: predictionData?.comprehensive_analysis?.confidence_breakdown || ''
      }

      return NextResponse.json({
        success: true,
        purchase: {
          id: purchase.id,
          quickPurchaseId: quickPurchase.id,
          amount: 0,
          currency: quickPurchase.country.currencyCode,
          currencySymbol: quickPurchase.country.currencySymbol,
          prediction: formattedPrediction,
          status: purchase.status,
          paymentMethod: purchase.paymentMethod,
          country: {
            code: quickPurchase.country.code,
            name: quickPurchase.country.name,
            flagEmoji: quickPurchase.country.flagEmoji
          }
        }
      })
    }

    // Return basic purchase info if no prediction data
    return NextResponse.json({
      success: true,
      purchase: {
        id: purchase.id,
        quickPurchaseId: quickPurchase.id,
        amount: 0,
        currency: quickPurchase.country.currencyCode,
        currencySymbol: quickPurchase.country.currencySymbol,
        status: purchase.status,
        paymentMethod: purchase.paymentMethod,
        country: {
          code: quickPurchase.country.code,
          name: quickPurchase.country.name,
          flagEmoji: quickPurchase.country.flagEmoji
        }
      }
    })

  } catch (error) {
    console.error("Error purchasing tip:", error)
    return NextResponse.json({ error: "Failed to purchase tip" }, { status: 500 })
  }
} 