import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

interface TipClaim {
  id: string
  predictionId: string
  claimedAt: Date
  prediction: {
    match: {
      homeTeam: {
        name: string
      }
      awayTeam: {
        name: string
      }
    }
  }
  userPackage: {
    packageOffer: {
      name: string
    }
  }
}

// GET /api/user-packages/recent-activity - Get user's recent tip claiming activity
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's recent tip claims
    const recentActivity = await prisma.userPackageTip.findMany({
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
                awayTeam: true
              }
            }
          }
        },
        userPackage: {
          include: {
            packageOffer: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        claimedAt: "desc"
      },
      take: 10 // Limit to last 10 claims
    })

    // Transform the data for the frontend
    const transformedActivity = recentActivity.map((claim: TipClaim) => ({
      id: claim.id,
      predictionId: claim.predictionId,
      claimedAt: claim.claimedAt.toISOString(),
      match: {
        homeTeam: { name: claim.prediction.match.homeTeam.name },
        awayTeam: { name: claim.prediction.match.awayTeam.name }
      },
      packageOffer: {
        name: claim.userPackage.packageOffer.name
      }
    }))

    return NextResponse.json(transformedActivity)
  } catch (error) {
    console.error("Error fetching recent activity:", error)
    return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 })
  }
} 