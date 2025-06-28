import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

// GET /api/user-packages/packages - Get user's packages for filtering
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's packages (active and completed)
    const packages = await prisma.userPackage.findMany({
      where: {
        userId: session.user.id,
        status: {
          in: ['active', 'completed', 'expired']
        }
      },
      include: {
        packageOffer: {
          select: {
            name: true,
            packageType: true,
            colorGradientFrom: true,
            colorGradientTo: true,
            iconName: true
          }
        }
      },
      orderBy: {
        purchasedAt: 'desc'
      }
    })

    // Transform the data
    const transformedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.packageOffer.name,
      type: pkg.packageOffer.packageType,
      status: pkg.status,
      tipsRemaining: pkg.tipsRemaining,
      totalTips: pkg.totalTips,
      purchasedAt: pkg.purchasedAt.toISOString(),
      expiresAt: pkg.expiresAt.toISOString(),
      colorGradientFrom: pkg.packageOffer.colorGradientFrom,
      colorGradientTo: pkg.packageOffer.colorGradientTo,
      iconName: pkg.packageOffer.iconName
    }))

    return NextResponse.json(transformedPackages)

  } catch (error) {
    console.error("Error fetching user packages:", error)
    return NextResponse.json({ error: "Failed to fetch user packages" }, { status: 500 })
  }
} 