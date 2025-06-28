import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

// POST /api/user-packages/tips/[tipId]/use - Record tip usage
export async function POST(
  request: Request,
  { params }: { params: { tipId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { stakeAmount, notes } = await request.json()

    // Validate stake amount
    if (!stakeAmount || stakeAmount <= 0) {
      return NextResponse.json({ 
        error: "Valid stake amount is required" 
      }, { status: 400 })
    }

    // Check if tip exists and belongs to user
    const existingTip = await prisma.userPackageTip.findFirst({
      where: {
        id: params.tipId,
        userPackage: {
          userId: session.user.id
        }
      },
      include: {
        tipUsage: true
      }
    })

    if (!existingTip) {
      return NextResponse.json({ 
        error: "Tip not found or you don't have access to it" 
      }, { status: 404 })
    }

    // Check if tip is already used
    if (existingTip.tipUsage) {
      return NextResponse.json({ 
        error: "This tip has already been used" 
      }, { status: 400 })
    }

    // Check if tip is in valid status
    if (existingTip.status !== 'claimed') {
      return NextResponse.json({ 
        error: "Tip must be in 'claimed' status to be used" 
      }, { status: 400 })
    }

    // Create tip usage record
    const tipUsage = await prisma.tipUsage.create({
      data: {
        userPackageTipId: params.tipId,
        userId: session.user.id,
        stakeAmount: stakeAmount,
        notes: notes || null
      }
    })

    // Update tip status to 'used'
    await prisma.userPackageTip.update({
      where: { id: params.tipId },
      data: { 
        status: 'used',
        usedAt: new Date()
      }
    })

    // Get updated tip with all related data
    const updatedTip = await prisma.userPackageTip.findUnique({
      where: { id: params.tipId },
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
      id: updatedTip!.id,
      claimedAt: updatedTip!.claimedAt.toISOString(),
      status: updatedTip!.status,
      expiresAt: updatedTip!.expiresAt?.toISOString(),
      notes: updatedTip!.notes,
      
      package: {
        id: updatedTip!.userPackage.id,
        name: updatedTip!.userPackage.packageOffer.name,
        type: updatedTip!.userPackage.packageOffer.packageType,
        colorGradientFrom: updatedTip!.userPackage.packageOffer.colorGradientFrom,
        colorGradientTo: updatedTip!.userPackage.packageOffer.colorGradientTo
      },
      
      prediction: {
        id: updatedTip!.prediction.id,
        predictionType: updatedTip!.prediction.predictionType,
        confidenceScore: updatedTip!.prediction.confidenceScore,
        odds: updatedTip!.prediction.odds,
        valueRating: updatedTip!.prediction.valueRating,
        match: {
          homeTeam: { name: updatedTip!.prediction.match.homeTeam.name },
          awayTeam: { name: updatedTip!.prediction.match.awayTeam.name },
          league: { name: updatedTip!.prediction.match.league.name }
        }
      },
      
      usage: {
        id: tipUsage.id,
        usedAt: tipUsage.usedAt.toISOString(),
        stakeAmount: tipUsage.stakeAmount,
        actualReturn: tipUsage.actualReturn,
        notes: tipUsage.notes
      }
    }

    return NextResponse.json({
      success: true,
      tip: transformedTip,
      message: "Tip usage recorded successfully"
    })

  } catch (error) {
    console.error("Error recording tip usage:", error)
    return NextResponse.json({ error: "Failed to record tip usage" }, { status: 500 })
  }
}

// PATCH /api/user-packages/tips/[tipId]/use - Update tip usage (e.g., add actual return)
export async function PATCH(
  request: Request,
  { params }: { params: { tipId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { actualReturn, notes } = await request.json()

    // Update tip usage
    const updatedUsage = await prisma.tipUsage.update({
      where: {
        userPackageTipId: params.tipId,
        userId: session.user.id
      },
      data: {
        actualReturn: actualReturn || undefined,
        notes: notes || undefined
      }
    })

    return NextResponse.json({
      success: true,
      usage: {
        id: updatedUsage.id,
        usedAt: updatedUsage.usedAt.toISOString(),
        stakeAmount: updatedUsage.stakeAmount,
        actualReturn: updatedUsage.actualReturn,
        notes: updatedUsage.notes
      },
      message: "Tip usage updated successfully"
    })

  } catch (error) {
    console.error("Error updating tip usage:", error)
    return NextResponse.json({ error: "Failed to update tip usage" }, { status: 500 })
  }
} 