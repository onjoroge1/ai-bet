import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'

// Temporary mock data as fallback
export const fallbackNotifications = [
  {
    id: '1',
    title: '🎉 Welcome to SnapBet!',
    message: 'Welcome to the ultimate sports prediction platform. Start exploring our AI-powered predictions!',
    type: 'info',
    category: 'system',
    isRead: false,
    actionUrl: '/dashboard',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    readAt: null,
  },
  {
    id: '2',
    title: '⚽ New Prediction Available',
    message: 'A new Over 2.5 Goals prediction with 85% confidence is ready for you!',
    type: 'prediction',
    category: 'prediction',
    isRead: false,
    actionUrl: '/dashboard/predictions',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    readAt: null,
  },
  {
    id: '3',
    title: '💳 Payment Successful',
    message: 'Your payment of $29.99 for Premium Package was successful. Your tips are now available!',
    type: 'success',
    category: 'payment',
    isRead: true,
    actionUrl: '/dashboard/my-tips',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
]

export async function GET(request: NextRequest) {
  let session
  try {
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const isRead = searchParams.get('isRead')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    try {
      // Build Prisma where filter
      const where: any = { userId: session.user.id }
      if (type && type !== 'all') where.type = type
      if (category && category !== 'all') where.category = category
      if (isRead !== null && isRead !== 'all') where.isRead = isRead === 'true'
      if (unreadOnly) where.isRead = false

      // Get notifications
      const notifications = await prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })

      // Get total count
      const totalCount = await prisma.userNotification.count({ where })
      // Get unread count
      const unreadCount = await prisma.userNotification.count({
        where: { userId: session.user.id, isRead: false },
      })

      logger.info('GET /api/notifications - Success (Database)', {
        data: {
          count: notifications.length,
          totalCount,
          unreadCount,
          userId: session.user.id,
        }
      })

      return NextResponse.json({
        notifications,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1,
        },
        unreadCount,
      })
    } catch (dbError) {
      // Fallback to mock data if database query fails
      logger.warn('Database query failed, using fallback notifications', {
        error: dbError as Error,
        data: { userId: session.user.id },
      })

      // Filter mock notifications (simulate user-specific behavior)
      let filteredNotifications = [...fallbackNotifications]

      if (type && type !== 'all') {
        filteredNotifications = filteredNotifications.filter(n => n.type === type)
      }
      if (category && category !== 'all') {
        filteredNotifications = filteredNotifications.filter(n => n.category === category)
      }
      if (isRead !== null && isRead !== 'all') {
        filteredNotifications = filteredNotifications.filter(n => n.isRead === (isRead === 'true'))
      }
      if (unreadOnly) {
        filteredNotifications = filteredNotifications.filter(n => !n.isRead)
      }

      // Sort by createdAt desc
      filteredNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      // Pagination
      const skip = (page - 1) * limit
      const paginatedNotifications = filteredNotifications.slice(skip, skip + limit)
      const totalCount = filteredNotifications.length
      const unreadCount = fallbackNotifications.filter(n => !n.isRead).length

      logger.info('GET /api/notifications - Success (Fallback)', {
        data: {
          count: paginatedNotifications.length,
          totalCount,
          unreadCount,
          userId: session.user.id,
        }
      })

      return NextResponse.json({
        notifications: paginatedNotifications,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1,
        },
        unreadCount,
      })
    }

  } catch (error) {
    logger.error('GET /api/notifications - Error', {
      error: error as Error,
    })
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let session
  try {
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, message, type = 'info', category = 'system', actionUrl, metadata } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      )
    }

    try {
      // Try to create real notification in database
      const result = await prisma.userNotification.create({
        data: {
          id: crypto.randomUUID(),
          userId: session.user.id,
          title,
          message,
          type,
          category,
          isRead: false,
          actionUrl,
          metadata: metadata ? metadata : undefined,
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      })

      logger.info('POST /api/notifications - Success (Database)', {
        data: {
          notificationId: result.id,
          type,
          category,
          userId: session.user.id,
        }
      })

      return NextResponse.json({
        ...result,
        metadata: result.metadata ?? null,
      })

    } catch (dbError) {
      // Fallback to mock data if database insert fails
      logger.warn('Database insert failed, using fallback', {
        error: dbError as Error,
        data: { userId: session.user.id },
      })

      const notification = {
        id: Date.now().toString(),
        userId: session.user.id,
        title,
        message,
        type,
        category,
        isRead: false,
        actionUrl,
        metadata,
        createdAt: new Date().toISOString(),
        readAt: null,
      }

      // Add to fallback data (this won't persist, but provides immediate feedback)
      fallbackNotifications.unshift(notification)

      logger.info('POST /api/notifications - Success (Fallback)', {
        data: {
          notificationId: notification.id,
          type,
          category,
          userId: session.user.id,
        }
      })

      return NextResponse.json(notification)
    }

  } catch (error) {
    logger.error('POST /api/notifications - Error', {
      error: error as Error,
    })
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
} 