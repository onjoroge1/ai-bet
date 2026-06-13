import { NextResponse } from 'next/server'
import type { LiveEdgeBoard } from '@/lib/live-edge/types'

/**
 * GET /api/live-edge/board — proxy to the backend Live Edge board.
 *
 * Per the Live Edge manual §9 the backend `/live-edge/*` endpoints are phased
 * and may not exist yet. This proxy degrades GRACEFULLY: any backend failure
 * (404, network, timeout) returns an EMPTY board — the page shows a "no live
 * games" state, never an error. When the backend ships, this lights up with
 * zero frontend change.
 */
const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

function emptyBoard(): LiveEdgeBoard {
  return { generated_at: new Date().toISOString(), active_matches: 0, matches: [] }
}

export async function GET() {
  if (!BASE_URL) {
    return NextResponse.json(emptyBoard(), { headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${BASE_URL}/live-edge/board`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)
    if (!res.ok) {
      // 404 = endpoint not built yet (Phase 9). Treat as "no live board".
      return NextResponse.json(emptyBoard(), { headers: { 'Cache-Control': 'no-store' } })
    }
    const data = (await res.json()) as LiveEdgeBoard
    // Defensive shape guard — ensure matches is an array.
    if (!data || !Array.isArray(data.matches)) {
      return NextResponse.json(emptyBoard(), { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // Network/timeout/parse — never surface an error to the live board.
    return NextResponse.json(emptyBoard(), { headers: { 'Cache-Control': 'no-store' } })
  }
}
