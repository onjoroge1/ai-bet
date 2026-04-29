import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import crypto from 'node:crypto'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Mail } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ email?: string; token?: string }>
}

/**
 * Public unsubscribe landing page — link target from the nightly briefing email.
 * Verifies the HMAC token to prove the link came from us, flips emailNotifications
 * to false, and shows a confirmation. No login required (CAN-SPAM-compliant
 * one-click flow).
 *
 * If the token is invalid we don't fail loudly — just redirect to settings so
 * the user can manage preferences manually.
 */
export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { email, token } = await searchParams

  if (!email || !token) {
    redirect('/dashboard/settings?tab=notifications')
  }

  const secret = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'fallback-secret'
  const expected = crypto.createHmac('sha256', secret).update(email).digest('hex').slice(0, 24)
  const valid = expected === token

  let outcome: 'unsubscribed' | 'already' | 'not-found' | 'invalid' = 'invalid'

  if (valid) {
    try {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailNotifications: true } })
      if (!user) {
        outcome = 'not-found'
      } else if (!user.emailNotifications) {
        outcome = 'already'
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailNotifications: false },
        })
        outcome = 'unsubscribed'
        logger.info('[Unsubscribe] User unsubscribed via one-click', { tags: ['email', 'unsubscribe'], data: { userId: user.id } })
      }
    } catch (e) {
      logger.error('[Unsubscribe] DB write failed', { error: e instanceof Error ? e : undefined })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800/60 border border-slate-700 rounded-2xl p-8 text-center">
        {outcome === 'unsubscribed' && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">You&apos;ve unsubscribed</h1>
            <p className="text-slate-400 text-sm">
              We&apos;ll stop sending the nightly briefing to{' '}
              <span className="text-slate-200 font-mono">{email}</span>.
            </p>
          </>
        )}
        {outcome === 'already' && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-500/15 border border-slate-500/40 flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-slate-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Already unsubscribed</h1>
            <p className="text-slate-400 text-sm">
              You&apos;re not currently receiving briefings at{' '}
              <span className="text-slate-200 font-mono">{email}</span>.
            </p>
          </>
        )}
        {(outcome === 'invalid' || outcome === 'not-found') && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mb-4">
              <AlertCircle className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Couldn&apos;t verify that link</h1>
            <p className="text-slate-400 text-sm">
              The unsubscribe link is invalid or expired. Sign in to manage your email preferences directly.
            </p>
          </>
        )}

        <Link
          href="/dashboard/settings?tab=notifications"
          className="inline-block mt-6 px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors"
        >
          Open email preferences
        </Link>

        <p className="text-xs text-slate-500 mt-6">
          Changed your mind? Re-enable briefings any time from your settings.
        </p>
      </div>
    </div>
  )
}
