import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { verifyToken, getTokenPayload } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const isValid = await verifyToken(token)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const payload = await getTokenPayload(token)
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true },
      include: {
        country: true,
      },
    })

    if (!user) {
      logger.warn("Session validation failed - user not found", {
        tags: ["auth", "session"],
        data: { userId: payload.userId },
      })

      const response = NextResponse.json({ error: "Invalid session" }, { status: 401 })

      response.cookies.set("auth_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: -1,
      })

      return response
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        country: user.country,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        totalWinnings: user.totalWinnings,
        winStreak: user.winStreak,
      },
    })
  } catch (error) {
    logger.error("Session validation error", {
      tags: ["auth", "session"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
