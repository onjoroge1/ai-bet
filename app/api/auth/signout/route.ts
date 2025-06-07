import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    logger.info("Sign out request", { tags: ["auth", "signout"] })

    const response = NextResponse.json({ success: true })

    // Clear session cookie
    response.cookies.set("user-session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // Expire immediately
    })

    logger.info("Sign out successful", { tags: ["auth", "signout"] })

    return response
  } catch (error) {
    logger.error("Sign out error", {
      tags: ["auth", "signout"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
