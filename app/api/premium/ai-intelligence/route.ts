import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { hasPremiumAccess } from '@/lib/premium-access'

/**
 * GET /api/premium/ai-intelligence - Generate AI betting intelligence
 * Analyzes user's betting patterns and provides insights
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check premium access
    const hasAccess = await hasPremiumAccess()
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Premium subscription required' },
        { status: 403 }
      )
    }

    const userId = session.user.id

    // Fetch user's betting data and live opportunities
    const [purchases, userPredictions, parlayPurchases, clvOpportunities, activeParlays] = await Promise.all([
      prisma.purchase.findMany({
        where: { userId, status: 'completed' },
        include: {
          quickPurchase: {
            select: {
              price: true,
              predictionData: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Last 100 purchases for analysis
      }),
      prisma.userPrediction.findMany({
        where: { userId },
        include: {
          prediction: {
            select: {
              confidenceScore: true,
              valueRating: true,
              status: true,
              match: {
                select: {
                  league: {
                    select: { name: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { placedAt: 'desc' },
        take: 100,
      }),
      prisma.parlayPurchase.findMany({
        where: { userId, status: { in: ['completed', 'won', 'lost'] } },
        include: {
          parlay: {
            select: {
              edgePct: true,
              confidenceTier: true,
            }
          }
        },
        orderBy: { purchasedAt: 'desc' },
        take: 50,
      }),
      // Fetch top CLV opportunities (rolling data)
      fetch(`${process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'}/clv/club/opportunities?limit=5`, {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'}`,
        },
      }).then(res => res.ok ? res.json().then(data => data.items || data.opportunities || []).catch(() => []) : []).catch(() => []),
      // Fetch active parlays (rolling data)
      prisma.parlayConsensus.findMany({
        where: { status: 'active' },
        include: {
          legs: {
            orderBy: { legOrder: 'asc' },
            take: 3, // Limit to first 3 legs for preview
          },
        },
        orderBy: { edgePct: 'desc' },
        take: 5, // Top 5 parlays
      }),
    ])

    // Calculate performance metrics
    const totalBets = purchases.length + userPredictions.length + parlayPurchases.length
    
    if (totalBets === 0) {
      return NextResponse.json({
        overallScore: 0,
        insights: [],
        recommendations: [
          "Start placing bets to get personalized AI insights",
          "Try our premium predictions for higher confidence picks",
          "Explore CLV opportunities for better value bets"
        ],
        performanceSummary: {
          totalBets: 0,
          winRate: 0,
          roi: 0,
          avgStake: 0,
        },
        generatedAt: new Date().toISOString(),
      })
    }

    // Analyze purchases
    const completedPurchases = purchases.filter(p => p.status === 'completed')
    const totalSpent = completedPurchases.reduce((sum, p) => sum + Number(p.amount), 0)
    const avgStake = totalSpent / completedPurchases.length || 0

    // Analyze predictions
    const settledPredictions = userPredictions.filter(p => 
      p.status === 'won' || p.status === 'lost'
    )
    const wonPredictions = settledPredictions.filter(p => p.status === 'won')
    const winRate = settledPredictions.length > 0 
      ? (wonPredictions.length / settledPredictions.length) * 100 
      : 0

    // Calculate ROI
    const totalReturn = settledPredictions.reduce((sum, p) => 
      sum + (p.actualReturn ? Number(p.actualReturn) : 0), 0
    )
    const roi = totalSpent > 0 ? ((totalReturn - totalSpent) / totalSpent) * 100 : 0

    // League performance analysis
    const leagueStats = new Map<string, { wins: number; total: number }>()
    settledPredictions.forEach(p => {
      const leagueName = p.prediction.match?.league?.name || 'Unknown'
      const stats = leagueStats.get(leagueName) || { wins: 0, total: 0 }
      stats.total++
      if (p.status === 'won') stats.wins++
      leagueStats.set(leagueName, stats)
    })

    let bestLeague: string | undefined
    let worstLeague: string | undefined
    let bestWinRate = 0
    let worstWinRate = 100

    leagueStats.forEach((stats, league) => {
      const winRate = (stats.wins / stats.total) * 100
      if (stats.total >= 3) { // Only consider leagues with 3+ bets
        if (winRate > bestWinRate) {
          bestWinRate = winRate
          bestLeague = league
        }
        if (winRate < worstWinRate) {
          worstWinRate = winRate
          worstLeague = league
        }
      }
    })

    // Generate insights
    const insights: any[] = []
    const recommendations: string[] = []

    // Win rate insight
    if (winRate >= 60) {
      insights.push({
        type: "strength",
        title: "Strong Win Rate",
        description: `Your win rate of ${winRate.toFixed(1)}% is above average. Keep up the good work!`,
        recommendation: "Consider increasing stake sizes on your most confident picks"
      })
    } else if (winRate < 40) {
      insights.push({
        type: "weakness",
        title: "Low Win Rate",
        description: `Your win rate of ${winRate.toFixed(1)}% needs improvement. Focus on higher confidence picks.`,
        recommendation: "Use our CLV tracker to find better value opportunities"
      })
      recommendations.push("Focus on predictions with confidence scores above 70%")
    }

    // ROI insight
    if (roi > 10) {
      insights.push({
        type: "strength",
        title: "Positive ROI",
        description: `Your ROI of ${roi.toFixed(1)}% shows profitable betting. Excellent work!`,
        recommendation: "Consider scaling up your betting activity"
      })
    } else if (roi < -10) {
      insights.push({
        type: "warning",
        title: "Negative ROI",
        description: `Your ROI of ${roi.toFixed(1)}% indicates losses. Review your betting strategy.`,
        recommendation: "Use our risk calculator to optimize stake sizes"
      })
      recommendations.push("Review your betting patterns and focus on value bets")
    }

    // League performance
    if (bestLeague) {
      insights.push({
        type: "opportunity",
        title: "Best Performing League",
        description: `${bestLeague} shows a ${bestWinRate.toFixed(1)}% win rate.`,
        recommendation: `Consider focusing more bets on ${bestLeague} matches`
      })
    }

    if (worstLeague && worstWinRate < 40) {
      insights.push({
        type: "warning",
        title: "League to Avoid",
        description: `${worstLeague} shows only ${worstWinRate.toFixed(1)}% win rate.`,
        recommendation: `Reduce betting on ${worstLeague} or improve your analysis`
      })
    }

    // Parlay performance
    const settledParlays = parlayPurchases.filter(p => 
      p.status === 'won' || p.status === 'lost'
    )
    if (settledParlays.length > 0) {
      const parlayWinRate = (settledParlays.filter(p => p.status === 'won').length / settledParlays.length) * 100
      if (parlayWinRate < 20) {
        insights.push({
          type: "warning",
          title: "Parlay Performance",
          description: `Your parlay win rate is ${parlayWinRate.toFixed(1)}%. Parlays are high-risk.`,
          recommendation: "Use our AI Parlays feature for better parlay recommendations"
        })
      }
    }

    // Generate overall score (0-100)
    let score = 50 // Base score
    score += Math.min(30, winRate * 0.5) // Win rate contribution (max 30 points)
    score += Math.min(20, Math.max(-20, roi)) // ROI contribution (max 20, min -20)
    score = Math.max(0, Math.min(100, score)) // Clamp to 0-100

    // Additional recommendations
    if (totalBets < 10) {
      recommendations.push("Place more bets to get more accurate insights")
    }
    if (avgStake > 100) {
      recommendations.push("Consider using Kelly Criterion for optimal stake sizing")
    }
    if (roi > 0 && winRate > 50) {
      recommendations.push("Your strategy is working! Consider increasing your bankroll allocation")
    }

    return NextResponse.json({
      overallScore: Math.round(score),
      insights: insights.slice(0, 6), // Limit to 6 insights
      recommendations: recommendations.length > 0 ? recommendations : [
        "Continue tracking your performance",
        "Use premium features for better insights",
        "Focus on value bets with positive expected value"
      ],
      performanceSummary: {
        totalBets,
        winRate: Math.round(winRate * 10) / 10,
        roi: Math.round(roi * 10) / 10,
        avgStake: Math.round(avgStake * 100) / 100,
        bestPerformingLeague: bestLeague,
        worstPerformingLeague: worstLeague,
      },
      rollingData: {
        clvOpportunities: clvOpportunities.map((opp: any) => ({
          alert_id: opp.alert_id,
          match_id: opp.match_id,
          home_team: opp.home_team,
          away_team: opp.away_team,
          league: opp.league,
          outcome: opp.outcome === 'H' ? 'Home Win' : opp.outcome === 'D' ? 'Draw' : 'Away Win',
          entry_odds: opp.best_odds || 0,
          consensus_odds: opp.market_composite_odds || 0,
          clv_pct: opp.clv_pct || 0,
          confidence_score: opp.confidence_score || 0,
          books_used: opp.books_used || 0,
          expires_at: opp.expires_at,
        })),
        activeParlays: activeParlays.map((parlay) => ({
          parlay_id: parlay.parlayId,
          leg_count: parlay.legCount,
          edge_pct: Number(parlay.edgePct),
          implied_odds: Number(parlay.impliedOdds),
          win_probability: Number(parlay.adjustedProb) * 100,
          confidence_tier: parlay.confidenceTier,
          legs: parlay.legs.map((leg) => ({
            leg_order: leg.legOrder,
            home_team: leg.homeTeam,
            away_team: leg.awayTeam,
            outcome: leg.outcome === 'H' ? 'Home Win' : leg.outcome === 'A' ? 'Away Win' : 'Draw',
            edge: Number(leg.edge) * 100,
            odds: Number(leg.decimalOdds),
            model_prob: Number(leg.modelProb) * 100,
          })),
        })),
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating AI intelligence:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI intelligence', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

