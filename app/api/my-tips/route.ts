import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

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
      
      // The actual prediction payload is nested inside the 'prediction' property
      const predictionPayload = (qp.predictionData as any)?.prediction || null
      
      return {
        id: purchase.id,
        purchaseId: purchase.id, // For receipt display
        purchaseDate: purchase.createdAt,
        amount: purchase.amount,
        paymentMethod: purchase.paymentMethod,
        // Match information from the prediction data if available
        homeTeam: predictionPayload?.match_info?.home_team || 'TBD',
        awayTeam: predictionPayload?.match_info?.away_team || 'TBD',
        matchDate: predictionPayload?.match_info?.date || null,
        venue: predictionPayload?.match_info?.venue || null,
        league: predictionPayload?.match_info?.league || null,
        matchStatus: predictionPayload?.match_info?.status || null,
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
        currencySymbol: user.country.currencySymbol || '$',
        currencyCode: user.country.currencyCode || 'USD',
        // Pass the deeply nested prediction data to the frontend
        predictionData: predictionPayload,
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