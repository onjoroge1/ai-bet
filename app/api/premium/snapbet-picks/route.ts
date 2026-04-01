import { NextRequest, NextResponse } from 'next/server'
import { getSnapBetPicks } from '@/lib/premium-picks-engine'
import { hasPremiumAccess } from '@/lib/premium-access'

export const dynamic = 'force-dynamic'

/**
 * GET /api/premium/snapbet-picks
 *
 * Returns curated premium picks across all sports.
 * Free users: see match names, sport, kickoff, tier — but pick/confidence/reasons are hidden.
 * Premium users: see everything.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const sport = searchParams.get('sport') // optional filter: soccer, nba, nhl, ncaab

    const allPicks = await getSnapBetPicks(Math.min(limit, 30))

    // Filter by sport if specified
    const picks = sport
      ? allPicks.filter(p => p.sport === sport)
      : allPicks

    // Check premium access
    const isPremium = await hasPremiumAccess()

    if (isPremium) {
      // Full access
      return NextResponse.json({
        success: true,
        isPremium: true,
        picks,
        total: picks.length,
        sports: [...new Set(picks.map(p => p.sport))],
      }, {
        headers: {
          'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
        },
      })
    }

    // Free users: redact premium fields
    const redactedPicks = picks.map(p => ({
      id: p.id,
      sport: p.sport,
      sportEmoji: p.sportEmoji,
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
      league: p.league,
      kickoff: p.kickoff,
      tier: p.tier,
      starRating: p.starRating,
      slug: p.slug,
      // These are hidden for free users
      pick: '🔒',
      pickTeam: '🔒',
      confidence: 0,
      reasons: ['Upgrade to premium to see pick details'],
      matchId: p.matchId,
    }))

    return NextResponse.json({
      success: true,
      isPremium: false,
      picks: redactedPicks,
      total: picks.length,
      sports: [...new Set(picks.map(p => p.sport))],
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('[SnapBet Picks API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch picks' },
      { status: 500 }
    )
  }
}
