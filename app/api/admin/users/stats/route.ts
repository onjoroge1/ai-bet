import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users/stats
 *
 * Returns time-series and conversion-funnel data for the admin dashboard:
 *   - signupsByDay[]      last 90 days, day-by-day signup counts
 *   - funnel              { signups, verified, paid, subscribed }
 *   - signupSources[]     count of users by signupSource
 *   - topSpenders[]       top 10 users by lifetimeValue
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000)

    // Signups per day (last 90 days) — raw query for SQL date_trunc speed
    const signupsByDayRaw = await prisma.$queryRawUnsafe<Array<{ day: Date; n: bigint }>>(`
      SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as n
      FROM "User"
      WHERE "createdAt" >= $1 AND "isActive" = true
      GROUP BY day
      ORDER BY day ASC
    `, ninetyDaysAgo)

    const signupsByDay = signupsByDayRaw.map(r => ({
      day: r.day.toISOString().slice(0, 10),
      count: Number(r.n),
    }))

    // Conversion funnel
    const [signups, verified, paid, subscribed] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true, emailVerified: true } }),
      prisma.user.count({ where: { isActive: true, firstPaidAt: { not: null } } }),
      prisma.user.count({
        where: { isActive: true, subscriptionStatus: { in: ['active', 'trialing'] } },
      }),
    ])

    // Signup source breakdown
    const sourcesRaw = await prisma.user.groupBy({
      by: ['signupSource'],
      where: { isActive: true },
      _count: { _all: true },
      orderBy: { _count: { signupSource: 'desc' } },
    })
    const signupSources = sourcesRaw.map(s => ({
      source: s.signupSource ?? '(direct)',
      count: s._count._all,
    }))

    // Top 10 spenders by lifetime value
    const topSpenders = await prisma.user.findMany({
      where: { isActive: true, lifetimeValue: { gt: 0 } },
      orderBy: { lifetimeValue: 'desc' },
      take: 10,
      select: { id: true, email: true, fullName: true, lifetimeValue: true, firstPaidAt: true },
    })

    return NextResponse.json({
      success: true,
      signupsByDay,
      funnel: {
        signups,
        verified,
        paid,
        subscribed,
        verifiedRate: signups > 0 ? verified / signups : 0,
        paidRate: signups > 0 ? paid / signups : 0,
        subscribedRate: signups > 0 ? subscribed / signups : 0,
      },
      signupSources,
      topSpenders: topSpenders.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        lifetimeValue: Number(u.lifetimeValue ?? 0),
        firstPaidAt: u.firstPaidAt,
      })),
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    }, { status: 500 })
  }
}
