import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPremiumAccess } from '@/lib/premium-access'
import prisma from '@/lib/db'

/**
 * GET /api/premium/suggested-parlays
 * Get suggested parlays (Conservative and Aggressive)
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

    // Fetch active parlays from database
    const parlays = await prisma.parlayConsensus.findMany({
      where: { status: 'active' },
      include: {
        legs: {
          orderBy: { legOrder: 'asc' },
        },
      },
      orderBy: { edgePct: 'desc' },
      take: 20,
    })

    // Conservative: Lower edge but higher win probability (2-3 legs, edge 10-20%)
    const conservative = parlays
      .filter(p => p.legCount <= 3 && Number(p.edgePct) >= 10 && Number(p.edgePct) <= 20)
      .sort((a, b) => Number(b.adjustedProb) - Number(a.adjustedProb))[0]

    // Aggressive: Higher edge but lower win probability (3+ legs, edge 20%+)
    const aggressive = parlays
      .filter(p => p.legCount >= 3 && Number(p.edgePct) >= 20)
      .sort((a, b) => Number(b.edgePct) - Number(a.edgePct))[0]

    return NextResponse.json({
      conservative: conservative ? {
        parlay_id: conservative.parlayId,
        leg_count: conservative.legCount,
        edge_pct: Number(conservative.edgePct),
        ev_prob: Number(conservative.adjustedProb) * 100,
        implied_odds: Number(conservative.impliedOdds),
      } : null,
      aggressive: aggressive ? {
        parlay_id: aggressive.parlayId,
        leg_count: aggressive.legCount,
        edge_pct: Number(aggressive.edgePct),
        ev_prob: Number(aggressive.adjustedProb) * 100,
        implied_odds: Number(aggressive.impliedOdds),
      } : null,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching suggested parlays:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggested parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


