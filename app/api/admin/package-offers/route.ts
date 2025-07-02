import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

// GET /api/admin/package-offers - List all package offers
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const packageOffers = await prisma.packageOffer.findMany({
      include: {
        countryPrices: {
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

    return NextResponse.json(packageOffers)
  } catch (error) {
    console.error("Error fetching package offers:", error)
    return NextResponse.json({ error: "Failed to fetch package offers" }, { status: 500 })
  }
}

// POST /api/admin/package-offers - Create new package offer
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      packageType,
      description,
      tipCount,
      validityDays,
      features,
      iconName,
      colorGradientFrom,
      colorGradientTo,
      countryPrices
    } = body

    // Validate required fields
    if (!name || !packageType || !description || !tipCount || !validityDays) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create package offer with country prices
    const packageOffer = await prisma.packageOffer.create({
      data: {
        name,
        packageType,
        description,
        tipCount,
        validityDays,
        features: features || [],
        iconName: iconName || "Gift",
        colorGradientFrom: colorGradientFrom || "#8B5CF6",
        colorGradientTo: colorGradientTo || "#EC4899",
        countryPrices: {
          create: countryPrices.map((price: any) => ({
            countryId: price.countryId,
            price: price.price,
            originalPrice: price.originalPrice,
            currencyCode: price.currencyCode,
            currencySymbol: price.currencySymbol
          }))
        }
      },
      include: {
        countryPrices: {
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
      }
    })

    return NextResponse.json(packageOffer)
  } catch (error) {
    console.error("Error creating package offer:", error)
    return NextResponse.json({ error: "Failed to create package offer" }, { status: 500 })
  }
}

// PUT /api/admin/package-offers - Update package offer
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      id,
      name,
      packageType,
      description,
      tipCount,
      validityDays,
      features,
      iconName,
      colorGradientFrom,
      colorGradientTo,
      isActive,
      displayOrder,
      countryPrices
    } = body

    if (!id) {
      return NextResponse.json({ error: "Package offer ID is required" }, { status: 400 })
    }

    // Update package offer
    const packageOffer = await prisma.packageOffer.update({
      where: { id },
      data: {
        name,
        packageType,
        description,
        tipCount,
        validityDays,
        features: features || [],
        iconName: iconName || "Gift",
        colorGradientFrom: colorGradientFrom || "#8B5CF6",
        colorGradientTo: colorGradientTo || "#EC4899",
        isActive,
        displayOrder
      },
      include: {
        countryPrices: {
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
      }
    })

    // Update country prices if provided
    if (countryPrices) {
      // Delete existing prices
      await prisma.packageOfferCountryPrice.deleteMany({
        where: { packageOfferId: id }
      })

      // Create new prices
      await prisma.packageOfferCountryPrice.createMany({
        data: countryPrices.map((price: any) => ({
          packageOfferId: id,
          countryId: price.countryId,
          price: price.price,
          originalPrice: price.originalPrice,
          currencyCode: price.currencyCode,
          currencySymbol: price.currencySymbol
        }))
      })
    }

    return NextResponse.json(packageOffer)
  } catch (error) {
    console.error("Error updating package offer:", error)
    return NextResponse.json({ error: "Failed to update package offer" }, { status: 500 })
  }
}

// DELETE /api/admin/package-offers - Delete package offer
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Package offer ID is required" }, { status: 400 })
    }

    // Check if package has active users
    const activeUsers = await prisma.userPackage.count({
      where: {
        packageOfferId: id,
        status: "active"
      }
    })

    if (activeUsers > 0) {
      return NextResponse.json({ 
        error: "Cannot delete package offer with active users. Deactivate instead." 
      }, { status: 400 })
    }

    // Delete package offer and related data
    await prisma.packageOfferCountryPrice.deleteMany({
      where: { packageOfferId: id }
    })

    await prisma.packageOffer.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Package offer deleted successfully" })
  } catch (error) {
    console.error("Error deleting package offer:", error)
    return NextResponse.json({ error: "Failed to delete package offer" }, { status: 500 })
  }
} 