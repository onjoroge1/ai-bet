import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPremiumAccess } from '@/lib/premium-access'
import prisma from '@/lib/db'

/**
 * POST /api/premium/ai-intelligence/parlay-analysis
 * Generate detailed AI trading analysis for parlays
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { parlay_id } = body

    if (!parlay_id) {
      return NextResponse.json(
        { error: 'parlay_id required' },
        { status: 400 }
      )
    }

    // Fetch parlay from database
    const parlay = await prisma.parlayConsensus.findUnique({
      where: { parlayId: parlay_id },
      include: {
        legs: {
          orderBy: { legOrder: 'asc' },
        },
        performance: true,
      },
    })

    if (!parlay) {
      return NextResponse.json(
        { error: 'Parlay not found' },
        { status: 404 }
      )
    }

    // Generate AI analysis
    const analysis = generateParlayAnalysis(parlay)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error generating parlay analysis:', error)
    return NextResponse.json(
      { error: 'Failed to generate parlay analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function generateParlayAnalysis(parlay: any) {
  const edgePct = Number(parlay.edgePct)
  const impliedOdds = Number(parlay.impliedOdds)
  const adjustedProb = Number(parlay.adjustedProb)
  const correlationPenalty = Number(parlay.correlationPenalty)
  const confidenceTier = parlay.confidenceTier
  const legCount = parlay.legCount
  const legs = parlay.legs || []

  // Determine edge tier
  const edgeTier = edgePct >= 25 ? 'Excellent Edge' :
                   edgePct >= 15 ? 'Strong Edge' :
                   edgePct >= 10 ? 'Good Edge' :
                   edgePct >= 5 ? 'Moderate Edge' :
                   'Weak Edge'

  // Calculate win probability
  const winProbability = adjustedProb * 100

  // Analyze legs
  const legAnalysis = legs.map((leg: any, index: number) => ({
    leg_number: index + 1,
    match: {
      home_team: leg.homeTeam,
      away_team: leg.awayTeam,
      match_id: leg.matchId,
    },
    outcome: leg.outcome === 'H' ? 'Home Win' : leg.outcome === 'A' ? 'Away Win' : 'Draw',
    edge: Number(leg.edge) * 100,
    odds: Number(leg.decimalOdds).toFixed(2),
    model_prob: Number(leg.modelProb) * 100,
    strength: Number(leg.edge) >= 0.3 ? 'Strong' : Number(leg.edge) >= 0.1 ? 'Moderate' : 'Weak',
  }))

  // Identify weakest leg
  const weakestLeg = legAnalysis.reduce((min: any, leg: any) => 
    leg.edge < min.edge ? leg : min, legAnalysis[0]
  )

  // Identify strongest leg
  const strongestLeg = legAnalysis.reduce((max: any, leg: any) => 
    leg.edge > max.edge ? leg : max, legAnalysis[0]
  )

  // Generate analysis
  const analysis = {
    parlay: {
      id: parlay.parlayId,
      leg_count: legCount,
      edge_pct: edgePct.toFixed(2),
      edge_tier: edgeTier,
      implied_odds: impliedOdds.toFixed(2),
      win_probability: winProbability.toFixed(1),
      confidence_tier: confidenceTier,
      correlation_penalty: (correlationPenalty * 100).toFixed(1),
      parlay_type: parlay.parlayType,
      league_group: parlay.leagueGroup,
    },
    legs: legAnalysis,
    leg_analysis: {
      strongest_leg: strongestLeg,
      weakest_leg: weakestLeg,
      average_leg_edge: (legAnalysis.reduce((sum: number, leg: any) => sum + leg.edge, 0) / legCount).toFixed(2),
      leg_consistency: legAnalysis.every((leg: any) => leg.edge >= 0.1) ? 'Consistent' : 'Mixed',
    },
    trading_analysis: {
      verdict: edgePct >= 25 ? 'STRONG_BUY' :
               edgePct >= 15 ? 'BUY' :
               edgePct >= 10 ? 'CONSIDER' :
               'WEAK',
      rationale: generateParlayRationale(edgePct, winProbability, legCount, correlationPenalty, confidenceTier),
      execution_plan: generateParlayExecutionPlan(edgePct, winProbability, legCount, impliedOdds),
      risk_assessment: generateParlayRiskAssessment(edgePct, winProbability, legCount, correlationPenalty, weakestLeg),
      portfolio_guidance: generateParlayPortfolioGuidance(edgePct, legCount),
    },
    recommendations: generateParlayRecommendations(edgePct, winProbability, legCount, weakestLeg),
    warnings: generateParlayWarnings(edgePct, winProbability, legCount, correlationPenalty),
    metadata: {
      api_version: parlay.apiVersion,
      created_at: parlay.createdAt,
      generated_at: new Date().toISOString(),
    },
  }

  return analysis
}

function generateParlayRationale(edgePct: number, winProb: number, legCount: number, correlationPenalty: number, confidenceTier: string): string {
  const parts: string[] = []

  if (edgePct >= 25) {
    parts.push(`+${edgePct.toFixed(1)}% edge is exceptional for a ${legCount}-leg parlay.`)
  } else if (edgePct >= 15) {
    parts.push(`+${edgePct.toFixed(1)}% edge is strong for a ${legCount}-leg parlay.`)
  } else if (edgePct >= 10) {
    parts.push(`+${edgePct.toFixed(1)}% edge is moderate but playable.`)
  } else {
    parts.push(`+${edgePct.toFixed(1)}% edge is thin for a ${legCount}-leg parlay.`)
  }

  parts.push(`Win probability: ${winProb.toFixed(1)}% (after correlation adjustment).`)

  if (correlationPenalty > 0.15) {
    parts.push(`High correlation penalty (${(correlationPenalty * 100).toFixed(0)}%) - legs are correlated, reducing true edge.`)
  } else if (correlationPenalty < 0.05) {
    parts.push(`Low correlation penalty (${(correlationPenalty * 100).toFixed(0)}%) - legs are relatively independent.`)
  }

  if (confidenceTier === 'high') {
    parts.push(`High confidence tier supports this parlay.`)
  } else if (confidenceTier === 'low') {
    parts.push(`Lower confidence tier - higher variance expected.`)
  }

  return parts.join(' ')
}

function generateParlayExecutionPlan(edgePct: number, winProb: number, legCount: number, impliedOdds: number) {
  const plan: any = {
    entry: {
      action: edgePct >= 15 ? 'Take the parlay' : edgePct >= 10 ? 'Consider as part of portfolio' : 'Skip or minimal stake',
      stake_size: generateParlayStakeSize(edgePct, winProb, legCount),
      notes: [],
    },
    management: {
      monitor_legs: true,
      early_cashout: legCount >= 3 ? 'Consider if first legs win' : 'Not recommended',
      notes: [],
    },
    exit_philosophy: 'Parlays are all-or-nothing. Accept variance and focus on long-term edge.',
  }

  // Entry notes
  if (edgePct >= 25) {
    plan.entry.notes.push('This is a premium parlay opportunity')
    plan.entry.notes.push('Stake size: 0.5-1.0% of bankroll (parlay-appropriate)')
  } else if (edgePct >= 15) {
    plan.entry.notes.push('Good parlay opportunity')
    plan.entry.notes.push('Stake size: 0.25-0.5% of bankroll')
  } else {
    plan.entry.notes.push('Thin edge - stake conservatively')
    plan.entry.notes.push('Stake size: 0.1-0.25% of bankroll')
  }

  // Management notes
  if (legCount >= 3) {
    plan.management.notes.push('Monitor each leg as matches progress')
    plan.management.notes.push('If early legs win, consider if cashout is available')
  } else {
    plan.management.notes.push('2-leg parlay - simpler to track')
  }

  return plan
}

function generateParlayStakeSize(edgePct: number, winProb: number, legCount: number): string {
  // Parlays should be staked smaller than singles due to variance
  const baseStake = edgePct >= 25 ? 0.01 : edgePct >= 15 ? 0.0075 : edgePct >= 10 ? 0.005 : 0.0025
  
  // Adjust for leg count (more legs = smaller stake)
  const legMultiplier = legCount === 2 ? 1.0 : legCount === 3 ? 0.75 : 0.5
  
  const stakePercent = (baseStake * legMultiplier * 100).toFixed(2)
  
  return `${stakePercent}% of bankroll (${(baseStake * legMultiplier).toFixed(3)} units)`
}

function generateParlayRiskAssessment(edgePct: number, winProb: number, legCount: number, correlationPenalty: number, weakestLeg: any) {
  const risks: string[] = []
  const mitigations: string[] = []

  risks.push(`${legCount}-leg parlay means all legs must win - high variance`)
  mitigations.push('Stake size should be smaller than single bets')

  if (winProb < 10) {
    risks.push('Low win probability means high variance')
    mitigations.push('Only stake what you can afford to lose')
  }

  if (correlationPenalty > 0.15) {
    risks.push('High correlation between legs reduces true edge')
    mitigations.push('Consider if legs are truly independent')
  }

  if (weakestLeg && weakestLeg.edge < 0.1) {
    risks.push(`Weak leg (${weakestLeg.match.home_team} vs ${weakestLeg.match.away_team}) reduces overall edge`)
    mitigations.push('Consider if this leg is necessary for the parlay')
  }

  return {
    risk_level: legCount >= 4 ? 'HIGH' : legCount === 3 ? 'MODERATE' : 'MODERATE_LOW',
    risks,
    mitigations,
  }
}

function generateParlayPortfolioGuidance(edgePct: number, legCount: number) {
  const guidance: any = {
    allocation: edgePct >= 25 ? 'HIGH_PRIORITY' : edgePct >= 15 ? 'MEDIUM_PRIORITY' : 'LOW_PRIORITY',
    notes: [],
    do_not: [],
  }

  if (edgePct >= 25) {
    guidance.notes.push('Allocate 20-30% of daily parlay budget to this play')
    guidance.notes.push('This is a premium parlay opportunity')
  } else if (edgePct >= 15) {
    guidance.notes.push('Allocate 10-20% of daily parlay budget')
    guidance.notes.push('Good parlay for portfolio diversification')
  } else {
    guidance.notes.push('Allocate 5-10% of daily parlay budget')
    guidance.notes.push('Only if building parlay volume strategy')
  }

  guidance.do_not.push('Do not stake more than 1% of bankroll on any single parlay')
  guidance.do_not.push('Do not parlay this with other parlays (compounds variance)')
  guidance.do_not.push('Do not judge success by individual wins - focus on long-term edge')

  return guidance
}

function generateParlayRecommendations(edgePct: number, winProb: number, legCount: number, weakestLeg: any): string[] {
  const recommendations: string[] = []

  if (edgePct >= 25) {
    recommendations.push('✅ Strong parlay - take it')
    recommendations.push('✅ Excellent edge for a parlay')
  } else if (edgePct >= 15) {
    recommendations.push('✅ Good parlay opportunity')
    recommendations.push('✅ Acceptable as part of parlay portfolio')
  } else if (edgePct >= 10) {
    recommendations.push('⚠️ Borderline parlay')
    recommendations.push('⚠️ Only if building volume strategy')
  } else {
    recommendations.push('❌ Weak edge - consider skipping')
    recommendations.push('❌ Thin edge may not overcome parlay variance')
  }

  if (weakestLeg && weakestLeg.edge < 0.1) {
    recommendations.push(`⚠️ Weak leg detected: ${weakestLeg.match.home_team} vs ${weakestLeg.match.away_team}`)
    recommendations.push('⚠️ Consider if this leg is necessary')
  }

  if (winProb < 10) {
    recommendations.push('⚠️ Low win probability - accept high variance')
  }

  return recommendations
}

function generateParlayWarnings(edgePct: number, winProb: number, legCount: number, correlationPenalty: number): string[] {
  const warnings: string[] = []

  warnings.push(`⚠️ ${legCount}-leg parlay means all legs must win - this is variance-heavy`)
  
  if (winProb < 15) {
    warnings.push('⚠️ Low win probability means you will lose most of the time')
  }

  if (correlationPenalty > 0.15) {
    warnings.push('⚠️ High correlation penalty reduces true edge')
  }

  warnings.push('❌ Do not over-stake on parlays - they are high variance')
  warnings.push('❌ Do not judge success by individual wins - focus on long-term edge')
  warnings.push('❌ Do not add more legs to "increase odds" - this reduces edge')

  return warnings
}

