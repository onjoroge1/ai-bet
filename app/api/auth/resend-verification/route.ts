import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"
import crypto from "crypto"
import { EmailService } from "@/lib/email-service"
import { checkRateLimit } from "@/lib/security"

const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email format"),
})

// Rate-limit knobs (mirror forgot-password, slightly tighter on per-email
// since legitimate use is "I didn't get the email" → 1-2 retries max)
const IP_RATE_MAX = 5
const IP_RATE_WINDOW_MS = 15 * 60 * 1000
const EMAIL_RATE_MAX = 3
const EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting (per-IP, applied before any DB lookup) ──
    const ip = getClientIp(request)
    const ipLimit = checkRateLimit(`resend-verification:ip:${ip}`, IP_RATE_MAX, IP_RATE_WINDOW_MS)
    if (!ipLimit.allowed) {
      logger.warn('Resend verification IP rate limit exceeded', {
        tags: ['auth', 'email-verification', 'rate-limit'],
        data: { ip, resetTime: ipLimit.resetTime },
      })
      return NextResponse.json(
        { error: 'Too many verification email requests from your network. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((ipLimit.resetTime - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const validation = resendVerificationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        error: "Invalid email format"
      }, { status: 400 })
    }

    const { email } = validation.data

    // ── Rate limiting (per-email, applied after format validation) ──
    const emailLimit = checkRateLimit(`resend-verification:email:${email.toLowerCase()}`, EMAIL_RATE_MAX, EMAIL_RATE_WINDOW_MS)
    if (!emailLimit.allowed) {
      logger.warn('Resend verification email rate limit exceeded', {
        tags: ['auth', 'email-verification', 'rate-limit'],
        data: { email, ip, resetTime: emailLimit.resetTime },
      })
      // Generic 200 to avoid leaking via 429
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, a verification email has been sent."
      })
    }

    logger.info("Email verification resend request", {
      tags: ["auth", "email-verification"],
      data: { email, ip },
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
      // CRITICAL: ops needs visibility — user is stuck unable to verify.
      logger.error('[CRITICAL] Failed to send email verification — user cannot complete signup', {
        tags: ["auth", "email-verification", "email", "critical", "alert"],
        error: emailError instanceof Error ? emailError : undefined,
        data: {
          severity: 'critical',
          email: user.email,
          userId: user.id,
          tokenIssued: true,
          actionRequired: 'Check Resend dashboard / manually verify user / reach out',
        },
      })
      // Don't fail the request — user gets generic success message either way.
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