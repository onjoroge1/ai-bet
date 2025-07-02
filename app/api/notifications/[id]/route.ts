import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'

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
    const { isRead, actionUrl, metadata } = body

    // Verify the notification belongs to the user
    const existingNotification = await prisma.userNotification.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Update the notification
    const updateData: any = {}
    
    if (typeof isRead === 'boolean') {
      updateData.isRead = isRead
      updateData.readAt = isRead ? new Date() : null
    }
    
    if (actionUrl !== undefined) {
      updateData.actionUrl = actionUrl
    }
    
    if (metadata !== undefined) {
      updateData.metadata = metadata
    }

    const updatedNotification = await prisma.userNotification.update({
      where: { id },
      data: updateData,
    })

    logger.info('PATCH /api/notifications/[id] - Success', {
      data: {
        notificationId: id,
        userId: session.user.id,
        updates: Object.keys(updateData),
      }
    })

    return NextResponse.json({
      ...updatedNotification,
      metadata: updatedNotification.metadata ?? null,
    })
  } catch (error) {
    logger.error('PATCH /api/notifications/[id] - Error', {
      error: error as Error,
      data: { notificationId: params.id },
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

    // Verify the notification belongs to the user
    const existingNotification = await prisma.userNotification.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingNotification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Delete the notification
    await prisma.userNotification.delete({
      where: { id },
    })

    logger.info('DELETE /api/notifications/[id] - Success', {
      data: {
        notificationId: id,
        userId: session.user.id,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/notifications/[id] - Error', {
      error: error as Error,
      data: { notificationId: params.id },
    })
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
} 