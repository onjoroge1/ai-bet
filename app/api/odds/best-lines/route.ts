import { NextRequest, NextResponse } from 'next/server'
import { getLineShop } from '@/lib/arbitrage-engine'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('match_id') || undefined
    const limit = parseInt(searchParams.get('limit') || '20')

    const results = await getLineShop(matchId, limit)

    return NextResponse.json({
      success: true,
      total: results.length,
      matches: results,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch line data' }, { status: 500 })
  }
}
