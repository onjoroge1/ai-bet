import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users
 *
 * Returns enriched user list for the admin dashboard.
 *
 * Query params:
 *   page, limit, search           — pagination + email/name search
 *   countryId, role, subscriptionPlan, subscriptionStatus
 *   filter=paid                   — has firstPaidAt set
 *   filter=unpaid                 — never paid
 *   filter=verified | unverified  — emailVerified state
 *   filter=admin                  — role=admin only
 *   filter=churn                  — paid but lastPurchaseAt > 60 days ago
 *
 * Response includes per-user enriched fields:
 *   purchaseCount, activePackageCount, lifetimeValue, firstPaidAt,
 *   lastPurchaseAt, signupSource, accountStatus
 *
 * Plus aggregate stats for the dashboard cards.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const search = searchParams.get('search') || ''
    const countryId = searchParams.get('countryId')
    const subscriptionPlan = searchParams.get('subscriptionPlan')
    const subscriptionStatus = searchParams.get('subscriptionStatus')
    const role = searchParams.get('role')
    const filter = searchParams.get('filter') // paid | unpaid | verified | unverified | admin | churn

    // ── Build where clause ──────────────────────────────────────────────
    const whereClause: any = { isActive: true }

    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (countryId) whereClause.countryId = countryId
    if (subscriptionPlan) whereClause.subscriptionPlan = subscriptionPlan
    if (subscriptionStatus) whereClause.subscriptionStatus = subscriptionStatus
    if (role) whereClause.role = role

    // Quick filters
    switch (filter) {
      case 'paid':
        whereClause.firstPaidAt = { not: null }
        break
      case 'unpaid':
        whereClause.firstPaidAt = null
        break
      case 'verified':
        whereClause.emailVerified = true
        break
      case 'unverified':
        whereClause.emailVerified = false
        break
      case 'admin':
        whereClause.role = 'admin'
        break
      case 'churn':
        // Paid but no purchase in 60+ days
        whereClause.firstPaidAt = { not: null }
        whereClause.lastPurchaseAt = { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
        break
    }

    // ── Fetch paginated users ────────────────────────────────────────────
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          emailVerified: true,
          emailNotifications: true,
          predictionCredits: true,
          stripeCustomerId: true,
          // Tracking fields
          signupSource: true,
          firstPaidAt: true,
          lastPurchaseAt: true,
          lifetimeValue: true,
          accountStatus: true,
          lastLoginAt: true,
          createdAt: true,
          country: { select: { name: true, code: true } },
          _count: {
            select: {
              purchases: true,
              userPackages: { where: { status: 'active' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where: whereClause }),
    ])

    // Flatten _count and decimals to plain JSON
    const enrichedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      subscriptionPlan: u.subscriptionPlan,
      subscriptionStatus: u.subscriptionStatus,
      subscriptionExpiresAt: u.subscriptionExpiresAt,
      emailVerified: u.emailVerified,
      emailNotifications: u.emailNotifications,
      predictionCredits: u.predictionCredits,
      stripeCustomerId: u.stripeCustomerId,
      signupSource: u.signupSource,
      firstPaidAt: u.firstPaidAt,
      lastPurchaseAt: u.lastPurchaseAt,
      lifetimeValue: u.lifetimeValue ? Number(u.lifetimeValue) : 0,
      accountStatus: u.accountStatus,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      country: u.country,
      purchaseCount: u._count.purchases,
      activePackageCount: u._count.userPackages,
    }))

    // ── Aggregate stats for dashboard cards ──────────────────────────────
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

    const [
      totalUsers,
      verifiedCount,
      paidCount,
      activeSubCount,
      pastDueCount,
      adminCount,
      newThisMonth,
      newThisWeek,
      activeLast30d,
      lifetimeRevenueAgg,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true, emailVerified: true } }),
      prisma.user.count({ where: { isActive: true, firstPaidAt: { not: null } } }),
      prisma.user.count({ where: { isActive: true, subscriptionStatus: { in: ['active', 'trialing'] } } }),
      prisma.user.count({ where: { isActive: true, subscriptionStatus: { in: ['past_due', 'unpaid', 'disputed'] } } }),
      prisma.user.count({ where: { isActive: true, role: 'admin' } }),
      prisma.user.count({ where: { isActive: true, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { isActive: true, createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { isActive: true, lastLoginAt: { gte: thirtyDaysAgo } } }),
      prisma.user.aggregate({ where: { isActive: true }, _sum: { lifetimeValue: true } }),
    ])

    const arpu = totalUsers > 0
      ? Number(lifetimeRevenueAgg._sum.lifetimeValue ?? 0) / totalUsers
      : 0
    const arppu = paidCount > 0
      ? Number(lifetimeRevenueAgg._sum.lifetimeValue ?? 0) / paidCount
      : 0

    return NextResponse.json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        stats: {
          totalUsers,
          verifiedCount,
          verifiedRate: totalUsers > 0 ? verifiedCount / totalUsers : 0,
          paidCount,
          paidRate: totalUsers > 0 ? paidCount / totalUsers : 0,
          activeSubCount,
          pastDueCount,
          adminCount,
          newThisMonth,
          newThisWeek,
          activeLast30d,
          lifetimeRevenue: Number(lifetimeRevenueAgg._sum.lifetimeValue ?? 0),
          arpu, // average revenue per user (all)
          arppu, // average revenue per paying user
        },
      },
    })
  } catch (error) {
    logger.error('Failed to fetch users', { error })
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 })
  }
}
