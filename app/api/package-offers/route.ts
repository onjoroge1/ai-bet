import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

// GET /api/package-offers - Get available package offers for user's country
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's country
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { countryId: true }
    })

    if (!user?.countryId) {
      return NextResponse.json({ error: "User country not set" }, { status: 400 })
    }

    // Get active package offers with user's country pricing
    const packageOffers = await prisma.packageOffer.findMany({
      where: {
        isActive: true
      },
      include: {
        countryPrices: {
          where: {
            countryId: user.countryId,
            isActive: true
          },
          include: {
            country: {
              select: {
                name: true,
                code: true,
                currencyCode: true,
                currencySymbol: true
              }
            }
          }
        }
      },
      orderBy: {
        displayOrder: "asc"
      }
    })

    // Filter out packages without pricing for user's country
    const availableOffers = packageOffers.filter(offer => offer.countryPrices.length > 0)

    return NextResponse.json(availableOffers)
  } catch (error) {
    console.error("Error fetching package offers:", error)
    return NextResponse.json({ error: "Failed to fetch package offers" }, { status: 500 })
  }
}

// POST /api/package-offers - Purchase a package offer
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { packageOfferId, paymentMethod } = body

    if (!packageOfferId || !paymentMethod) {
      return NextResponse.json({ error: "Package offer ID and payment method are required" }, { status: 400 })
    }

    // Get user's country
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { countryId: true }
    })

    if (!user?.countryId) {
      return NextResponse.json({ error: "User country not set" }, { status: 400 })
    }

    // Get package offer with pricing
    const packageOffer = await prisma.packageOffer.findUnique({
      where: { id: packageOfferId },
      include: {
        countryPrices: {
          where: {
            countryId: user.countryId,
            isActive: true
          }
        }
      }
    })

    if (!packageOffer) {
      return NextResponse.json({ error: "Package offer not found" }, { status: 404 })
    }

    if (packageOffer.countryPrices.length === 0) {
      return NextResponse.json({ error: "Package not available in your country" }, { status: 400 })
    }

    const countryPrice = packageOffer.countryPrices[0]

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + packageOffer.validityDays)

    // Create user package
    const userPackage = await prisma.userPackage.create({
      data: {
        userId: session.user.id,
        packageOfferId,
        expiresAt,
        tipsRemaining: packageOffer.tipCount,
        totalTips: packageOffer.tipCount,
        pricePaid: countryPrice.price,
        currencyCode: countryPrice.currencyCode,
        currencySymbol: countryPrice.currencySymbol
      },
      include: {
        packageOffer: true,
        user: {
          select: {
            email: true,
            fullName: true
          }
        }
      }
    })

    // TODO: Integrate with payment gateway here
    // For now, we'll assume payment is successful

    return NextResponse.json({
      success: true,
      userPackage,
      message: "Package purchased successfully"
    })
  } catch (error) {
    console.error("Error purchasing package:", error)
    return NextResponse.json({ error: "Failed to purchase package" }, { status: 500 })
  }
} 