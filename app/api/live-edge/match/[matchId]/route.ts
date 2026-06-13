import { NextRequest, NextResponse } from 'next/server'
import type { LiveEdgeMatchDetail } from '@/lib/live-edge/types'

/**
 * GET /api/live-edge/match/{matchId} — proxy to the backend Live Edge detail.
 * Graceful: returns 404 (not 500) when the backend lacks the endpoint or the
 * match isn't live, so the detail page shows a clean "not available" state.
 */
const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  if (!/^\d+$/.test(matchId)) {
    return NextResponse.json({ error: 'Invalid match id' }, { status: 400 })
  }
  if (!BASE_URL) {
    return NextResponse.json({ error: 'Live Edge not available' }, { status: 404 })
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${BASE_URL}/live-edge/match/${matchId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)
    if (!res.ok) {
      return NextResponse.json({ error: 'Match not live or not found' }, { status: 404 })
    }
    const data = (await res.json()) as LiveEdgeMatchDetail
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Live Edge service unavailable' }, { status: 503 })
  }
}
