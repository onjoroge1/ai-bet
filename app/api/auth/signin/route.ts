import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, remember } = body

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    logger.info("Attempting sign in", {
      tags: ["auth", "signin"],
      data: { email },
    })

    // For demo purposes, allow any login
    // In production, you would verify against your database
    const user = {
      id: "user-123",
      email: email,
      fullName: "Demo User",
      role: "user",
      countryId: "ke",
      countryName: "Kenya",
      currencySymbol: "KES",
      currencyCode: "KES",
      flagEmoji: "🇰🇪",
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
      totalWinnings: 0,
      winStreak: 0,
    }

    // Create session
    const session = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      user: user,
    })

    // Set session cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60, // 30 days or 24 hours
      path: "/",
    }

    // Set the cookie with the session data
    response.cookies.set("user-session", JSON.stringify(session), cookieOptions)

    logger.info("Sign in successful", {
      tags: ["auth", "signin"],
      data: { email, userId: user.id },
    })

    return response
  } catch (error) {
    logger.error("Sign in error", {
      tags: ["auth", "signin"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
