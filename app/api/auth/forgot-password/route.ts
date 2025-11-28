import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"
import crypto from "crypto"
import { EmailService } from "@/lib/email-service"

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = forgotPasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ 
        error: "Invalid email format" 
      }, { status: 400 })
    }

    const { email } = validation.data

    logger.info("Password reset request", {
      tags: ["auth", "password-reset"],
      data: { email },
    })

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        emailVerified: true,
      }
    })

    // Always return success to prevent email enumeration
    if (!user) {
      logger.warn("Password reset requested for non-existent email", {
        tags: ["auth", "password-reset"],
        data: { email },
      })
      return NextResponse.json({ 
        success: true, 
        message: "If an account with that email exists, a password reset link has been sent." 
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Save reset token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      }
    })

    // Send password reset email
    // Use NEXT_PUBLIC_APP_URL from environment, fallback to localhost only in development
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined)
    
    if (!appUrl) {
      logger.error('NEXT_PUBLIC_APP_URL is not set in production environment', {
        tags: ["auth", "password-reset", "email", "config-error"],
        data: { email: user.email, userId: user.id },
      })
      // Still try to send email, but with a warning
    }
    
    try {
      await EmailService.sendPasswordResetEmail({
        to: user.email,
        userName: user.fullName || user.email,
        resetToken,
        appUrl: appUrl || 'http://localhost:3000' // Fallback only if not set
      })
      
      logger.info('Password reset email sent successfully', {
        tags: ["auth", "password-reset", "email"],
        data: { email: user.email, userId: user.id },
      })
    } catch (emailError) {
      logger.error('Failed to send password reset email', {
        tags: ["auth", "password-reset", "email"],
        error: emailError instanceof Error ? emailError : undefined,
        data: { email: user.email, userId: user.id },
      })
      
      // Don't fail the request if email fails, but log it
    }

    logger.info("Password reset request processed", {
      tags: ["auth", "password-reset"],
      data: { email, userId: user.id },
    })

    return NextResponse.json({ 
      success: true, 
      message: "If an account with that email exists, a password reset link has been sent." 
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