import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * GET /api/user/settings
 * Returns the authenticated user's notification and privacy preferences.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailNotifications: true,
        pushNotifications: true,
        inAppNotifications: true,
        notificationSettings: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Parse notificationSettings JSON which stores both notification
    // granular preferences and privacy settings
    const stored = (user.notificationSettings ?? {}) as Record<string, unknown>

    return NextResponse.json({
      notifications: {
        emailNewPredictions: stored.emailNewPredictions ?? user.emailNotifications,
        emailMatchResults: stored.emailMatchResults ?? user.emailNotifications,
        emailPaymentConfirmations: stored.emailPaymentConfirmations ?? true,
        emailPromotional: stored.emailPromotional ?? false,
        emailNewsletter: stored.emailNewsletter ?? user.emailNotifications,
        pushNewPredictions: stored.pushNewPredictions ?? user.pushNotifications,
        pushMatchResults: stored.pushMatchResults ?? user.pushNotifications,
        pushPaymentConfirmations: stored.pushPaymentConfirmations ?? true,
        pushPromotional: stored.pushPromotional ?? false,
        inAppSound: stored.inAppSound ?? user.inAppNotifications,
        inAppBadges: stored.inAppBadges ?? user.inAppNotifications,
        inAppFrequency: stored.inAppFrequency ?? "immediate",
      },
      privacy: {
        profileVisibility: stored.profileVisibility ?? "public",
        sharePredictionHistory: stored.sharePredictionHistory ?? false,
        shareAnalytics: stored.shareAnalytics ?? true,
        allowDataAnalytics: stored.allowDataAnalytics ?? true,
        allowMarketingData: stored.allowMarketingData ?? false,
        allowThirdPartyData: stored.allowThirdPartyData ?? false,
        twoFactorAuth: stored.twoFactorAuth ?? false,
        sessionTimeout: stored.sessionTimeout ?? 30,
        loginNotifications: stored.loginNotifications ?? true,
        autoExportData: stored.autoExportData ?? false,
        exportFrequency: stored.exportFrequency ?? "monthly",
      },
    })
  } catch (error) {
    logger.error("Error fetching user settings", {
      tags: ["api", "user", "settings"],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

/**
 * PATCH /api/user/settings
 * Updates notification and/or privacy preferences.
 *
 * Body: { notifications?: Record<string, unknown>, privacy?: Record<string, unknown> }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { notifications, privacy } = body as {
      notifications?: Record<string, unknown>
      privacy?: Record<string, unknown>
    }

    if (!notifications && !privacy) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 })
    }

    // Read existing stored settings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationSettings: true },
    })

    const existing = ((user?.notificationSettings as Record<string, unknown>) ?? {})

    // Merge new settings into existing
    const merged: Record<string, unknown> = { ...existing }

    if (notifications) {
      for (const [k, v] of Object.entries(notifications)) {
        merged[k] = v
      }
    }

    if (privacy) {
      for (const [k, v] of Object.entries(privacy)) {
        merged[k] = v
      }
    }

    // Derive top-level boolean flags from granular notification settings
    const emailOn =
      (merged.emailNewPredictions as boolean) ??
      (merged.emailMatchResults as boolean) ??
      true
    const pushOn =
      (merged.pushNewPredictions as boolean) ??
      (merged.pushMatchResults as boolean) ??
      true
    const inAppOn =
      (merged.inAppSound as boolean) ??
      (merged.inAppBadges as boolean) ??
      true

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notificationSettings: merged,
        emailNotifications: emailOn,
        pushNotifications: pushOn,
        inAppNotifications: inAppOn,
      },
    })

    logger.info("User settings updated", {
      tags: ["api", "user", "settings", "patch"],
      data: { userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Error updating user settings", {
      tags: ["api", "user", "settings", "patch"],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}

/**
 * POST /api/user/settings/export
 * Exports all user data as JSON.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")

    if (action === "export") {
      const userData = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          createdAt: true,
          country: { select: { name: true, code: true } },
          savedBets: { select: { id: true, name: true, betType: true, status: true, createdAt: true } },
          purchases: {
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true,
              quickPurchase: { select: { name: true } },
            },
          },
        },
      })

      if (!userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      return new NextResponse(JSON.stringify(userData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="snapbet-data-${session.user.id}.json"`,
        },
      })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    logger.error("Error exporting user data", {
      tags: ["api", "user", "settings", "export"],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}

