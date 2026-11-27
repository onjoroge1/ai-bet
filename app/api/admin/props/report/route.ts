import { NextResponse } from 'next/server'
import { latestReport } from '@/lib/props/queries'
import { logger } from '@/lib/logger'

/** GET /api/admin/props/report — latest walk-forward evaluation report (paper research). */
export async function GET() {
  try {
    return NextResponse.json({ report: await latestReport() })
  } catch (error) {
    logger.error('admin props report failed', { error })
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 })
  }
}
