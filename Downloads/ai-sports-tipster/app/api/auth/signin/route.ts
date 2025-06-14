import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { generateToken } from "@/lib/auth"
import { compare } from "bcryptjs"

// Use the same secret key as middleware
const JWT_SECRET = 'your-super-secret-key-that-should-be-changed-in-production'

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

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        country: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Verify password
    const isValidPassword = await compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Generate JWT token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    console.log('Signin - Generated token payload:', {
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        countryId: user.country.code,
        countryName: user.country.name,
        currencySymbol: user.country.currencySymbol,
        currencyCode: user.country.currencyCode,
        flagEmoji: user.country.flagEmoji,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        totalWinnings: user.totalWinnings,
        winStreak: user.winStreak,
      },
    })

    // Set token cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60, // 30 days or 24 hours
      path: "/",
    }

    response.cookies.set("token", token, cookieOptions)
    console.log('Signin - Set token cookie with options:', cookieOptions)

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
