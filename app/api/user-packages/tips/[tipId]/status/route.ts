import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

// PATCH /api/user-packages/tips/[tipId]/status - Update tip status and notes
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tipId: string }> }
) {
  try {
    const { tipId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { status, notes } = await request.json()

    // Validate status
    const validStatuses = ['claimed', 'used', 'expired', 'cancelled']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: "Invalid status. Must be one of: claimed, used, expired, cancelled" 
      }, { status: 400 })
    }

    // Update the tip status and notes
    const updatedTip = await prisma.userPackageTip.update({
      where: {
        id: tipId,
        userPackage: {
          userId: session.user.id // Ensure user owns this tip
        }
      },
      data: {
        status: status || undefined,
        notes: notes || undefined,
        usedAt: status === 'used' ? new Date() : undefined
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
        },
        tipUsage: true
      }
    })

    // Transform the response
    const transformedTip = {
      id: updatedTip.id,
      claimedAt: updatedTip.claimedAt.toISOString(),
      status: updatedTip.status,
      expiresAt: updatedTip.expiresAt?.toISOString(),
      notes: updatedTip.notes,
      
      package: {
        id: updatedTip.userPackage.id,
        name: updatedTip.userPackage.packageOffer.name,
        type: updatedTip.userPackage.packageOffer.packageType
      },
      
      prediction: {
        id: updatedTip.prediction.id,
        predictionType: updatedTip.prediction.predictionType,
        confidenceScore: updatedTip.prediction.confidenceScore,
        odds: updatedTip.prediction.odds,
        valueRating: updatedTip.prediction.valueRating,
        match: {
          homeTeam: { name: updatedTip.prediction.match.homeTeam.name },
          awayTeam: { name: updatedTip.prediction.match.awayTeam.name },
          league: { name: updatedTip.prediction.match.league.name }
        }
      }
    }

    return NextResponse.json({
      success: true,
      tip: transformedTip,
      message: "Tip status updated successfully"
    })

  } catch (error) {
    console.error("Error updating tip status:", error)
    return NextResponse.json({ error: "Failed to update tip status" }, { status: 500 })
  }
} 