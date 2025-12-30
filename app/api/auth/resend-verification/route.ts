import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"
import crypto from "crypto"
import { EmailService } from "@/lib/email-service"

const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email format"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = resendVerificationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ 
        error: "Invalid email format" 
      }, { status: 400 })
    }

    const { email } = validation.data

    logger.info("Email verification resend request", {
      tags: ["auth", "email-verification"],
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
        emailVerificationToken: true,
        emailVerificationExpires: true,
      }
    })

    if (!user) {
      logger.warn("Email verification resend requested for non-existent email", {
        tags: ["auth", "email-verification"],
        data: { email },
      })
      return NextResponse.json({ 
        success: true, 
        message: "If an account with that email exists, a verification email has been sent." 
      })
    }

    if (user.emailVerified) {
      logger.info("Email verification resend requested for already verified email", {
        tags: ["auth", "email-verification"],
        data: { email },
      })
      return NextResponse.json({ 
        success: true, 
        message: "Email is already verified." 
      })
    }

    // Check if there's an existing valid token
    if (user.emailVerificationToken && user.emailVerificationExpires && user.emailVerificationExpires > new Date()) {
      logger.info("Valid verification token already exists, resending email", {
        tags: ["auth", "email-verification"],
        data: { email: user.email, userId: user.id },
      })
    } else {
      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex')
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      // Save verification token to database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        }
      })

      logger.info("New email verification token generated", {
        tags: ["auth", "email-verification"],
        data: { email: user.email, userId: user.id },
      })
    }

    // Send verification email
    try {
      const { getAppUrl } = await import('@/lib/email-urls')
      const appUrl = getAppUrl()
      
      await EmailService.sendEmailVerification({
        to: user.email,
        userName: user.fullName || user.email,
        verificationToken: user.emailVerificationToken!,
        appUrl: appUrl
      })
      
      logger.info('Email verification email sent successfully', {
        tags: ["auth", "email-verification", "email"],
        data: { email: user.email, userId: user.id },
      })
    } catch (emailError) {
      logger.error('Failed to send email verification email', {
        tags: ["auth", "email-verification", "email"],
        error: emailError instanceof Error ? emailError : undefined,
        data: { email: user.email, userId: user.id },
      })
      
      // Don't fail the request if email fails, but log it
    }

    logger.info("Email verification resend processed", {
      tags: ["auth", "email-verification"],
      data: { email, userId: user.id },
    })

    return NextResponse.json({ 
      success: true, 
      message: "If an account with that email exists, a verification email has been sent." 
    })

  } catch (error) {
    logger.error("Email verification resend error", {
      tags: ["auth", "email-verification"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
} 