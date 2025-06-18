import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Debug: Log the Prisma client
    console.log("Prisma client:", prisma)
    console.log("Available models:", Object.keys(prisma))

    // Try a raw query first to verify database connection
    const rawPurchases = await prisma.$queryRaw`
      SELECT p.*, qp.*, c."currencySymbol", c."currencyCode"
      FROM "Purchase" p
      JOIN "QuickPurchase" qp ON p."quickPurchaseId" = qp.id
      JOIN "Country" c ON qp."countryId" = c.id
      WHERE p."userId" = ${session.user.id}
      AND p.status = 'completed'
      ORDER BY p."createdAt" DESC
    `

    console.log("Raw query result:", rawPurchases)

    // Transform the data to match a more concise format
    const tips = Array.isArray(rawPurchases) ? rawPurchases.map((purchase: any) => ({
      id: purchase.id,
      purchaseDate: purchase.createdAt,
      amount: purchase.amount,
      paymentMethod: purchase.paymentMethod,
      tip: {
        name: purchase.name,
        type: purchase.type,
        price: purchase.price,
        description: purchase.description,
        features: purchase.features,
        isUrgent: purchase.isUrgent,
        timeLeft: purchase.timeLeft,
        currencySymbol: purchase.currencySymbol,
        currencyCode: purchase.currencyCode
      }
    })) : []

    return NextResponse.json(tips)
  } catch (error) {
    console.error("Error fetching user's tips:", error)
    return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 })
  }
} 