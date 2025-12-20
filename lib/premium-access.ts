import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

/**
 * Check if user has active premium subscription
 * Premium = monthly recurring subscription
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

    // Check if user has active premium subscription
    // Premium plans: "premium", "monthly", "vip_monthly", etc.
    const isPremiumPlan = user.subscriptionPlan && 
      (user.subscriptionPlan.toLowerCase().includes('premium') ||
       user.subscriptionPlan.toLowerCase().includes('monthly') ||
       user.subscriptionPlan.toLowerCase().includes('vip'))

    // Check if subscription hasn't expired
    const isNotExpired = !!(user.subscriptionExpiresAt && 
      new Date(user.subscriptionExpiresAt) > new Date())

    return !!(isPremiumPlan && isNotExpired)
  } catch (error) {
    console.error('Error checking premium access:', error)
    return false
  }
}

/**
 * Get premium subscription status for client-side use
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

    const isPremiumPlan = user.subscriptionPlan && 
      (user.subscriptionPlan.toLowerCase().includes('premium') ||
       user.subscriptionPlan.toLowerCase().includes('monthly') ||
       user.subscriptionPlan.toLowerCase().includes('vip'))

    const expiresAt = user.subscriptionExpiresAt
    const isExpired = !expiresAt || new Date(expiresAt) <= new Date()

    return {
      hasAccess: !!(isPremiumPlan && !isExpired),
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

