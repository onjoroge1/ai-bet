import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { compare } from "bcryptjs"
import { logger } from "@/lib/logger"
import { generateToken } from "@/lib/auth"

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    // Validate input
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
        countryId: user.country?.code ?? 'US',
        countryName: user.country?.name ?? 'United States',
        currencySymbol: user.country?.currencySymbol ?? '$',
        currencyCode: user.country?.currencyCode ?? 'USD',
        flagEmoji: user.country?.flagEmoji ?? '🇺🇸',
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
      maxAge: 24 * 60 * 60, // 24 hours
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
