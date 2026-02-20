import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * GET /api/user/profile
 * Returns the authenticated user's profile data.
 */
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
    })
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

/**
 * PATCH /api/user/profile
 * Updates the authenticated user's name and/or phone number.
 * Accepts: { fullName?: string; phone?: string }
 */
export async function PATCH(req: NextRequest) {
  let session
  try {
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { fullName, phone } = body as { fullName?: string; phone?: string }

    // Build update payload — only set fields that were provided
    const updateData: { fullName?: string; phone?: string } = {}
    if (fullName !== undefined) updateData.fullName = fullName.trim()
    if (phone !== undefined) updateData.phone = phone.trim() || null as unknown as string

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields provided" }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
      },
    })

    logger.info('User profile updated', {
      tags: ['api', 'user', 'profile', 'patch'],
      data: { userId: updated.id },
    })

    return NextResponse.json(updated)
  } catch (error) {
    logger.error('Error updating user profile', {
      tags: ['api', 'user', 'profile', 'patch'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}