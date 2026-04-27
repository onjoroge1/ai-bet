import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

/**
 * Subscription statuses that block premium access.
 *
 * - `canceled`/`cancelled`: user terminated subscription (period-end already past)
 * - `unpaid`: Stripe gave up after retries
 * - `incomplete_expired`: 3DS / SCA challenge expired without success
 * - `past_due`: invoice payment failed; Stripe is retrying. We block access
 *   immediately to prevent free premium during the retry window. Users see a
 *   warning in /dashboard/settings prompting them to update their payment
 *   method, and access auto-restores when payment succeeds (`invoice.paid`
 *   webhook flips status back to `active`).
 * - `disputed`: chargeback in flight; we don't honor access while a dispute
 *   is open.
 */
export const BLOCKED_SUBSCRIPTION_STATUSES = [
  'canceled', 'cancelled', 'unpaid', 'incomplete_expired', 'past_due', 'disputed',
] as const

function isBlockedStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return (BLOCKED_SUBSCRIPTION_STATUSES as readonly string[]).includes(status.toLowerCase())
}

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

    // Check subscriptionStatus — block cancelled, unpaid, past_due, disputed states
    const isExplicitlyBlocked = isBlockedStatus(user.subscriptionStatus)

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

    // Block cancelled, unpaid, past_due, disputed statuses
    const isExplicitlyBlocked = isBlockedStatus(user.subscriptionStatus)

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

// ─── Tier-Based Access Control ──────────────────────────────────────────────

/**
 * Access tiers mapped to package types.
 *
 *   Starter → tier 1: SnapBet Picks (soccer only), basic match analysis
 *   Pro     → tier 2: All sports, parlays, player predictions, full analysis
 *   VIP     → tier 3: Pro + CLV Tracker, AI Parlay Builder, analytics, priority support
 *   Admin   → tier 99: everything
 */
export type AccessTier = 'free' | 'starter' | 'pro' | 'vip' | 'admin'

const TIER_LEVEL: Record<AccessTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  vip: 3,
  admin: 99,
}

/** Map packageType / subscriptionPlan strings to a tier */
function resolveAccessTier(planOrType: string | null | undefined): AccessTier {
  if (!planOrType) return 'free'
  const lower = planOrType.toLowerCase()

  // VIP tier
  if (lower === 'vip' || lower.includes('premium_intelligence') || lower.includes('vip_monthly')) return 'vip'

  // Pro tier
  if (lower === 'pro' || lower === 'pro_monthly' || lower === 'monthly_sub' || lower === 'weekly_pass'
    || lower.includes('premium') || lower.includes('monthly')) return 'pro'

  // Starter tier
  if (lower === 'starter' || lower === 'weekend_pass') return 'starter'

  return 'free'
}

/**
 * Get the user's current access tier.
 * Checks active packages first, then subscription, then defaults to free.
 */
export async function getUserTier(): Promise<{ tier: AccessTier; plan: string | null; expiresAt: Date | null }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { tier: 'free', plan: null, expiresAt: null }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionPlan: true, subscriptionExpiresAt: true, subscriptionStatus: true, role: true },
    })

    if (!user) return { tier: 'free', plan: null, expiresAt: null }
    if (user.role === 'admin') return { tier: 'admin', plan: 'admin', expiresAt: null }

    // Check active package
    const now = new Date()
    const pkg = await prisma.userPackage.findFirst({
      where: { userId: session.user.id, status: 'active', expiresAt: { gt: now } },
      include: { packageOffer: { select: { packageType: true, name: true } } },
      orderBy: { expiresAt: 'desc' },
    })

    if (pkg) {
      const tier = resolveAccessTier(pkg.packageOffer?.packageType)
      return { tier, plan: pkg.packageOffer?.name || pkg.packageOffer?.packageType || null, expiresAt: pkg.expiresAt }
    }

    // Fall back to subscription
    const isBlocked = isBlockedStatus(user.subscriptionStatus)
    const isExpired = !user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) <= now

    if (isBlocked || isExpired) return { tier: 'free', plan: null, expiresAt: null }

    const tier = resolveAccessTier(user.subscriptionPlan)
    return { tier, plan: user.subscriptionPlan, expiresAt: user.subscriptionExpiresAt }
  } catch (error) {
    console.error('Error getting user tier:', error)
    return { tier: 'free', plan: null, expiresAt: null }
  }
}

/**
 * Check if user has access to a specific feature.
 *
 * Usage:
 *   const canAccess = await hasFeatureAccess('clv_tracker')  // only VIP+
 *   const canAccess = await hasFeatureAccess('all_sports')   // Pro+
 *   const canAccess = await hasFeatureAccess('snapbet_picks') // Starter+
 */
export type Feature =
  | 'snapbet_picks'       // Starter+
  | 'match_analysis'      // Starter+
  | 'all_sports'          // Pro+
  | 'parlays'             // Pro+
  | 'player_predictions'  // Pro+
  | 'premium_stars'       // Pro+
  | 'clv_tracker'         // VIP only
  | 'ai_parlay_builder'   // VIP only
  | 'analytics'           // VIP only
  | 'priority_support'    // VIP only

const FEATURE_MIN_TIER: Record<Feature, AccessTier> = {
  snapbet_picks: 'starter',
  match_analysis: 'starter',
  all_sports: 'pro',
  parlays: 'pro',
  player_predictions: 'pro',
  premium_stars: 'pro',
  clv_tracker: 'vip',
  ai_parlay_builder: 'vip',
  analytics: 'vip',
  priority_support: 'vip',
}

export async function hasFeatureAccess(feature: Feature): Promise<boolean> {
  const { tier } = await getUserTier()
  const requiredLevel = TIER_LEVEL[FEATURE_MIN_TIER[feature]]
  const userLevel = TIER_LEVEL[tier]
  return userLevel >= requiredLevel
}

