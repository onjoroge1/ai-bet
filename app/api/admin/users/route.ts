import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const countryId = searchParams.get('countryId')
    const subscriptionPlan = searchParams.get('subscriptionPlan')
    const role = searchParams.get('role')
    const emailNotifications = searchParams.get('emailNotifications')

    // Build where clause
    const whereClause: any = { isActive: true }
    
    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (countryId) {
      whereClause.countryId = countryId
    }
    
    if (subscriptionPlan) {
      whereClause.subscriptionPlan = subscriptionPlan
    }
    
    if (role) {
      whereClause.role = role
    }
    
    if (emailNotifications !== null) {
      whereClause.emailNotifications = emailNotifications === 'true'
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          subscriptionPlan: true,
          emailNotifications: true,
          createdAt: true,
          country: {
            select: {
              name: true,
              code: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where: whereClause })
    ])

    // Get summary stats
    const stats = await prisma.user.groupBy({
      by: ['subscriptionPlan', 'role'],
      where: { isActive: true },
      _count: true
    })

    const emailNotificationStats = await prisma.user.groupBy({
      by: ['emailNotifications'],
      where: { isActive: true },
      _count: true
    })

    logger.info('Admin users list fetched', {
      page,
      limit,
      total,
      filters: { search, countryId, subscriptionPlan, role, emailNotifications }
    })

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        stats: {
          bySubscription: stats.filter(s => s.subscriptionPlan),
          byRole: stats.filter(s => s.role),
          emailNotifications: emailNotificationStats
        }
      }
    })

  } catch (error) {
    logger.error('Failed to fetch users', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
} 