import { NextResponse } from 'next/server'
import { getPremiumStatus } from '@/lib/premium-access'

/**
 * GET /api/premium/check - Check premium access status
 */
export async function GET() {
  try {
    const status = await getPremiumStatus()
    return NextResponse.json(status)
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

