import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/database"
import bcrypt from "bcryptjs"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, countryId, marketingConsent } = await request.json()

    // Validate input
    if (!name || !email || !password || !countryId) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
    }

    logger.info("Sign up attempt", {
      tags: ["auth", "signup"],
      data: { email, countryId },
    })

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM "User" WHERE email = ${email}
    `

    if (existingUsers.length > 0) {
      logger.warn("Sign up failed - email already exists", {
        tags: ["auth", "signup"],
        data: { email },
      })
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    // Verify country exists
    const countries = await sql`
      SELECT id FROM "Country" WHERE id = ${countryId} AND "isActive" = true
    `

    if (countries.length === 0) {
      return NextResponse.json({ error: "Invalid country selected" }, { status: 400 })
    }

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Generate user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create user
    await sql`
      INSERT INTO "User" (
        id, email, password, "fullName", "countryId", role, 
        "subscriptionPlan", "isActive", "createdAt", "totalWinnings", "winStreak"
      ) VALUES (
        ${userId}, ${email}, ${hashedPassword}, ${name}, ${countryId}, 'user',
        'free', true, NOW(), 0, 0
      )
    `

    // Create user wallet
    const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const country = await sql`
      SELECT "currencyCode" FROM "Country" WHERE id = ${countryId}
    `

    await sql`
      INSERT INTO "Wallet" (id, "userId", balance, currency, "createdAt", "updatedAt")
      VALUES (${walletId}, ${userId}, 0, ${country[0]?.currencyCode || "KES"}, NOW(), NOW())
    `

    // Create welcome notification
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await sql`
      INSERT INTO "UserNotification" (
        id, "userId", title, message, type, "isRead", "createdAt"
      ) VALUES (
        ${notificationId}, ${userId}, 'Welcome to AI Tipster!', 
        'Your account has been created successfully. Start with 3 free daily predictions!',
        'system', false, NOW()
      )
    `

    // Get user with country info for session
    const newUsers = await sql`
      SELECT u.*, c.name as countryName, c.currencySymbol, c.currencyCode, c.flagEmoji
      FROM "User" u
      LEFT JOIN "Country" c ON u."countryId" = c.id
      WHERE u.id = ${userId}
    `

    const newUser = newUsers[0]

    // Create user session data
    const userSession = {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      countryId: newUser.countryId,
      countryName: newUser.countryName,
      currencySymbol: newUser.currencySymbol,
      currencyCode: newUser.currencyCode,
      flagEmoji: newUser.flagEmoji,
      subscriptionPlan: newUser.subscriptionPlan,
      subscriptionExpiresAt: newUser.subscriptionExpiresAt,
      totalWinnings: newUser.totalWinnings,
      winStreak: newUser.winStreak,
    }

    logger.info("Sign up successful", {
      tags: ["auth", "signup"],
      data: { email, userId, countryId },
    })

    const response = NextResponse.json({
      success: true,
      user: userSession,
    })

    // Set session cookie
    response.cookies.set("user-session", JSON.stringify(userSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 1 day
    })

    return response
  } catch (error) {
    logger.error("Sign up error", {
      tags: ["auth", "signup"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
