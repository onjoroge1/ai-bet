import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { logger } from "@/lib/logger"

/**
 * POST /api/user/change-password
 * Verifies the current password then hashes and stores the new password.
 * Accepts: { currentPassword: string; newPassword: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body as {
      currentPassword?: string
      newPassword?: string
    }

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Fetch the stored hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    })

    if (!user?.password) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      )
    }

    // Hash new password and update
    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, passwordResetAt: new Date() },
    })

    logger.info("User password changed", {
      tags: ["api", "user", "change-password"],
      data: { userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error changing password", {
      tags: ["api", "user", "change-password"],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

