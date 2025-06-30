import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's points data
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId: session.user.id },
      include: {
        pointTransactions: {
          orderBy: { createdAt: "desc" },
          take: 10 // Last 10 transactions
        }
      }
    })

    if (!userPoints) {
      // Return default structure if no UserPoints record exists
      return NextResponse.json({
        points: 0,
        totalEarned: 0,
        totalSpent: 0,
        lastUpdated: new Date().toISOString(),
        recentTransactions: []
      })
    }

    // Transform transactions for frontend
    const recentTransactions = userPoints.pointTransactions.map(transaction => ({
      id: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
      reference: transaction.referenceId
    }))

    return NextResponse.json({
      points: userPoints.points,
      totalEarned: userPoints.totalEarned,
      totalSpent: userPoints.totalSpent,
      lastUpdated: userPoints.lastUpdated.toISOString(),
      recentTransactions
    })
  } catch (error) {
    console.error("Error fetching user points:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 