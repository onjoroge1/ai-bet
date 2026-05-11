import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { beginCron, endCron, type HeartbeatToken } from '@/lib/cron-heartbeat'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET/POST /api/admin/blogs/evergreen-refresh-scheduled
 *
 * Weekly cron. Flags published EvergreenTopic rows whose lastPublishedAt
 * is older than 90 days as `status: refresh_due` so they appear at the top
 * of the admin queue. Does NOT re-generate drafts automatically — admin
 * still clicks "Re-draft" intentionally. This keeps OpenAI spend bounded.
 *
 * Schedule (vercel.json): "0 8 * * 1" — Mondays at 08:00 UTC.
 * Auth: Bearer CRON_SECRET.
 *
 * Heartbeat-instrumented for /admin Cron Health visibility.
 */
async function handle(request: NextRequest) {
  // Auth
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let hb: HeartbeatToken | null = null
  try {
    hb = await beginCron('blog:evergreen-refresh')

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000)
    const candidates = await prisma.evergreenTopic.findMany({
      where: {
        status: 'published',
        lastPublishedAt: { lt: ninetyDaysAgo },
      },
      select: { id: true, slug: true, title: true, lastPublishedAt: true },
    })

    if (candidates.length === 0) {
      logger.info('[Evergreen Refresh] No topics due for refresh', {
        tags: ['blog', 'evergreen', 'cron'],
      })
      if (hb) await endCron(hb, { status: 'ok', rowsAffected: 0 })
      return NextResponse.json({ success: true, flagged: 0, message: 'No topics due for refresh' })
    }

    // Bulk flag — admin sees them in queue UI with "Refresh due" badge
    const result = await prisma.evergreenTopic.updateMany({
      where: { id: { in: candidates.map(c => c.id) } },
      data: { status: 'refresh_due', refreshDueAt: new Date() },
    })

    logger.info(`[Evergreen Refresh] Flagged ${result.count} topics for refresh`, {
      tags: ['blog', 'evergreen', 'cron'],
      data: { slugs: candidates.map(c => c.slug) },
    })

    if (hb) await endCron(hb, { status: 'ok', rowsAffected: result.count })

    return NextResponse.json({
      success: true,
      flagged: result.count,
      slugs: candidates.map(c => c.slug),
    })
  } catch (error) {
    if (hb) await endCron(hb, { status: 'error', error })
    logger.error('[Evergreen Refresh] Failed', {
      tags: ['blog', 'evergreen', 'cron', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
