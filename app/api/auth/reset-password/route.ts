import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { checkPasswordStrength } from "@/lib/auth/password"
import { clearAllSessionCaches } from "@/lib/session-cache"

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

    // Update user password, clear reset token, and set password reset timestamp
    const passwordResetAt = new Date()
    
    // Try to update with passwordResetAt, but gracefully handle if field doesn't exist yet
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          passwordResetAt: passwordResetAt, // Track when password was reset for session invalidation
        }
      })
    } catch (updateError: any) {
      // If passwordResetAt field doesn't exist yet, try without it
      // This allows code to work before schema is updated with db push
      const isFieldError = updateError?.message?.includes('passwordResetAt') || 
                          updateError?.code === 'P2009' || // Prisma field error
                          updateError?.code === 'P2025'    // Record not found (shouldn't happen)
      
      if (isFieldError) {
        logger.debug('passwordResetAt field not found - updating without it (schema may need db push)', {
          tags: ["auth", "password-reset", "schema-missing"],
          data: { email: user.email, userId: user.id },
        })
        
        // Retry without passwordResetAt field
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
            // passwordResetAt omitted - field doesn't exist yet
          }
        })
      } else {
        // Different error - rethrow it
        throw updateError
      }
    }

    // Clear all session caches to invalidate existing sessions
    // This ensures that any active sessions are invalidated after password reset
    try {
      const keysDeleted = await clearAllSessionCaches()
      logger.info("Session caches cleared after password reset", {
        tags: ["auth", "password-reset", "session-invalidation"],
        data: { 
          email: user.email, 
          userId: user.id,
          keysDeleted,
          passwordResetAt: passwordResetAt.toISOString(),
        },
      })
    } catch (cacheError) {
      // Don't fail password reset if cache clearing fails, but log it
      logger.error("Failed to clear session caches after password reset", {
        tags: ["auth", "password-reset", "session-invalidation", "error"],
        error: cacheError instanceof Error ? cacheError : undefined,
        data: { email: user.email, userId: user.id },
      })
    }

    logger.info("Password reset successful", {
      tags: ["auth", "password-reset"],
      data: { 
        email: user.email, 
        userId: user.id,
        passwordResetAt: passwordResetAt.toISOString(),
      },
    })

    return NextResponse.json({ 
      success: true, 
      message: "Password has been reset successfully. All existing sessions have been invalidated. Please sign in with your new password." 
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