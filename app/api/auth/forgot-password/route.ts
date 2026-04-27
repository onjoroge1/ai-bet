import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"
import crypto from "crypto"
import { EmailService } from "@/lib/email-service"
import { validateApiConfiguration } from "@/lib/config-validation"
import { checkRateLimit } from "@/lib/security"

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
})

// Rate-limit knobs.
//   Per-IP: 5 attempts / 15 min — caps mass enumeration scans
//   Per-email: 3 attempts / 60 min — caps targeted user harassment
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
    // Validate configuration before processing
    validateApiConfiguration()

    // ── Rate limiting (per-IP, applied before any DB lookup) ──
    const ip = getClientIp(request)
    const ipLimit = checkRateLimit(`forgot-password:ip:${ip}`, IP_RATE_MAX, IP_RATE_WINDOW_MS)
    if (!ipLimit.allowed) {
      logger.warn('Password reset IP rate limit exceeded', {
        tags: ['auth', 'password-reset', 'rate-limit'],
        data: { ip, resetTime: ipLimit.resetTime },
      })
      return NextResponse.json(
        { error: 'Too many password reset attempts from your network. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((ipLimit.resetTime - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const validation = forgotPasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        error: "Invalid email format"
      }, { status: 400 })
    }

    const { email } = validation.data

    // ── Rate limiting (per-email, applied after format validation) ──
    const emailLimit = checkRateLimit(`forgot-password:email:${email.toLowerCase()}`, EMAIL_RATE_MAX, EMAIL_RATE_WINDOW_MS)
    if (!emailLimit.allowed) {
      logger.warn('Password reset email rate limit exceeded', {
        tags: ['auth', 'password-reset', 'rate-limit'],
        data: { email, ip, resetTime: emailLimit.resetTime },
      })
      // Return generic 200 so attackers can't use 429 to enumerate which emails are being targeted
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent."
      })
    }

    logger.info("Password reset request", {
      tags: ["auth", "password-reset"],
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
    // Use utility function to get appUrl safely (will throw error in production if not set)
    try {
      const { getAppUrl } = await import('@/lib/email-urls')
      const appUrl = getAppUrl()
      
      await EmailService.sendPasswordResetEmail({
        to: user.email,
        userName: user.fullName || user.email,
        resetToken,
        appUrl: appUrl
      })
      
      logger.info('Password reset email sent successfully', {
        tags: ["auth", "password-reset", "email"],
        data: { email: user.email, userId: user.id },
      })
    } catch (emailError) {
      // CRITICAL: user expects an email but we couldn't send it. We still
      // return success to prevent enumeration, but ops needs to see this
      // loudly so they can intervene before the user's reset window expires.
      logger.error('[CRITICAL] Failed to send password reset email — user is locked out', {
        tags: ["auth", "password-reset", "email", "critical", "alert"],
        error: emailError instanceof Error ? emailError : undefined,
        data: {
          severity: 'critical',
          email: user.email,
          userId: user.id,
          tokenIssued: true,
          actionRequired: 'Check Resend dashboard / regenerate token / reach out to user',
        },
      })
      // Don't fail the request — user gets generic success message either way.
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