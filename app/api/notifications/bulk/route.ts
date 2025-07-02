import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { fallbackNotifications } from '../route'

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
          fallbackNotifications.forEach((notification: any) => {
            if (!notification.isRead) {
              notification.isRead = true
              notification.readAt = new Date().toISOString()
              affectedCount++
            }
          })
        } else if (notificationIds && notificationIds.length > 0) {
          // Mark specific notifications as read
          notificationIds.forEach((id: string) => {
            const notification = fallbackNotifications.find((n: any) => n.id === id)
            if (notification) {
              notification.isRead = true
              notification.readAt = new Date().toISOString()
              affectedCount++
            }
          })
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
        notificationIds.forEach((id: string) => {
          const notification = fallbackNotifications.find((n: any) => n.id === id)
          if (notification) {
            notification.isRead = false
            notification.readAt = null
            affectedCount++
          }
        })
        break

      case 'delete':
        if (!notificationIds || notificationIds.length === 0) {
          return NextResponse.json(
            { error: 'Notification IDs are required' },
            { status: 400 }
          )
        }
        notificationIds.forEach((id: string) => {
          const index = fallbackNotifications.findIndex((n: any) => n.id === id)
          if (index !== -1) {
            fallbackNotifications.splice(index, 1)
            affectedCount++
          }
        })
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    logger.info('PATCH /api/notifications/bulk - Success (Mock)', {
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