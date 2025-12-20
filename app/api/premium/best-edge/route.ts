import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPremiumAccess } from '@/lib/premium-access'
import { calculateCLV } from '@/lib/clv-calculator'

/**
 * GET /api/premium/best-edge
 * Get the best CLV opportunity right now
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

    // Fetch CLV opportunities
    const response = await fetch(
      `${process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'}/clv/club/opportunities?limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch CLV opportunities')
    }

    const data = await response.json()
    const opportunities = data.items || data.opportunities || []

    if (opportunities.length === 0) {
      return NextResponse.json({ error: 'No CLV opportunities available' }, { status: 404 })
    }

    // Find the best opportunity (highest CLV% with good confidence)
    const bestOpportunity = opportunities
      .map((opp: any) => {
        const entryOdds = opp.best_odds || 0
        const closeOdds = opp.market_composite_odds || 0
        const clvPct = opp.clv_pct || 0
        const confidence = opp.confidence_score || 0

        if (entryOdds === 0 || closeOdds === 0) return null

        const calc = calculateCLV(entryOdds, closeOdds)
        
        return {
          ...opp,
          clvPct,
          confidence: Math.max(confidence, calc.confidence),
          score: (clvPct * 0.7) + (calc.confidence * 0.3), // Weighted score
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)[0]

    if (!bestOpportunity) {
      return NextResponse.json({ error: 'No valid CLV opportunities' }, { status: 404 })
    }

    // Format response
    const outcome = bestOpportunity.outcome === 'H' ? 'Home Win' :
                   bestOpportunity.outcome === 'D' ? 'Draw' :
                   'Away Win'

    const market = bestOpportunity.market_type || outcome

    return NextResponse.json({
      match_id: bestOpportunity.match_id,
      home_team: bestOpportunity.home_team || 'Home',
      away_team: bestOpportunity.away_team || 'Away',
      league: bestOpportunity.league || 'Unknown',
      market,
      outcome,
      fair_odds: bestOpportunity.market_composite_odds || bestOpportunity.close_odds || 0,
      book_odds: bestOpportunity.best_odds || bestOpportunity.entry_odds || 0,
      clv_pct: bestOpportunity.clvPct,
      confidence: bestOpportunity.confidence,
      books_used: bestOpportunity.books_used || 0,
      best_book: bestOpportunity.best_book_id || 'unknown',
      expires_at: bestOpportunity.expires_at,
    })
  } catch (error) {
    console.error('Error fetching best edge:', error)
    return NextResponse.json(
      { error: 'Failed to fetch best edge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

