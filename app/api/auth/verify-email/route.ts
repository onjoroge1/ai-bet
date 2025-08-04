import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"
import { z } from "zod"

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = verifyEmailSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ 
        error: "Invalid verification token" 
      }, { status: 400 })
    }

    const { token } = validation.data

    logger.info("Email verification attempt", {
      tags: ["auth", "email-verification"],
      data: { token: token.substring(0, 8) + "..." },
    })

    // Find user by verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        emailVerified: true,
      }
    })

    if (!user) {
      logger.warn("Invalid or expired email verification token", {
        tags: ["auth", "email-verification"],
        data: { token: token.substring(0, 8) + "..." },
      })
      return NextResponse.json({ 
        error: "Invalid or expired verification token" 
      }, { status: 400 })
    }

    if (user.emailVerified) {
      logger.info("Email already verified", {
        tags: ["auth", "email-verification"],
        data: { email: user.email, userId: user.id },
      })
      return NextResponse.json({ 
        success: true, 
        message: "Email is already verified" 
      })
    }

    // Mark email as verified and clear verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }
    })

    logger.info("Email verification successful", {
      tags: ["auth", "email-verification"],
      data: { email: user.email, userId: user.id },
    })

    return NextResponse.json({ 
      success: true, 
      message: "Email verified successfully! You can now access all features." 
    })

  } catch (error) {
    logger.error("Email verification error", {
      tags: ["auth", "email-verification"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
} 