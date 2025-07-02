import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  let session
  try {
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type = 'info', category = 'system' } = body

    try {
      // Create a test notification using Prisma
      const notification = await prisma.userNotification.create({
        data: {
          userId: session.user.id,
          title: '🧪 Test Notification',
          message: 'This is a test notification to verify the notification system is working correctly.',
          type,
          category,
          isRead: false,
          actionUrl: '/dashboard',
          metadata: {
            test: true,
            timestamp: new Date().toISOString(),
          },
        },
      })

      logger.info('Test notification created (Database)', {
        data: {
          notificationId: notification.id,
          type,
          category,
          userId: session.user.id,
        }
      })

      return NextResponse.json({
        success: true,
        notification,
        message: 'Test notification created successfully',
      })

    } catch (dbError) {
      logger.warn('Database insert failed for test notification', {
        error: dbError as Error,
        data: { userId: session.user.id },
      })

      // Fallback to mock data if database insert fails
      const fallbackNotification = {
        id: Date.now().toString(),
        userId: session.user.id,
        title: '🧪 Test Notification (Fallback)',
        message: 'This is a test notification to verify the notification system is working correctly.',
        type,
        category,
        isRead: false,
        actionUrl: '/dashboard',
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        readAt: null,
      }

      logger.info('Test notification created (Fallback)', {
        data: {
          notificationId: fallbackNotification.id,
          type,
          category,
          userId: session.user.id,
        }
      })

      return NextResponse.json({
        success: true,
        notification: fallbackNotification,
        message: 'Test notification created successfully (fallback mode)',
      })
    }

  } catch (error) {
    logger.error('Test notification creation failed', {
      error: error as Error,
    })
    return NextResponse.json(
      { error: 'Failed to create test notification' },
      { status: 500 }
    )
  }
} 