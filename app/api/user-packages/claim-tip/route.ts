import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

// POST /api/user-packages/claim-tip - Claim a tip from user's package
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { predictionId, purchaseType } = body

    if (!predictionId) {
      return NextResponse.json({ error: "Prediction ID is required" }, { status: 400 })
    }

    // Get user's active packages
    const userPackages = await prisma.userPackage.findMany({
      where: {
        userId: session.user.id,
        status: "active",
        expiresAt: {
          gt: new Date()
        },
        tipsRemaining: {
          gt: 0
        }
      },
      include: {
        packageOffer: true
      },
      orderBy: {
        expiresAt: "asc" // Use packages that expire first
      }
    })

    if (userPackages.length === 0) {
      return NextResponse.json({ 
        error: "No active packages found. Please purchase a package to access tips." 
      }, { status: 400 })
    }

    let prediction = null
    let tipClaim = null

    // Handle different purchase types
    if (purchaseType === "quick_purchase") {
      // For Quick Purchase items, we need to create a prediction record
      const quickPurchase = await prisma.quickPurchase.findUnique({
        where: { id: predictionId }
      })

      if (!quickPurchase) {
        return NextResponse.json({ error: "Quick purchase not found" }, { status: 404 })
      }

      // Check if user has already claimed this Quick Purchase
      const existingClaim = await prisma.userPackageTip.findFirst({
        where: {
          userPackage: {
            userId: session.user.id
          },
          prediction: {
            matchId: quickPurchase.matchId || ""
          }
        }
      })

      if (existingClaim) {
        return NextResponse.json({ 
          error: "You have already claimed this tip" 
        }, { status: 400 })
      }

      // Create a prediction record for this Quick Purchase
      prediction = await prisma.prediction.create({
        data: {
          matchId: quickPurchase.matchId || "",
          predictionType: quickPurchase.predictionType || "home_win",
          confidenceScore: quickPurchase.confidenceScore || 50,
          odds: quickPurchase.odds || 2.0,
          valueRating: quickPurchase.valueRating || "Medium",
          explanation: quickPurchase.analysisSummary || "AI prediction from Quick Purchase",
          isFree: false,
          isFeatured: false,
          status: "pending",
          showInDailyTips: false,
          showInWeeklySpecials: false,
          type: "single"
        }
      })
    } else {
      // Regular prediction claiming
      prediction = await prisma.prediction.findUnique({
        where: { id: predictionId },
        include: {
          match: true
        }
      })

      if (!prediction) {
        return NextResponse.json({ error: "Prediction not found" }, { status: 404 })
      }

      // Check if user has already claimed this prediction
      const existingClaim = await prisma.userPackageTip.findFirst({
        where: {
          userPackage: {
            userId: session.user.id
          },
          predictionId
        }
      })

      if (existingClaim) {
        return NextResponse.json({ 
          error: "You have already claimed this tip" 
        }, { status: 400 })
      }

      // Check if prediction is still valid (not finished)
      if (prediction.status === "finished") {
        return NextResponse.json({ 
          error: "This prediction is no longer available (match finished)" 
        }, { status: 400 })
      }
    }

    // Find the best package to use (prioritize limited packages over unlimited)
    let selectedPackage = null
    for (const userPackage of userPackages) {
      if (userPackage.packageOffer.tipCount === -1) {
        // Unlimited package - use this as fallback
        if (!selectedPackage) {
          selectedPackage = userPackage
        }
      } else if (userPackage.tipsRemaining > 0) {
        // Limited package with remaining tips - use this
        selectedPackage = userPackage
        break
      }
    }

    if (!selectedPackage) {
      return NextResponse.json({ 
        error: "No packages with remaining tips found" 
      }, { status: 400 })
    }

    // Create the tip claim
    tipClaim = await prisma.userPackageTip.create({
      data: {
        userPackageId: selectedPackage.id,
        predictionId: prediction.id
      },
      include: {
        prediction: {
          include: {
            match: {
              include: {
                homeTeam: true,
                awayTeam: true,
                league: true
              }
            }
          }
        },
        userPackage: {
          include: {
            packageOffer: true
          }
        }
      }
    })

    // Update tips remaining (only for limited packages)
    if (selectedPackage.packageOffer.tipCount !== -1) {
      await prisma.userPackage.update({
        where: { id: selectedPackage.id },
        data: {
          tipsRemaining: selectedPackage.tipsRemaining - 1,
          status: selectedPackage.tipsRemaining - 1 === 0 ? "completed" : "active"
        }
      })
    }

    return NextResponse.json({
      success: true,
      tipClaim,
      message: "Tip claimed successfully",
      remainingTips: selectedPackage.packageOffer.tipCount === -1 ? "Unlimited" : selectedPackage.tipsRemaining - 1
    })

  } catch (error) {
    console.error("Error claiming tip:", error)
    return NextResponse.json({ error: "Failed to claim tip" }, { status: 500 })
  }
}

// GET /api/user-packages/claim-tip - Get user's available packages and remaining tips
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's active packages
    const userPackages = await prisma.userPackage.findMany({
      where: {
        userId: session.user.id,
        status: "active",
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        packageOffer: true
      },
      orderBy: {
        expiresAt: "asc"
      }
    })

    // Calculate total tips remaining
    let totalTipsRemaining = 0
    let hasUnlimited = false

    for (const userPackage of userPackages) {
      if (userPackage.packageOffer.tipCount === -1) {
        hasUnlimited = true
        break
      } else {
        totalTipsRemaining += userPackage.tipsRemaining
      }
    }

    // Get recent tips (last 5 claimed tips)
    const recentTips = await prisma.userPackageTip.findMany({
      where: {
        userPackage: {
          userId: session.user.id
        }
      },
      include: {
        prediction: {
          include: {
            match: {
              include: {
                homeTeam: true,
                awayTeam: true,
                league: true
              }
            }
          }
        }
      },
      orderBy: {
        claimedAt: 'desc'
      },
      take: 5
    })

    // Get total tips claimed
    const totalTipsClaimed = await prisma.userPackageTip.count({
      where: {
        userPackage: {
          userId: session.user.id
        }
      }
    })

    // Transform recent tips for frontend
    const transformedRecentTips = recentTips.map(tip => ({
      id: tip.id,
      claimedAt: tip.claimedAt.toISOString(),
      status: tip.status,
      prediction: {
        predictionType: tip.prediction.predictionType,
        match: {
          homeTeam: { name: tip.prediction.match.homeTeam.name },
          awayTeam: { name: tip.prediction.match.awayTeam.name },
          league: { name: tip.prediction.match.league.name }
        }
      }
    }))

    return NextResponse.json({
      userPackages,
      totalTipsRemaining: hasUnlimited ? "Unlimited" : totalTipsRemaining,
      hasUnlimited,
      recentTips: transformedRecentTips,
      totalTipsClaimed
    })
  } catch (error) {
    console.error("Error fetching user packages:", error)
    return NextResponse.json({ error: "Failed to fetch user packages" }, { status: 500 })
  }
} 