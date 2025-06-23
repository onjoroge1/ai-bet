import prisma from "@/lib/db"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET /api/admin/quick-purchases
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const quickPurchases = await prisma.quickPurchase.findMany({
      orderBy: { displayOrder: "asc" },
      include: { country: true }
    })

    return NextResponse.json(quickPurchases)
  } catch (error) {
    console.error("Error fetching quick purchases:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// POST /api/admin/quick-purchases
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()
    console.log('Received data:', data)
    
    // Validate required fields
    const requiredFields = ["name", "price", "description", "type", "iconName", "countryId"]
    for (const field of requiredFields) {
      if (!data[field]) {
        console.error(`Missing required field: ${field}`)
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Validate data types
    if (isNaN(parseFloat(data.price))) {
      console.error('Invalid price format:', data.price)
      return NextResponse.json({ error: "Price must be a valid number" }, { status: 400 })
    }

    // Validate country exists
    const country = await prisma.country.findUnique({
      where: { id: data.countryId }
    })
    if (!country) {
      console.error('Country not found:', data.countryId)
      return NextResponse.json({ error: "Invalid country ID" }, { status: 400 })
    }

    console.log('Creating quick purchase with data:', {
      ...data,
      price: parseFloat(data.price),
      originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
      discountPercentage: data.discountPercentage ? parseInt(data.discountPercentage.toString()) : null,
    })

    const quickPurchase = await prisma.quickPurchase.create({
      data: {
        ...data,
        features: data.features || [],
        price: parseFloat(data.price),
        originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
        discountPercentage: data.discountPercentage ? parseInt(data.discountPercentage.toString()) : null,
      },
      include: { country: true }
    })

    console.log('Created quick purchase:', quickPurchase)
    return NextResponse.json(quickPurchase)
  } catch (error) {
    console.error("Error creating quick purchase:", error)
    // Log the full error details
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    }
    return NextResponse.json({ 
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// PUT /api/admin/quick-purchases/:id
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()
    const { id } = params

    const quickPurchase = await prisma.quickPurchase.update({
      where: { id },
      data,
      include: { country: true }
    })

    return NextResponse.json(quickPurchase)
  } catch (error) {
    console.error("Error updating quick purchase:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// DELETE /api/admin/quick-purchases/:id
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    await prisma.quickPurchase.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting quick purchase:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 