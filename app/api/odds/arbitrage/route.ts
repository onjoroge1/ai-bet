import { NextRequest, NextResponse } from 'next/server'
import { findArbitrageOpportunities } from '@/lib/arbitrage-engine'
import { hasPremiumAccess } from '@/lib/premium-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const isPremium = await hasPremiumAccess()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30')

    const opportunities = await findArbitrageOpportunities(limit)

    if (!isPremium) {
      // Free: show count + first 2 redacted
      return NextResponse.json({
        success: true,
        isPremium: false,
        total: opportunities.length,
        opportunities: opportunities.slice(0, 2).map(o => ({
          ...o,
          bets: o.bets.map(b => ({ ...b, book: '🔒', odds: 0 })),
          profitPercent: 0,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      isPremium: true,
      total: opportunities.length,
      opportunities,
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to scan arbitrage' }, { status: 500 })
  }
}
