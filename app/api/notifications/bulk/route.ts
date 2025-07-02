import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'

export async function PATCH(request: NextRequest) {
  let session
  try {
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, notificationIds, markAllAsRead } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    let affectedCount = 0

    switch (action) {
      case 'markAsRead':
        if (markAllAsRead) {
          // Mark all unread notifications as read
          const result = await prisma.userNotification.updateMany({
            where: {
              userId: session.user.id,
              isRead: false,
            },
            data: {
              isRead: true,
              readAt: new Date(),
            },
          })
          affectedCount = result.count
        } else if (notificationIds && notificationIds.length > 0) {
          // Mark specific notifications as read
          const result = await prisma.userNotification.updateMany({
            where: {
              id: { in: notificationIds },
              userId: session.user.id,
            },
            data: {
              isRead: true,
              readAt: new Date(),
            },
          })
          affectedCount = result.count
        } else {
          return NextResponse.json(
            { error: 'Notification IDs or markAllAsRead is required' },
            { status: 400 }
          )
        }
        break

      case 'markAsUnread':
        if (!notificationIds || notificationIds.length === 0) {
          return NextResponse.json(
            { error: 'Notification IDs are required' },
            { status: 400 }
          )
        }
        const unreadResult = await prisma.userNotification.updateMany({
          where: {
            id: { in: notificationIds },
            userId: session.user.id,
          },
          data: {
            isRead: false,
            readAt: null,
          },
        })
        affectedCount = unreadResult.count
        break

      case 'delete':
        if (!notificationIds || notificationIds.length === 0) {
          return NextResponse.json(
            { error: 'Notification IDs are required' },
            { status: 400 }
          )
        }
        const deleteResult = await prisma.userNotification.deleteMany({
          where: {
            id: { in: notificationIds },
            userId: session.user.id,
          },
        })
        affectedCount = deleteResult.count
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    logger.info('PATCH /api/notifications/bulk - Success', {
      data: {
        action,
        affectedCount,
        userId: session.user.id,
      }
    })

    return NextResponse.json({
      success: true,
      affectedCount,
    })
  } catch (error) {
    logger.error('PATCH /api/notifications/bulk - Error', {
      error: error as Error,
    })
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    )
  }
} 