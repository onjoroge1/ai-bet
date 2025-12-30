import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { generateToken } from "@/lib/auth"
import { getCountryByCode, isValidCountryCode } from "@/lib/countries"
import { EmailService } from "@/lib/email-service"
import crypto from "crypto"

const signupSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  countryCode: z.string().min(2, "Country code is required"),
  marketingConsent: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const validation = signupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 })
    }

    const { name, email, password, countryCode } = validation.data

    logger.info("Sign up attempt", {
      tags: ["auth", "signup"],
      data: { email, countryCode },
    })

    // Validate country code
    if (!isValidCountryCode(countryCode)) {
      return NextResponse.json({ error: "Invalid country code" }, { status: 400 })
    }

    // Get country data from our comprehensive system
    const countryData = getCountryByCode(countryCode)
    if (!countryData || !countryData.isSupported) {
      return NextResponse.json({ error: "Country not supported" }, { status: 400 })
    }

    // Use Promise.all to run queries in parallel for better performance
    const [existingUser, dbCountry] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: { id: true } // Only select what we need
      }),
      prisma.country.findFirst({
        where: { code: countryCode, isActive: true },
        select: { id: true, name: true, currencyCode: true, currencySymbol: true }
      })
    ])

    if (existingUser) {
      logger.warn("Sign up failed - email already exists", {
        tags: ["auth", "signup"],
        data: { email },
      })
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    // If country doesn't exist in database, create it
    let countryId: string
    if (!dbCountry) {
      const newCountry = await prisma.country.create({
        data: {
          code: countryData.code,
          name: countryData.name,
          flagEmoji: countryData.flagEmoji,
          currencyCode: countryData.currencyCode,
          currencySymbol: countryData.currencySymbol,
          isActive: true,
          brandName: `${countryData.name}'s Premier AI Betting Platform`,
          tagline: 'AI-Powered Sports Predictions',
          marketContext: `${countryData.name}'s sports betting market`
        }
      })
      countryId = newCountry.id
    } else {
      countryId = dbCountry.id
    }

    // Hash password with reasonable salt rounds
    const saltRounds = 10 // Reduced from 12 for better performance
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email: email,
        password: hashedPassword,
        countryId: countryId,
        role: "user",
        subscriptionPlan: "free",
        isActive: true,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        countryId: true, // Include countryId in the select
        country: {
          select: {
            id: true,
            name: true,
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })

    // Note: Welcome notification and wallet creation are now handled by triggers/separate processes
    // to keep the signup flow fast and simple.

    // Send welcome email to new user
    try {
      await EmailService.sendWelcomeEmail({
        to: user.email,
        userName: user.fullName || user.email,
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@snapbet.com'
      })
      
      logger.info('Welcome email sent successfully', {
        tags: ["auth", "signup", "email"],
        data: { email: user.email, userId: user.id },
      })
    } catch (emailError) {
      // Don't fail signup if email fails, just log it
      logger.error('Failed to send welcome email', {
        tags: ["auth", "signup", "email"],
        error: emailError instanceof Error ? emailError : undefined,
        data: { email: user.email, userId: user.id },
      })
    }

    // Send email verification email
    try {
      const { getAppUrl } = await import('@/lib/email-urls')
      const appUrl = getAppUrl()
      
      await EmailService.sendEmailVerification({
        to: user.email,
        userName: user.fullName || user.email,
        verificationToken,
        appUrl: appUrl
      })
      
      logger.info('Email verification email sent successfully', {
        tags: ["auth", "signup", "email-verification"],
        data: { email: user.email, userId: user.id },
      })
    } catch (emailError) {
      // Don't fail signup if email fails, just log it
      logger.error('Failed to send email verification email', {
        tags: ["auth", "signup", "email-verification"],
        error: emailError instanceof Error ? emailError : undefined,
        data: { email: user.email, userId: user.id },
      })
    }

    if (!user.countryId) {
        logger.error("User created without a countryId", { data: { userId: user.id } });
        return NextResponse.json({ error: "Internal server error during user creation." }, { status: 500 });
    }

    const token = await generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        countryId: user.countryId,
    });

    const responseTime = Date.now() - startTime
    logger.info("Sign up successful", {
      tags: ["auth", "signup"],
      data: { email, userId: user.id, countryId, responseTime },
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        country: user.country,
      },
      message: "Account created successfully! Please check your email to verify your account.",
    })

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    })

    return response
  } catch (error) {
    const responseTime = Date.now() - startTime
    logger.error("Sign up error", {
      tags: ["auth", "signup"],
      error: error instanceof Error ? error : undefined,
      data: { responseTime }, // Move responseTime to data object
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
