import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Decimal } from "@prisma/client/runtime/library"

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
      console.log('User has no country set:', session.user.id)
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

    if (!quickPurchases.length) {
      console.log('No quick purchases found for country:', user.countryId)
      return NextResponse.json([], { status: 200 })
    }

    // Debug: Log quickPurchases
    console.log('QuickPurchases:', quickPurchases)

    // Fetch all package prices for this country
    const packagePrices = await prisma.packageCountryPrice.findMany({
      where: { countryId: user.countryId },
    })

    if (!packagePrices.length) {
      console.log('No package prices found for country:', user.countryId)
      return NextResponse.json(quickPurchases, { status: 200 })
    }

    // Debug: Log packagePrices
    console.log('PackageCountryPrices:', packagePrices)

    const priceMap = Object.fromEntries(
      packagePrices.map((p) => [p.packageType, Number(p.price)])
    )

    // Attach correct price to each quick purchase item
    const itemsWithCorrectPrice = quickPurchases.map((item) => ({
      ...item,
      price: priceMap[item.type] !== undefined ? priceMap[item.type] : Number(item.price)
    }))

    // Debug: Log itemsWithCorrectPrice
    console.log('ItemsWithCorrectPrice:', itemsWithCorrectPrice)

    return NextResponse.json(itemsWithCorrectPrice)
  } catch (error) {
    console.error("Error fetching quick purchases:", error)
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Internal Server Error", 
        details: error.message 
      }, { status: 500 })
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 