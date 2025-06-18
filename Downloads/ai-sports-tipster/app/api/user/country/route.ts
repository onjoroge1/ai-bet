import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { countryCode } = await request.json()
    if (!countryCode) {
      return NextResponse.json({ error: "Country code is required" }, { status: 400 })
    }

    // Find the country by code
    const country = await prisma.country.findUnique({
      where: { code: countryCode.toUpperCase() }
    })

    if (!country) {
      return NextResponse.json({ error: "Invalid country code" }, { status: 400 })
    }

    // Update user's country
    await prisma.user.update({
      where: { id: session.user.id },
      data: { countryId: country.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user country:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 