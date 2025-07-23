import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

// POST /api/user-packages/tips/[tipId]/use - Record tip usage
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tipId: string }> }
) {
  try {
    const { tipId } = await params
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
        id: tipId,
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
        userPackageTipId: tipId,
        userId: session.user.id,
        stakeAmount: stakeAmount,
        notes: notes || null
      }
    })

    // Update tip status to 'used'
    await prisma.userPackageTip.update({
      where: { id: tipId },
      data: { 
        status: 'used',
        usedAt: new Date()
      }
    })

    // Get updated tip with all related data
    const updatedTip = await prisma.userPackageTip.findUnique({
      where: { id: tipId },
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

    return NextResponse.json({
      success: true,
      data: updatedTip
    })

  } catch (error) {
    console.error('Error using tip:', error)
    return NextResponse.json({ 
      error: "Failed to use tip" 
    }, { status: 500 })
  }
}

// PATCH /api/user-packages/tips/[tipId]/use - Update tip usage
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
        id: tipId,
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

    // Check if tip usage exists
    if (!existingTip.tipUsage) {
      return NextResponse.json({ 
        error: "Tip usage not found" 
      }, { status: 404 })
    }

    // Update tip usage
    const updatedTipUsage = await prisma.tipUsage.update({
      where: { 
        userPackageTipId: tipId 
      },
      data: {
        stakeAmount: stakeAmount,
        notes: notes || null
      }
    })

    // Get updated tip with all related data
    const updatedTip = await prisma.userPackageTip.findUnique({
      where: { id: tipId },
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

    return NextResponse.json({
      success: true,
      data: updatedTip
    })

  } catch (error) {
    console.error('Error updating tip usage:', error)
    return NextResponse.json({ 
      error: "Failed to update tip usage" 
    }, { status: 500 })
  }
} 