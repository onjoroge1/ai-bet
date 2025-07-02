import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { sql } from '@vercel/postgres'

// Import fallback data from main route
import { fallbackNotifications } from '../route'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let session
  try {
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { isRead } = body

    try {
      // Try to update real notification in database
      const result = await sql`
        UPDATE "UserNotification" 
        SET "isRead" = ${isRead}, "readAt" = ${isRead ? new Date().toISOString() : null}
        WHERE "id" = ${id} AND "userId" = ${session.user.id}
        RETURNING *
      `

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }

      const notification = result.rows[0]

      logger.info('PATCH /api/notifications/[id] - Success (Database)', {
        notificationId: id,
        isRead,
        userId: session.user.id,
      })

      return NextResponse.json({
        ...notification,
        metadata: notification.metadata ? JSON.parse(notification.metadata as string) : null,
      })

    } catch (dbError) {
      // Fallback to mock data if database update fails
      logger.warn('Database update failed, using fallback', {
        error: dbError as Error,
        notificationId: id,
        userId: session.user.id,
      })

      const notificationIndex = fallbackNotifications.findIndex(n => n.id === id)
      if (notificationIndex === -1) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }

      // Update notification
      fallbackNotifications[notificationIndex] = {
        ...fallbackNotifications[notificationIndex],
        isRead,
        readAt: isRead ? new Date().toISOString() : null,
      }

      logger.info('PATCH /api/notifications/[id] - Success (Fallback)', {
        notificationId: id,
        isRead,
        userId: session.user.id,
      })

      return NextResponse.json(fallbackNotifications[notificationIndex])
    }

  } catch (error) {
    logger.error('PATCH /api/notifications/[id] - Error', {
      error: error as Error,
      notificationId: params.id,
    })
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let session
  try {
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    try {
      // Try to delete real notification from database
      const result = await sql`
        DELETE FROM "UserNotification" 
        WHERE "id" = ${id} AND "userId" = ${session.user.id}
        RETURNING "id"
      `

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }

      logger.info('DELETE /api/notifications/[id] - Success (Database)', {
        notificationId: id,
        userId: session.user.id,
      })

      return NextResponse.json({ success: true })

    } catch (dbError) {
      // Fallback to mock data if database delete fails
      logger.warn('Database delete failed, using fallback', {
        error: dbError as Error,
        notificationId: id,
        userId: session.user.id,
      })

      const notificationIndex = fallbackNotifications.findIndex(n => n.id === id)
      if (notificationIndex === -1) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }

      fallbackNotifications.splice(notificationIndex, 1)

      logger.info('DELETE /api/notifications/[id] - Success (Fallback)', {
        notificationId: id,
        userId: session.user.id,
      })

      return NextResponse.json({ success: true })
    }

  } catch (error) {
    logger.error('DELETE /api/notifications/[id] - Error', {
      error: error as Error,
      notificationId: params.id,
    })
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
} 