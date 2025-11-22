import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { compare } from "bcryptjs"
import { logger } from "@/lib/logger"
import { generateToken } from "@/lib/auth"

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  // ⚠️ DEPRECATED: This route uses custom JWT tokens and should NOT be used
  // The signin form should use NextAuth's signIn() which calls /api/auth/[...nextauth]
  // This route is kept for legacy/API-only use only
  
  logger.warn("⚠️ DEPRECATED: /api/auth/signin route called - This should use NextAuth instead", {
    tags: ["auth", "signin", "deprecated"],
    data: { 
      email: request.body ? "present" : "missing",
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      timestamp: new Date().toISOString()
    }
  })
  console.warn("⚠️ DEPRECATED: /api/auth/signin route called - This creates custom JWT tokens, not NextAuth sessions!")
  console.warn("⚠️ The signin form should use NextAuth's signIn() instead")
  
  try {
    const { email, password } = await request.json()
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    logger.info("⚠️ DEPRECATED: Attempting sign in via legacy route", {
      tags: ["auth", "signin", "deprecated"],
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
