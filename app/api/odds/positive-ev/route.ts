import { NextRequest, NextResponse } from 'next/server'
import { findPositiveEVBets } from '@/lib/arbitrage-engine'
import { hasPremiumAccess } from '@/lib/premium-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const isPremium = await hasPremiumAccess()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30')
    const minEdge = parseFloat(searchParams.get('min_edge') || '2')

    let bets = await findPositiveEVBets(limit)

    // Filter by min edge
    if (minEdge > 0) {
      bets = bets.filter(b => b.edgePercent >= minEdge)
    }

    if (!isPremium) {
      return NextResponse.json({
        success: true,
        isPremium: false,
        total: bets.length,
        bets: bets.slice(0, 3).map(b => ({
          ...b,
          bestBook: '🔒',
          bestOdds: 0,
          kellyStake: 0,
          outcome: '🔒',
          outcomeTeam: '🔒',
        })),
      })
    }

    return NextResponse.json({
      success: true,
      isPremium: true,
      total: bets.length,
      bets,
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to scan +EV bets' }, { status: 500 })
  }
}
