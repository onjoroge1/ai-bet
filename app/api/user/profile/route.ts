import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"

// GET /api/user/profile
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.warn('Profile access attempt without session', {
        tags: ['api', 'user', 'profile'],
        data: { hasSession: !!session, hasUser: !!session?.user }
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!session.user.id) {
      logger.error('Session user has no ID', {
        tags: ['api', 'user', 'profile'],
        data: { sessionUser: session.user }
      })
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    logger.debug('Fetching user profile', {
      tags: ['api', 'user', 'profile'],
      data: { userId: session.user.id }
    })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        countryId: true,
        isActive: true,
        lastLoginAt: true,
        phone: true,
        subscriptionExpiresAt: true,
        subscriptionPlan: true,
        totalWinnings: true,
        winStreak: true,
        country: {
          select: {
            id: true,
            code: true,
            name: true,
            flagEmoji: true,
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })

    if (!user) {
      logger.error('User not found in database', {
        tags: ['api', 'user', 'profile'],
        data: { 
          sessionUserId: session.user.id,
          sessionEmail: session.user.email,
          sessionName: session.user.name
        }
      })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    logger.debug('User profile fetched successfully', {
      tags: ['api', 'user', 'profile'],
      data: { userId: user.id, email: user.email }
    })

    return NextResponse.json(user)
  } catch (error) {
    logger.error('Error fetching user profile', {
      tags: ['api', 'user', 'profile'],
      error: error instanceof Error ? error : undefined,
      data: { sessionUser: session?.user }
    })
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 