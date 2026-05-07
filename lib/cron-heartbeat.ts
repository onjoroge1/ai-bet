/**
 * Cron heartbeat — records start + end of each cron job invocation so a
 * silently-killed function (e.g. exceeding maxDuration before the catch block)
 * is visible as a stale lastCompletedAt on /admin, not a quiet data plateau.
 *
 * Usage:
 *   const hb = await beginCron('market-sync:upcoming')
 *   try {
 *     const { synced, errors } = await doWork()
 *     await endCron(hb, { status: 'ok', rowsAffected: synced })
 *   } catch (e) {
 *     await endCron(hb, { status: 'error', error: e })
 *     throw e
 *   }
 */

import prisma from '@/lib/db'

export interface HeartbeatToken {
  name: string
  startedAt: Date
}

/**
 * Mark the start of a cron run. Best-effort — if the DB write fails, we still
 * return a token so the caller can compute duration and never branches on the
 * heartbeat being available.
 */
export async function beginCron(name: string): Promise<HeartbeatToken> {
  const startedAt = new Date()
  try {
    await prisma.cronHeartbeat.upsert({
      where: { name },
      create: {
        name,
        lastStartedAt: startedAt,
        runCount: 1,
      },
      update: {
        lastStartedAt: startedAt,
        runCount: { increment: 1 },
      },
    })
  } catch {
    /* non-fatal */
  }
  return { name, startedAt }
}

interface EndCronOpts {
  status: 'ok' | 'error'
  rowsAffected?: number
  error?: unknown
}

/**
 * Mark the end of a cron run. Records duration, status, error, and an
 * optional rows-affected metric the job wants surfaced.
 */
export async function endCron(token: HeartbeatToken, opts: EndCronOpts): Promise<void> {
  const completedAt = new Date()
  const durationMs = completedAt.getTime() - token.startedAt.getTime()
  const errorMsg =
    opts.error instanceof Error
      ? opts.error.message.slice(0, 500)
      : opts.error
        ? String(opts.error).slice(0, 500)
        : null

  try {
    await prisma.cronHeartbeat.update({
      where: { name: token.name },
      data: {
        lastCompletedAt: completedAt,
        lastDurationMs: durationMs,
        lastStatus: opts.status,
        lastError: errorMsg,
        rowsAffected: opts.rowsAffected ?? null,
        ...(opts.status === 'error' ? { errorCount: { increment: 1 } } : {}),
      },
    })
  } catch {
    /* non-fatal */
  }
}
