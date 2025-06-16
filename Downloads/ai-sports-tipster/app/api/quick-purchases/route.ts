import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const prisma = new PrismaClient()

// GET /api/quick-purchases
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
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

    // Debug: Log user countryId
    console.log('User countryId:', user.countryId)

    // Fetch active quick purchases for user's country
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        countryId: user.countryId,
        isActive: true
      },
      orderBy: { displayOrder: "asc" },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })
    // Debug: Log quickPurchases
    console.log('QuickPurchases:', quickPurchases)

    // Fetch all package prices for this country
    const packagePrices = await prisma.packageCountryPrice.findMany({
      where: { countryId: user.countryId },
    })
    // Debug: Log packagePrices
    console.log('PackageCountryPrices:', packagePrices)

    const priceMap = Object.fromEntries(packagePrices.map((p: { packageType: string; price: number }) => [p.packageType, p.price]))

    // Attach correct price to each quick purchase item
    const itemsWithCorrectPrice = quickPurchases.map((item: { type: string; price: number }) => ({
      ...item,
      price: priceMap[item.type] !== undefined ? priceMap[item.type] : item.price
    }))
    // Debug: Log itemsWithCorrectPrice
    console.log('ItemsWithCorrectPrice:', itemsWithCorrectPrice)

    return NextResponse.json(itemsWithCorrectPrice)
  } catch (error) {
    console.error("Error fetching quick purchases:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 