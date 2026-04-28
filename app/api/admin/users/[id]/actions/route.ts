import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/users/[id]/actions
 * Body: { action, ...params }
 *
 * Quick actions exposed by the admin user-detail page:
 *   - resend-verification        regenerate token + send email
 *   - reset-password             generate reset token (admin sees URL or sent via email)
 *   - suspend / unsuspend        flip accountStatus
 *   - notify { title, message }  send an in-app notification
 *
 * (Refunds + cancel-subscription stay in Stripe — Stripe Portal handles them
 * end-to-end. Admin can open the Stripe customer link from the detail page.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const adminId = session.user.id

  try {
    const body = await request.json()
    const action = body.action

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, accountStatus: true, role: true },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    switch (action) {
      case 'resend-verification': {
        const token = crypto.randomBytes(32).toString('hex')
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await prisma.user.update({
          where: { id },
          data: {
            emailVerificationToken: token,
            emailVerificationExpires: expires,
          },
        })
        // Try to send the email; the admin tooling falls back to returning the
        // URL if email isn't configured (useful in dev).
        const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/verify-email?token=${token}`
        try {
          const { sendVerificationEmail } = await import('@/lib/email-service')
          await sendVerificationEmail(target.email, target.fullName ?? '', verifyUrl)
        } catch (e) {
          logger.error('[Admin actions] Failed to send verification email', { error: e })
        }
        logger.info('[Admin actions] resend-verification', { userId: id, adminId })
        return NextResponse.json({ success: true, verifyUrl })
      }

      case 'reset-password': {
        const token = crypto.randomBytes(32).toString('hex')
        const expires = new Date(Date.now() + 60 * 60 * 1000) // 1h
        await prisma.user.update({
          where: { id },
          data: {
            passwordResetToken: token,
            passwordResetExpires: expires,
          },
        })
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/reset-password?token=${token}`
        try {
          const { sendPasswordResetEmail } = await import('@/lib/email-service')
          await sendPasswordResetEmail(target.email, target.fullName ?? '', resetUrl)
        } catch (e) {
          logger.error('[Admin actions] Failed to send reset email', { error: e })
        }
        logger.info('[Admin actions] reset-password', { userId: id, adminId })
        return NextResponse.json({ success: true, resetUrl })
      }

      case 'suspend': {
        if (target.role === 'admin') {
          return NextResponse.json({ error: 'Cannot suspend an admin user' }, { status: 400 })
        }
        await prisma.user.update({
          where: { id },
          data: { accountStatus: 'suspended' },
        })
        logger.info('[Admin actions] suspend', { userId: id, adminId })
        return NextResponse.json({ success: true })
      }

      case 'unsuspend': {
        await prisma.user.update({
          where: { id },
          data: { accountStatus: 'active' },
        })
        logger.info('[Admin actions] unsuspend', { userId: id, adminId })
        return NextResponse.json({ success: true })
      }

      case 'notify': {
        const { title, message, actionUrl } = body
        if (!title || !message) {
          return NextResponse.json({ error: 'title + message required' }, { status: 400 })
        }
        const { NotificationService } = await import('@/lib/notification-service')
        await NotificationService.createNotification({
          userId: id,
          title,
          message,
          type: 'info',
          category: 'admin',
          actionUrl: actionUrl ?? '/dashboard',
        })
        logger.info('[Admin actions] notify', { userId: id, adminId, title })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    logger.error('Admin user-action failed', { error, userId: id })
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal error',
    }, { status: 500 })
  }
}
