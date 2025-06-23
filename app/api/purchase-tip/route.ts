import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { Prisma } from "@prisma/client"

type PurchaseData = {
  userId: string
  quickPurchaseId: string
  amount: Prisma.Decimal
  paymentMethod: string
  status: string
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { itemId, paymentMethod, price, isTest } = await req.json()
    console.log("Received request:", { itemId, paymentMethod, price, isTest })

    // Parse the price string into a decimal number, removing any currency symbols, prefixes, and spaces
    const cleanPrice = price.toString()
      .replace(/[A-Za-z]/g, '') // Remove any letters (currency codes)
      .replace(/[^0-9.]/g, '') // Remove any remaining non-numeric characters except decimal point
      .trim()
    console.log("Cleaned price:", cleanPrice)

    // Validate the cleaned price is a valid decimal
    if (!/^\d+\.?\d*$/.test(cleanPrice)) {
      return NextResponse.json({ error: "Invalid price format" }, { status: 400 })
    }

    // Look up the quick purchase
    console.log("Looking up quick purchase:", itemId)
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { id: itemId },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })
    console.log("Quick purchase lookup result:", quickPurchase)

    if (!quickPurchase) {
      return NextResponse.json({ error: "Quick purchase not found" }, { status: 404 })
    }

    // Create purchase record
    const purchaseData: PurchaseData = {
      userId: session.user.id,
      quickPurchaseId: itemId,
      amount: new Prisma.Decimal(cleanPrice),
      paymentMethod: isTest ? 'test-payment' : paymentMethod,
      status: 'completed'
    }

    console.log("Creating purchase record with data:", purchaseData)

    const purchase = await prisma.$transaction(async (tx) => {
      const createdPurchase = await tx.purchase.create({
        data: purchaseData,
        include: {
          quickPurchase: {
            include: {
              country: {
                select: {
                  currencyCode: true,
                  currencySymbol: true
                }
              }
            }
          }
        }
      })
      return createdPurchase
    })

    console.log("Successfully created purchase record")

    // Prepare response data
    const responseData: any = {
      success: true, 
      purchase: {
        id: purchase.id,
        amount: purchase.amount,
        status: purchase.status,
        createdAt: purchase.createdAt,
        quickPurchase: {
          id: purchase.quickPurchase.id,
          name: purchase.quickPurchase.name,
          price: purchase.quickPurchase.price,
          description: purchase.quickPurchase.description,
          type: purchase.quickPurchase.type,
          country: {
            currencyCode: purchase.quickPurchase.country.currencyCode,
            currencySymbol: purchase.quickPurchase.country.currencySymbol
          }
        }
      },
      userEmail: session.user.email
    }

    // If this QuickPurchase contains prediction data, include it in the response
    if (quickPurchase.predictionData && quickPurchase.isPredictionActive) {
      const predictionData = quickPurchase.predictionData as any
      const matchData = quickPurchase.matchData as any
      
      // Format the prediction data for delivery
      const formattedPrediction: any = {
        match: {
          homeTeam: { name: matchData?.home_team || 'Unknown' },
          awayTeam: { name: matchData?.away_team || 'Unknown' },
          league: { name: matchData?.league || 'Unknown' },
          dateTime: matchData?.date || new Date().toISOString(),
          venue: matchData?.venue || 'Unknown',
          importance: matchData?.match_importance || 'Regular'
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
        ].filter(Boolean) : [],
        extraMarkets: predictionData?.additional_markets ? [
          {
            market: "Over/Under 2.5",
            prediction: predictionData.additional_markets.total_goals.over_2_5 > 50 ? "Over" : "Under",
            probability: Math.max(predictionData.additional_markets.total_goals.over_2_5, predictionData.additional_markets.total_goals.under_2_5),
            reasoning: "Based on team scoring patterns and historical data"
          },
          {
            market: "BTTS",
            prediction: predictionData.additional_markets.both_teams_score.yes > 50 ? "Yes" : "No",
            probability: Math.max(predictionData.additional_markets.both_teams_score.yes, predictionData.additional_markets.both_teams_score.no),
            reasoning: "Based on team defensive and offensive statistics"
          }
        ] : [],
        thingsToAvoid: predictionData?.comprehensive_analysis?.betting_intelligence?.avoid_bets || [],
        riskLevel: predictionData?.comprehensive_analysis?.risk_analysis?.overall_risk || 'Medium',
        confidenceStars: Math.ceil((quickPurchase.confidenceScore || 0) / 20), // Convert confidence to 1-5 stars
        probabilitySnapshot: predictionData?.comprehensive_analysis?.ml_prediction ? {
          homeWin: predictionData.comprehensive_analysis.ml_prediction.home_win,
          draw: predictionData.comprehensive_analysis.ml_prediction.draw,
          awayWin: predictionData.comprehensive_analysis.ml_prediction.away_win
        } : { homeWin: 33, draw: 34, awayWin: 33 }
      }

      // Add the prediction data to the response
      responseData.prediction = formattedPrediction
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error("Purchase error:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: "A purchase with this ID already exists" }, { status: 409 })
      }
      if (error.code === 'P2003') {
        return NextResponse.json({ error: "Invalid reference to quick purchase or user" }, { status: 400 })
      }
    }
    return NextResponse.json({ error: "Payment failed" }, { status: 500 })
  }
} 