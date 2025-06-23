import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { generateToken } from "@/lib/auth"

const signupSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  countryId: z.string().min(1, "Country is required"),
  marketingConsent: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = signupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 })
    }

    const { name, email, password, countryId } = validation.data

    logger.info("Sign up attempt", {
      tags: ["auth", "signup"],
      data: { email, countryId },
    })

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      logger.warn("Sign up failed - email already exists", {
        tags: ["auth", "signup"],
        data: { email },
      })
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const country = await prisma.country.findFirst({
      where: { id: countryId, isActive: true },
    })

    if (!country) {
      return NextResponse.json({ error: "Invalid country selected" }, { status: 400 })
    }

    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email: email,
        password: hashedPassword,
        countryId: countryId,
        role: "user",
        subscriptionPlan: "free",
        isActive: true,
      },
      include: {
        country: true,
      },
    })

    // Note: Welcome notification and wallet creation are now handled by triggers/separate processes
    // to keep the signup flow fast and simple.

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

    logger.info("Sign up successful", {
      tags: ["auth", "signup"],
      data: { email, userId: user.id, countryId },
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
    })

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    })

    return response
  } catch (error) {
    logger.error("Sign up error", {
      tags: ["auth", "signup"],
      error: error instanceof Error ? error : undefined,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
