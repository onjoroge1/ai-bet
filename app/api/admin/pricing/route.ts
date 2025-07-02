import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"

// GET /api/admin/pricing - List all pricing configurations
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pricingConfigs = await prisma.packageCountryPrice.findMany({
      include: {
        country: {
          select: {
            id: true,
            name: true,
            code: true,
            currencyCode: true,
            currencySymbol: true,
            flagEmoji: true
          }
        }
      },
      orderBy: [
        { country: { name: "asc" } },
        { packageType: "asc" }
      ]
    })

    return NextResponse.json(pricingConfigs)
  } catch (error) {
    console.error("Error fetching pricing configurations:", error)
    return NextResponse.json({ error: "Failed to fetch pricing configurations" }, { status: 500 })
  }
}

// POST /api/admin/pricing - Create new pricing configuration
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { countryId, packageType, price } = body

    // Validate required fields
    if (!countryId || !packageType || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate price is positive
    if (parseFloat(price) <= 0) {
      return NextResponse.json({ error: "Price must be greater than 0" }, { status: 400 })
    }

    // Check if pricing configuration already exists
    const existingConfig = await prisma.packageCountryPrice.findUnique({
      where: {
        countryId_packageType: {
          countryId,
          packageType
        }
      }
    })

    if (existingConfig) {
      return NextResponse.json({ error: "Pricing configuration already exists for this country and package type" }, { status: 409 })
    }

    // Create new pricing configuration
    const pricingConfig = await prisma.packageCountryPrice.create({
      data: {
        countryId,
        packageType,
        price: parseFloat(price)
      },
      include: {
        country: {
          select: {
            id: true,
            name: true,
            code: true,
            currencyCode: true,
            currencySymbol: true,
            flagEmoji: true
          }
        }
      }
    })

    return NextResponse.json(pricingConfig)
  } catch (error) {
    console.error("Error creating pricing configuration:", error)
    return NextResponse.json({ error: "Failed to create pricing configuration" }, { status: 500 })
  }
}

// PUT /api/admin/pricing - Update pricing configuration
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, price } = body

    if (!id) {
      return NextResponse.json({ error: "Pricing configuration ID is required" }, { status: 400 })
    }

    if (!price || parseFloat(price) <= 0) {
      return NextResponse.json({ error: "Valid price is required" }, { status: 400 })
    }

    // Update pricing configuration
    const pricingConfig = await prisma.packageCountryPrice.update({
      where: { id },
      data: {
        price: parseFloat(price)
      },
      include: {
        country: {
          select: {
            id: true,
            name: true,
            code: true,
            currencyCode: true,
            currencySymbol: true,
            flagEmoji: true
          }
        }
      }
    })

    return NextResponse.json(pricingConfig)
  } catch (error) {
    console.error("Error updating pricing configuration:", error)
    return NextResponse.json({ error: "Failed to update pricing configuration" }, { status: 500 })
  }
}

// DELETE /api/admin/pricing - Delete pricing configuration
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: "Pricing configuration ID is required" }, { status: 400 })
    }

    // Delete pricing configuration
    await prisma.packageCountryPrice.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Pricing configuration deleted successfully" })
  } catch (error) {
    console.error("Error deleting pricing configuration:", error)
    return NextResponse.json({ error: "Failed to delete pricing configuration" }, { status: 500 })
  }
} 