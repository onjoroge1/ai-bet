import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { checkPasswordStrength } from "@/lib/auth/password"

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  confirmPassword: z.string().min(1, "Password confirmation is required"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = resetPasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ 
        error: validation.error.flatten().fieldErrors 
      }, { status: 400 })
    }

    const { token, password, confirmPassword } = validation.data

    // Validate passwords match
    if (password !== confirmPassword) {
      return NextResponse.json({ 
        error: "Passwords do not match" 
      }, { status: 400 })
    }

    // Validate password strength
    const strength = checkPasswordStrength(password)
    if (!strength.isValid) {
      return NextResponse.json({ 
        error: "Password does not meet requirements" 
      }, { status: 400 })
    }

    logger.info("Password reset attempt", {
      tags: ["auth", "password-reset"],
      data: { token: token.substring(0, 8) + "..." },
    })

    // Find user by reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      }
    })

    if (!user) {
      logger.warn("Invalid or expired password reset token", {
        tags: ["auth", "password-reset"],
        data: { token: token.substring(0, 8) + "..." },
      })
      return NextResponse.json({ 
        error: "Invalid or expired reset token" 
      }, { status: 400 })
    }

    // Hash new password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      }
    })

    logger.info("Password reset successful", {
      tags: ["auth", "password-reset"],
      data: { email: user.email, userId: user.id },
    })

    return NextResponse.json({ 
      success: true, 
      message: "Password has been reset successfully. You can now sign in with your new password." 
    })

  } catch (error) {
    logger.error("Password reset error", {
      tags: ["auth", "password-reset"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
} 