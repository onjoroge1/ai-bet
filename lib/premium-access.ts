import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

/**
 * Check if user has active package (Weekend, Weekly, Monthly, VIP)
 * Packages have expiresAt dates (3 days for weekend, 7 days for weekly)
 * Monthly and VIP are recurring subscriptions
 */
async function hasActivePackage(userId: string): Promise<boolean> {
  try {
    const now = new Date()
    
    // Check for active UserPackage records
    const activePackage = await prisma.userPackage.findFirst({
      where: {
        userId,
        status: 'active',
        expiresAt: {
          gt: now // expiresAt must be in the future
        }
      },
      select: {
        id: true,
        expiresAt: true,
        packageOffer: {
          select: {
            packageType: true
          }
        }
      }
    })

    return !!activePackage
  } catch (error) {
    console.error('Error checking active package:', error)
    return false
  }
}

/**
 * Check if user has active premium subscription
 * Premium = monthly recurring subscription OR active package (Weekend/Weekly/Monthly/VIP)
 */
export async function hasPremiumAccess(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return false
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        role: true,
      },
    })

    if (!user) {
      return false
    }

    // Admins always have access
    if (user.role === 'admin') {
      return true
    }

    // Check if user has active package (Weekend, Weekly, Monthly, VIP)
    const hasPackage = await hasActivePackage(session.user.id)
    if (hasPackage) {
      return true
    }

    // Check if user has active premium subscription (recurring)
    // Premium plans: "premium", "monthly", "vip_monthly", etc.
    const isPremiumPlan = user.subscriptionPlan && 
      (user.subscriptionPlan.toLowerCase().includes('premium') ||
       user.subscriptionPlan.toLowerCase().includes('monthly') ||
       user.subscriptionPlan.toLowerCase().includes('vip'))

    // Check if subscription hasn't expired
    const isNotExpired = !!(user.subscriptionExpiresAt && 
      new Date(user.subscriptionExpiresAt) > new Date())

    // Check subscriptionStatus — block only explicitly cancelled/unpaid states
    const blockedStatuses = ['canceled', 'cancelled', 'unpaid', 'incomplete_expired']
    const isExplicitlyBlocked = !!user.subscriptionStatus &&
      blockedStatuses.includes(user.subscriptionStatus.toLowerCase())

    return !!(isPremiumPlan && isNotExpired && !isExplicitlyBlocked)
  } catch (error) {
    console.error('Error checking premium access:', error)
    return false
  }
}

/**
 * Get premium subscription status for client-side use
 * Includes both subscription and package access
 */
export async function getPremiumStatus(): Promise<{
  hasAccess: boolean
  plan: string | null
  expiresAt: Date | null
  isExpired: boolean
}> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return {
        hasAccess: false,
        plan: null,
        expiresAt: null,
        isExpired: true,
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        role: true,
      },
    })

    if (!user) {
      return {
        hasAccess: false,
        plan: null,
        expiresAt: null,
        isExpired: true,
      }
    }

    // Admins always have access
    if (user.role === 'admin') {
      return {
        hasAccess: true,
        plan: user.subscriptionPlan || 'admin',
        expiresAt: user.subscriptionExpiresAt,
        isExpired: false,
      }
    }

    // Check for active package first
    const now = new Date()
    const activePackage = await prisma.userPackage.findFirst({
      where: {
        userId: session.user.id,
        status: 'active',
        expiresAt: {
          gt: now
        }
      },
      include: {
        packageOffer: {
          select: {
            name: true,
            packageType: true
          }
        }
      },
      orderBy: {
        expiresAt: 'desc' // Get the most recent package
      }
    })

    if (activePackage) {
      return {
        hasAccess: true,
        plan: activePackage.packageOffer?.name || 'Package',
        expiresAt: activePackage.expiresAt,
        isExpired: false,
      }
    }

    // Fall back to subscription check
    const isPremiumPlan = user.subscriptionPlan && 
      (user.subscriptionPlan.toLowerCase().includes('premium') ||
       user.subscriptionPlan.toLowerCase().includes('monthly') ||
       user.subscriptionPlan.toLowerCase().includes('vip'))

    const expiresAt = user.subscriptionExpiresAt
    const isExpired = !expiresAt || new Date(expiresAt) <= new Date()

    // Block only explicitly cancelled/unpaid statuses
    const blockedStatuses = ['canceled', 'cancelled', 'unpaid', 'incomplete_expired']
    const isExplicitlyBlocked = !!user.subscriptionStatus &&
      blockedStatuses.includes(user.subscriptionStatus.toLowerCase())

    return {
      hasAccess: !!(isPremiumPlan && !isExpired && !isExplicitlyBlocked),
      plan: user.subscriptionPlan,
      expiresAt,
      isExpired,
    }
  } catch (error) {
    console.error('Error getting premium status:', error)
    return {
      hasAccess: false,
      plan: null,
      expiresAt: null,
      isExpired: true,
    }
  }
}

/**
 * Check if user has any active package (for match viewing access)
 * Returns true if user has any active UserPackage OR premium subscription
 */
export async function hasPackageAccess(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return false
    }

    // Check for active package
    const hasPackage = await hasActivePackage(session.user.id)
    if (hasPackage) {
      return true
    }

    // Also check premium subscription
    return await hasPremiumAccess()
  } catch (error) {
    console.error('Error checking package access:', error)
    return false
  }
}

