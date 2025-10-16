import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || session.user.id
    const checkLastClaim = searchParams.get("checkLastClaim")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Verify the user is requesting their own data
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // If checking last claim date
    if (checkLastClaim === "true") {
      // First get the user's UserPoints record
      const userPoints = await prisma.userPoints.findUnique({
        where: { userId: session.user.id }
      })
      
      if (userPoints) {
        const lastClaim = await prisma.pointTransaction.findFirst({
          where: {
            userPointsId: userPoints.id,
            type: "QUIZ_COMPLETION"
          },
          orderBy: {
            createdAt: "desc"
          },
          select: {
            createdAt: true
          }
        })

        return NextResponse.json({ 
          lastClaimDate: lastClaim?.createdAt || null 
        })
      }
      
      return NextResponse.json({ 
        lastClaimDate: null 
      })
    }

    const participations = await prisma.quizParticipation.findMany({
      where: { userId },
      orderBy: { participatedAt: "desc" },
      select: {
        id: true,
        totalScore: true,
        correctAnswers: true,
        questionsAnswered: true,
        participatedAt: true,
        isCompleted: true,
        referralCode: true,
        bettingExperience: true,
        creditsClaimed: true,
        claimedAt: true
      }
    })

    return NextResponse.json({ participations })
  } catch (error) {
    console.error("Error fetching quiz participations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 