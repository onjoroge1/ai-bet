/**
 * Legacy prediction backend (the retired Replit FastAPI service).
 *
 * The multisport path no longer uses it (pipeline/ writes MultisportMatch
 * directly). Soccer, parlays, player props, CLV club and Live Edge still
 * proxy to it and will stay paused until a new upstream exists.
 *
 * Rules:
 *  - No hardcoded host or API key anywhere: if BACKEND_API_URL / BACKEND_URL
 *    is unset the feature is PAUSED and routes answer fast with 503 + paused:true
 *    instead of hanging on a dead host.
 *  - Routes that can degrade (lists, dashboards) should return their empty
 *    shape with `paused: true` so the UI shows an empty state, not an error.
 */
import { NextResponse } from 'next/server'

export const BACKEND_URL: string | null =
  process.env.BACKEND_API_URL || process.env.BACKEND_URL || null

export const BACKEND_API_KEY: string | null =
  process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || null

export function backendConfigured(): boolean {
  return Boolean(BACKEND_URL && BACKEND_API_KEY)
}

export const BACKEND_PAUSED_MESSAGE =
  'Upstream prediction service is not configured — this feature is paused while soccer moves off the retired backend.'

/** 503 for routes that cannot degrade. */
export function backendUnavailable(extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json(
    { error: BACKEND_PAUSED_MESSAGE, paused: true, ...extra },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  )
}

/** 200 with an empty payload for list/dashboard routes that can degrade. */
export function backendPausedEmpty<T extends Record<string, unknown>>(empty: T): NextResponse {
  return NextResponse.json(
    { ...empty, paused: true, message: BACKEND_PAUSED_MESSAGE },
    { status: 200, headers: { 'Cache-Control': 'public, s-maxage=300' } }
  )
}
