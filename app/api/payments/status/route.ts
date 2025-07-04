import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

// GET /api/payments/status - Check payment status by payment intent ID
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const paymentIntentId = searchParams.get('payment_intent')

    if (!paymentIntentId) {
      return NextResponse.json({ error: "Payment intent ID is required" }, { status: 400 })
    }

    // Check if payment exists in our database by looking for recent purchases
    // Since we don't store payment intent ID directly, we'll check for recent purchases
    // and also check if user packages or predictions were created
    const recentPurchases = await prisma.purchase.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      include: {
        quickPurchase: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    })

    // Also check for recently created user packages
    const recentUserPackages = await prisma.userPackage.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      include: {
        packageOffer: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    })

    // Check for recent user predictions
    const recentUserPredictions = await prisma.userPrediction.findMany({
      where: {
        userId: session.user.id,
        placedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      include: {
        prediction: true
      },
      orderBy: {
        placedAt: 'desc'
      },
      take: 1
    })

    // If we have recent purchases or user packages/predictions, consider payment successful
    if (recentPurchases.length > 0 || recentUserPackages.length > 0 || recentUserPredictions.length > 0) {
      const purchase = recentPurchases[0]
      const userPackage = recentUserPackages[0]
      const userPrediction = recentUserPredictions[0]

      return NextResponse.json({
        status: 'succeeded',
        purchaseId: purchase?.id,
        amount: purchase?.amount,
        createdAt: purchase?.createdAt,
        updatedAt: purchase?.updatedAt,
        // Include purchased item details
        itemType: userPackage ? 'package' : 'tip',
        itemDetails: userPackage ? {
          packageName: userPackage.packageOffer.name,
          tipCount: userPackage.packageOffer.tipCount,
          expiresAt: userPackage.expiresAt
        } : userPrediction ? {
          predictionType: userPrediction.prediction.predictionType,
          matchDetails: userPrediction.prediction.matchId
        } : {
          itemName: purchase?.quickPurchase?.name
        }
      })
    }

    // If no recent activity, payment is still processing
    return NextResponse.json({ 
      status: 'processing',
      message: 'Payment is being processed...'
    })

  } catch (error) {
    console.error("Error checking payment status:", error)
    return NextResponse.json({ error: "Failed to check payment status" }, { status: 500 })
  }
} 