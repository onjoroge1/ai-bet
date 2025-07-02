import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"

// GET /api/admin/pricing/countries - Get all countries for pricing management
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const countries = await prisma.country.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        currencyCode: true,
        currencySymbol: true,
        flagEmoji: true,
        isActive: true
      },
      where: {
        isActive: true
      },
      orderBy: {
        name: "asc"
      }
    })

    return NextResponse.json(countries)
  } catch (error) {
    console.error("Error fetching countries:", error)
    return NextResponse.json({ error: "Failed to fetch countries" }, { status: 500 })
  }
} 