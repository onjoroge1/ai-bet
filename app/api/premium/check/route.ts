import { NextResponse } from 'next/server'
import { getPremiumStatus, hasPackageAccess, getUserTier } from '@/lib/premium-access'

/**
 * GET /api/premium/check - Check premium access status + tier
 * Includes subscription, package access, AND granular tier info.
 * Cached for 60 seconds.
 */
export async function GET() {
  try {
    const [status, packageAccess, tierInfo] = await Promise.all([
      getPremiumStatus(),
      hasPackageAccess(),
      getUserTier(),
    ])

    const response = NextResponse.json({
      ...status,
      hasPackageAccess: packageAccess,
      // Tier-based access (new)
      tier: tierInfo.tier,          // "free" | "starter" | "pro" | "vip" | "admin"
      tierPlan: tierInfo.plan,
      tierExpiresAt: tierInfo.expiresAt,
      // Feature flags for client-side gating
      features: {
        snapbet_picks: tierInfo.tier !== 'free',
        all_sports: ['pro', 'vip', 'admin'].includes(tierInfo.tier),
        parlays: ['pro', 'vip', 'admin'].includes(tierInfo.tier),
        player_predictions: ['pro', 'vip', 'admin'].includes(tierInfo.tier),
        clv_tracker: ['vip', 'admin'].includes(tierInfo.tier),
        ai_parlay_builder: ['vip', 'admin'].includes(tierInfo.tier),
        analytics: ['vip', 'admin'].includes(tierInfo.tier),
      },
    })
    response.headers.set(
      'Cache-Control',
      'private, max-age=60, stale-while-revalidate=30'
    )
    return response
  } catch (error) {
    return NextResponse.json(
      {
        hasAccess: false,
        hasPackageAccess: false,
        plan: null,
        expiresAt: null,
        isExpired: true,
        tier: 'free',
        features: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



