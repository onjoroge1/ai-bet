import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserStreakDetails } from "@/lib/streak-calculator"

// GET /api/user/streak-details
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const streakDetails = await getUserStreakDetails(session.user.id)

    return NextResponse.json(streakDetails)
  } catch (error) {
    console.error("Error fetching streak details:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 