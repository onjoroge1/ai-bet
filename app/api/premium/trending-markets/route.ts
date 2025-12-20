import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPremiumAccess } from '@/lib/premium-access'

/**
 * GET /api/premium/trending-markets
 * Get trending and hot markets
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await hasPremiumAccess()
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Premium subscription required' },
        { status: 403 }
      )
    }

    // Fetch CLV opportunities and sort by activity/trending
    const response = await fetch(
      `${process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'}/clv/club/opportunities?limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch trending markets')
    }

    const data = await response.json()
    const opportunities = data.items || data.opportunities || []

    // Transform to trending markets format
    const trendingMarkets = opportunities
      .slice(0, 5)
      .map((opp: any) => {
        const outcome = opp.outcome === 'H' ? 'Home Win' :
                      opp.outcome === 'D' ? 'Draw' :
                      'Away Win'
        
        const matchName = opp.home_team && opp.away_team
          ? `${opp.home_team} vs ${opp.away_team}`
          : `Match #${opp.match_id}`

        // Determine trend (up = good CLV, fire = hot market)
        const trend = opp.clv_pct > 5 ? 'up' : opp.clv_pct > 2 ? 'fire' : 'neutral'

        return {
          id: opp.alert_id || opp.match_id,
          match_id: opp.match_id,
          match_name: matchName,
          market: outcome,
          odds: opp.best_odds || 0,
          clv_pct: opp.clv_pct || 0,
          trend,
          books_used: opp.books_used || 0,
        }
      })

    return NextResponse.json({
      markets: trendingMarkets,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching trending markets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trending markets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

