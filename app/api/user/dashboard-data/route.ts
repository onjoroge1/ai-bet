import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { calculateCurrentWinStreak } from "@/lib/streak-calculator"

// GET /api/user/dashboard-data
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          },
        }
      )
    }

    // Fetch user with country data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        subscriptionExpiresAt: true,
        subscriptionPlan: true,
        totalWinnings: true,
        country: {
          select: {
            id: true,
            code: true,
            name: true,
            flagEmoji: true,
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        {
          status: 404,
          headers: {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          },
        }
      )
    }

    // Calculate total prediction accuracy
    const predictionAccuracy = await calculatePredictionAccuracy(user.id)
    
    // Calculate user level based on prediction accuracy and time as member
    const userLevel = calculateUserLevel(predictionAccuracy, user.createdAt)
    
    // Calculate progress to next level
    const progressToNextLevel = calculateProgressToNextLevel(predictionAccuracy, userLevel)
    
    // Calculate monthly prediction success (last 30 days)
    const monthlySuccess = await calculateMonthlyPredictionSuccess(user.id)
    
    // Calculate current win streak dynamically
    const currentWinStreak = await calculateCurrentWinStreak(user.id)
    
    // Calculate real purchase metrics
    const purchaseMetrics = await calculatePurchaseMetrics(user.id)
    
    // Format member since date
    const memberSince = formatMemberSince(user.createdAt)
    
    // Format VIP expiry date
    const vipExpiryDate = user.subscriptionExpiresAt 
      ? formatVIPExpiry(user.subscriptionExpiresAt)
      : null

    // Format prediction success rate
    const formattedAccuracy = formatPercentage(predictionAccuracy)
    const formattedMonthlySuccess = formatPercentage(monthlySuccess)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        memberSince,
        winStreak: currentWinStreak,
        country: user.country
      },
      dashboard: {
        level: userLevel,
        progressToNextLevel,
        predictionAccuracy: formattedAccuracy,
        monthlySuccess: formattedMonthlySuccess,
        vipExpiryDate,
        subscriptionPlan: user.subscriptionPlan,
        // Real purchase metrics
        totalTipsPurchased: purchaseMetrics.totalTipsPurchased,
        thisMonthActivity: purchaseMetrics.thisMonthActivity,
        totalSpent: purchaseMetrics.totalSpent,
        averageConfidence: purchaseMetrics.averageConfidence
      }
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    )
  }
}

// Helper functions
function calculateUserLevel(predictionAccuracy: number, createdAt: Date): number {
  const baseLevel = 1
  const accuracyMultiplier = Math.floor(predictionAccuracy / 10) // Every 10% accuracy = 1 level
  const timeMultiplier = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)) // Every month = 1 level
  
  // For new users with no predictions, give them level 1
  if (predictionAccuracy === 0) {
    return Math.min(baseLevel + timeMultiplier, 5) // Cap at level 5 for time-based progression
  }
  
  return Math.min(baseLevel + accuracyMultiplier + timeMultiplier, 10) // Cap at level 10
}

function calculateProgressToNextLevel(predictionAccuracy: number, currentLevel: number): number {
  // For new users with no predictions, show progress based on time
  if (predictionAccuracy === 0) {
    const timeSinceCreation = Date.now() - new Date().getTime()
    const daysSinceCreation = timeSinceCreation / (1000 * 60 * 60 * 24)
    const progressToNextMonth = (daysSinceCreation % 30) / 30 * 100
    return Math.max(0, Math.min(100, progressToNextMonth))
  }
  
  const nextLevelThreshold = (currentLevel + 1) * 10
  const currentLevelThreshold = currentLevel * 10
  const progress = ((predictionAccuracy - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold)) * 100
  return Math.max(0, Math.min(100, progress))
}

async function calculateMonthlyPredictionSuccess(userId: string): Promise<number> {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const aggregations = await prisma.userPrediction.aggregate({
      _count: {
        _all: true,
      },
      where: {
        userId: userId,
        placedAt: {
          gte: thirtyDaysAgo,
        },
      },
    })
    
    const wonCount = await prisma.userPrediction.count({
        where: {
            userId: userId,
            placedAt: {
                gte: thirtyDaysAgo
            },
            status: 'won'
        }
    });

    const total = aggregations._count._all
    const successful = wonCount;
    
    return total > 0 ? (successful / total) * 100 : 0
  } catch (error) {
    console.error("Error calculating monthly prediction success:", error)
    return 0
  }
}

async function calculatePredictionAccuracy(userId: string): Promise<number> {
  try {
    const aggregations = await prisma.userPrediction.aggregate({
      _count: {
        _all: true,
      },
      where: {
        userId: userId,
      },
    })

    const wonCount = await prisma.userPrediction.count({
        where: {
            userId: userId,
            status: 'won'
        }
    });
    
    const total = aggregations._count._all
    const successful = wonCount
    
    return total > 0 ? (successful / total) * 100 : 0
  } catch (error) {
    console.error("Error calculating prediction accuracy:", error)
    return 0
  }
}

function formatMemberSince(createdAt: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return `${months[createdAt.getMonth()]} ${createdAt.getFullYear()}`
}

function formatVIPExpiry(expiryDate: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  return `${months[expiryDate.getMonth()]} ${expiryDate.getDate()}, ${expiryDate.getFullYear()}`
}

function formatPercentage(value: number): string {
  return `${Math.round(value)}%`
}

async function calculatePurchaseMetrics(userId: string): Promise<{
  totalTipsPurchased: number
  thisMonthActivity: number
  totalSpent: number
  averageConfidence: number
}> {
  try {
    // Calculate total tips purchased
    const totalPurchases = await prisma.purchase.count({
      where: {
        userId: userId,
        status: 'completed'
      }
    })

    // Calculate this month's activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const thisMonthPurchases = await prisma.purchase.count({
      where: {
        userId: userId,
        status: 'completed',
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    })

    // Calculate total spent
    const totalSpentResult = await prisma.purchase.aggregate({
      _sum: {
        amount: true
      },
      where: {
        userId: userId,
        status: 'completed'
      }
    })

    // Calculate average confidence from purchased tips
    const confidenceResult = await prisma.purchase.findMany({
      where: {
        userId: userId,
        status: 'completed'
      },
      include: {
        quickPurchase: {
          select: {
            confidenceScore: true
          }
        }
      }
    })

    const validConfidenceScores = confidenceResult
      .map(p => p.quickPurchase?.confidenceScore)
      .filter((score): score is number => score !== null && score !== undefined)

    const averageConfidence = validConfidenceScores.length > 0
      ? validConfidenceScores.reduce((sum, score) => sum + score, 0) / validConfidenceScores.length
      : 0

    return {
      totalTipsPurchased: totalPurchases,
      thisMonthActivity: thisMonthPurchases,
      totalSpent: totalSpentResult._sum.amount || 0,
      averageConfidence: Math.round(averageConfidence)
    }
  } catch (error) {
    console.error("Error calculating purchase metrics:", error)
    return {
      totalTipsPurchased: 0,
      thisMonthActivity: 0,
      totalSpent: 0,
      averageConfidence: 0
    }
  }
} 