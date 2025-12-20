import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPremiumAccess } from '@/lib/premium-access'
import prisma from '@/lib/db'

/**
 * GET /api/premium/dashboard-stats
 * Get dashboard KPIs: +EV Today, Avg CLV (7d), Win Rate, Active Matches
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

    const userId = session.user.id
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const todayStart = new Date(now.setHours(0, 0, 0, 0))

    // Fetch user's betting data
    const [purchases, userPredictions, clvOpportunities] = await Promise.all([
      // Purchases from today
      prisma.purchase.findMany({
        where: {
          userId,
          status: 'completed',
          createdAt: { gte: todayStart },
        },
        include: {
          quickPurchase: {
            select: { predictionData: true },
          },
        },
      }),
      // User predictions for win rate calculation
      prisma.userPrediction.findMany({
        where: { userId },
        include: {
          prediction: {
            select: {
              confidenceScore: true,
              valueRating: true,
              status: true,
            },
          },
        },
      }),
      // CLV opportunities for today
      fetch(`${process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'}/clv/club/opportunities?limit=100`, {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'}`,
        },
      }).then(res => res.ok ? res.json().then(data => data.items || data.opportunities || []).catch(() => []) : []).catch(() => []),
    ])

    // Calculate +EV Today (bets with positive EV)
    const evBetsToday = purchases.filter(p => {
      const predictionData = p.quickPurchase?.predictionData as any
      if (predictionData && predictionData.valueRating) {
        return predictionData.valueRating > 0
      }
      return false
    })

    // Calculate Win Rate
    const settledPredictions = userPredictions.filter(p => 
      p.status === 'won' || p.status === 'lost'
    )
    const wonPredictions = settledPredictions.filter(p => p.status === 'won')
    const winRate = settledPredictions.length > 0
      ? (wonPredictions.length / settledPredictions.length) * 100
      : 0

    // Calculate Avg CLV (7d) - from CLV opportunities
    const clvValues = clvOpportunities
      .filter((opp: any) => opp.clv_pct && opp.clv_pct > 0)
      .map((opp: any) => opp.clv_pct)
    
    const avgCLV = clvValues.length > 0
      ? clvValues.reduce((sum: number, val: number) => sum + val, 0) / clvValues.length
      : 0

    // Active Matches (from CLV opportunities or active predictions)
    const activeMatches = new Set([
      ...clvOpportunities.map((opp: any) => opp.match_id),
      ...userPredictions
        .filter(p => p.status === 'pending' || p.status === 'active')
        .map(p => p.prediction?.matchId)
        .filter(Boolean),
    ]).size

    return NextResponse.json({
      evBetsToday: evBetsToday.length,
      avgCLV7d: avgCLV,
      winRate: Math.round(winRate * 10) / 10,
      activeMatches,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

