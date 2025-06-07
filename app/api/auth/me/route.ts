import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("user-session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const userSession = JSON.parse(sessionCookie.value)

    // Verify user still exists and is active
    const users = await sql`
      SELECT u.*, c.name as countryName, c.currencySymbol, c.currencyCode, c.flagEmoji
      FROM "User" u
      LEFT JOIN "Country" c ON u."countryId" = c.id
      WHERE u.id = ${userSession.id} AND u."isActive" = true
    `

    if (users.length === 0) {
      logger.warn("Session validation failed - user not found", {
        tags: ["auth", "session"],
        data: { userId: userSession.id },
      })

      const response = NextResponse.json({ error: "Invalid session" }, { status: 401 })

      // Clear invalid session
      response.cookies.set("user-session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
      })

      return response
    }

    const user = users[0]

    // Return updated user data
    const updatedUserSession = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      countryId: user.countryId,
      countryName: user.countryName,
      currencySymbol: user.currencySymbol,
      currencyCode: user.currencyCode,
      flagEmoji: user.flagEmoji,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      totalWinnings: user.totalWinnings,
      winStreak: user.winStreak,
    }

    return NextResponse.json({
      success: true,
      user: updatedUserSession,
    })
  } catch (error) {
    logger.error("Session validation error", {
      tags: ["auth", "session"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
