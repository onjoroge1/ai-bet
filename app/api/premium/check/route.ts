import { NextResponse } from 'next/server'
import { getPremiumStatus } from '@/lib/premium-access'

/**
 * GET /api/premium/check - Check premium access status
 * Cached for 60 seconds so multiple simultaneous component mounts don't
 * each hit the database.
 */
export async function GET() {
  try {
    const status = await getPremiumStatus()
    const response = NextResponse.json(status)
    // Cache the response for 60 s in the browser and 30 s in CDN edge cache.
    // stale-while-revalidate lets the browser serve a cached response while
    // it fetches a fresh one in the background.
    response.headers.set(
      'Cache-Control',
      'private, max-age=60, stale-while-revalidate=30'
    )
    return response
  } catch (error) {
    return NextResponse.json(
      { 
        hasAccess: false, 
        plan: null, 
        expiresAt: null, 
        isExpired: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



