import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"

export async function POST() {
  try {
    logger.info("Sign out request", { tags: ["auth", "signout"] })

    const response = NextResponse.json({ message: "Logged out successfully" })

    // Clear all auth-related cookies
    const cookiesToClear = [
      "token",
      "next-auth.session-token",
      "next-auth.callback-url",
      "next-auth.csrf-token",
      "user-session"
    ]

    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0, // Expire immediately
        path: "/",
      })
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
