import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPremiumAccess } from '@/lib/premium-access'
import { calculateCLV, type CLVCalculation } from '@/lib/clv-calculator'

/**
 * POST /api/premium/ai-intelligence/clv-analysis
 * Generate detailed AI trading analysis for CLV opportunities
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
    const { alert_id, match_id } = body

    if (!alert_id && !match_id) {
      return NextResponse.json(
        { error: 'alert_id or match_id required' },
        { status: 400 }
      )
    }

    // Fetch CLV opportunity
    const clvResponse = await fetch(
      `${process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'}/clv/club/opportunities`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'}`,
        },
      }
    )

    if (!clvResponse.ok) {
      throw new Error('Failed to fetch CLV opportunities')
    }

    const clvData = await clvResponse.json()
    const opportunities = clvData.items || clvData.opportunities || []
    
    const opportunity = opportunities.find((opp: any) => 
      opp.alert_id === alert_id || opp.match_id === parseInt(match_id)
    )

    if (!opportunity) {
      return NextResponse.json(
        { error: 'CLV opportunity not found' },
        { status: 404 }
      )
    }

    // Generate AI analysis
    const analysis = generateCLVAnalysis(opportunity)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error generating CLV analysis:', error)
    return NextResponse.json(
      { error: 'Failed to generate CLV analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function generateCLVAnalysis(opportunity: any) {
  const entryOdds = opportunity.best_odds || 0
  const closeOdds = opportunity.market_composite_odds || 0
  const clvPct = opportunity.clv_pct || 0
  const booksUsed = opportunity.books_used || 0
  const bestBookId = opportunity.best_book_id || ''
  const window = opportunity.window || ''
  const expiresAt = opportunity.expires_at || ''
  
  const calc = calculateCLV(entryOdds, closeOdds)
  const confidence = calc.confidence
  const evPercent = calc.evPercent

  // Determine outcome label
  const outcomeLabel = opportunity.outcome === 'H' ? 'Home Win' :
                      opportunity.outcome === 'D' ? 'Draw' :
                      'Away Win'

  // Determine edge tier
  const edgeTier = clvPct >= 5 ? 'Excellent Edge' :
                   clvPct >= 3 ? 'Strong Edge' :
                   clvPct >= 2 ? 'Good Edge' :
                   clvPct >= 1 ? 'Moderate Edge' :
                   'Weak Edge'

  // Determine confidence tier
  const confidenceTier = confidence >= 80 ? 'High Confidence' :
                         confidence >= 60 ? 'Moderate Confidence' :
                         confidence >= 40 ? 'Low Confidence' :
                         'Very Low Confidence'

  // Determine if exchange available (betfair, smarkets, etc.)
  const isExchange = bestBookId.toLowerCase().includes('betfair') ||
                     bestBookId.toLowerCase().includes('smarkets') ||
                     bestBookId.toLowerCase().includes('exchange')

  // Generate trading analysis
  const analysis = {
    match: {
      id: opportunity.match_id,
      home_team: opportunity.home_team || 'Home Team',
      away_team: opportunity.away_team || 'Away Team',
      league: opportunity.league || 'Unknown League',
      description: opportunity.match_description || `${opportunity.home_team} vs ${opportunity.away_team}`,
    },
    market: {
      outcome: outcomeLabel,
      entry_odds: entryOdds.toFixed(2),
      consensus_odds: closeOdds.toFixed(2),
      clv_pct: clvPct.toFixed(2),
      edge_tier: edgeTier,
      confidence_score: confidence,
      confidence_tier: confidenceTier,
      ev_percent: evPercent.toFixed(2),
    },
    liquidity: {
      books_used: booksUsed,
      best_book: bestBookId,
      is_exchange: isExchange,
      has_exit_optionality: isExchange,
    },
    trading_analysis: {
      verdict: clvPct >= 5 ? 'STRONG_BUY' :
               clvPct >= 3 ? 'BUY' :
               clvPct >= 2 ? 'CONSIDER' :
               'WEAK',
      rationale: generateRationale(clvPct, confidence, booksUsed, isExchange),
      execution_plan: generateExecutionPlan(clvPct, confidence, isExchange, calc),
      risk_assessment: generateRiskAssessment(clvPct, confidence, entryOdds),
      portfolio_guidance: generatePortfolioGuidance(clvPct, confidence),
    },
    recommendations: generateRecommendations(clvPct, confidence, isExchange, opportunity),
    warnings: generateWarnings(clvPct, confidence, entryOdds, opportunity),
    metadata: {
      window,
      expires_at: expiresAt,
      generated_at: new Date().toISOString(),
    },
  }

  return analysis
}

function generateRationale(clvPct: number, confidence: number, booksUsed: number, isExchange: boolean): string {
  const parts: string[] = []

  if (clvPct >= 5) {
    parts.push(`+${clvPct.toFixed(2)}% CLV is elite - this is top-decile edge.`)
  } else if (clvPct >= 3) {
    parts.push(`+${clvPct.toFixed(2)}% CLV represents a strong edge.`)
  } else if (clvPct >= 2) {
    parts.push(`+${clvPct.toFixed(2)}% CLV is real but moderate.`)
  } else {
    parts.push(`+${clvPct.toFixed(2)}% CLV is thin - consider carefully.`)
  }

  if (booksUsed >= 20) {
    parts.push(`${booksUsed} books confirms price inefficiency, not a one-off glitch.`)
  } else if (booksUsed >= 10) {
    parts.push(`${booksUsed} books provides reasonable market consensus.`)
  } else {
    parts.push(`Only ${booksUsed} books - limited market confirmation.`)
  }

  if (isExchange) {
    parts.push(`Exchange liquidity gives you optionality to exit if needed.`)
  }

  if (confidence >= 80) {
    parts.push(`High confidence score (${confidence}/100) supports this play.`)
  } else if (confidence < 50) {
    parts.push(`Lower confidence score (${confidence}/100) means more variance.`)
  }

  return parts.join(' ')
}

function generateExecutionPlan(clvPct: number, confidence: number, isExchange: boolean, calc: any) {
  const plan: any = {
      entry: {
        action: clvPct >= 3 ? 'Take the bet immediately' : 'Consider as part of portfolio',
        stake_size: generateStakeSize(clvPct, confidence),
        notes: [],
      },
      management: {
        monitor_price: true,
        target_compression: (parseFloat(entryOdds.toString()) * 0.95).toFixed(2),
        exit_options: [],
      },
    exit_philosophy: 'You are paid by closing line, not the result. Over 100 bets like this, this edge compounds.',
  }

  // Entry notes
  if (clvPct >= 5) {
    plan.entry.notes.push('This is a pure CLV capture play, not a conviction bet.')
    plan.entry.notes.push('Think small-to-moderate stake (0.5-1.0 units), not Kelly-max.')
  } else if (clvPct >= 2) {
    plan.entry.notes.push('Acceptable as part of volume strategy.')
    plan.entry.notes.push('Stake conservatively (0.25-0.5 units max).')
  }

  // Management options
  if (isExchange) {
    plan.management.exit_options.push('Trade out partially on exchange to lock profit if liquidity allows')
    plan.management.exit_options.push('Let it ride if part of long-run CLV portfolio')
  } else {
    plan.management.exit_options.push('Monitor until kickoff - no exit option available')
  }

  return plan
}

function generateStakeSize(clvPct: number, confidence: number): string {
  if (clvPct >= 5 && confidence >= 80) {
    return '0.75-1.0 units (moderate)'
  } else if (clvPct >= 3 && confidence >= 60) {
    return '0.5-0.75 units (small-to-moderate)'
  } else if (clvPct >= 2) {
    return '0.25-0.5 units (small)'
  } else {
    return '0.1-0.25 units (minimal)'
  }
}

function generateRiskAssessment(clvPct: number, confidence: number, entryOdds: number) {
  const risks: string[] = []
  const mitigations: string[] = []

  if (entryOdds > 5) {
    risks.push('High variance - long odds mean lower win probability')
    mitigations.push('Keep stake size small relative to bankroll')
  }

  if (confidence < 50) {
    risks.push('Lower confidence means more noise in the data')
    mitigations.push('Only include as part of diversified portfolio')
  }

  if (clvPct < 2) {
    risks.push('Thin edge may not overcome variance')
    mitigations.push('Requires large sample size to realize edge')
  }

  return {
    risk_level: clvPct >= 5 ? 'LOW' : clvPct >= 3 ? 'MODERATE' : 'HIGH',
    risks,
    mitigations,
  }
}

function generatePortfolioGuidance(clvPct: number, confidence: number) {
  const guidance: any = {
    allocation: clvPct >= 5 ? 'HIGH_PRIORITY' : clvPct >= 3 ? 'MEDIUM_PRIORITY' : 'LOW_PRIORITY',
    notes: [],
    do_not: [],
  }

  if (clvPct >= 5) {
    guidance.notes.push('Allocate 60-70% of daily CLV stake budget to this play')
    guidance.notes.push('This is a core CLV capture opportunity')
  } else if (clvPct >= 3) {
    guidance.notes.push('Allocate 30-40% of daily CLV stake budget')
    guidance.notes.push('Good filler for CLV portfolio')
  } else {
    guidance.notes.push('Allocate 10-20% of daily CLV stake budget')
    guidance.notes.push('Only if building volume strategy')
  }

  guidance.do_not.push('Do not over-stake because it "feels safer"')
  guidance.do_not.push('Do not judge success by wins/losses - CLV is about closing line')
  guidance.do_not.push('Do not parlay with other CLV bets (increases variance)')

  return guidance
}

function generateRecommendations(clvPct: number, confidence: number, isExchange: boolean, opportunity: any): string[] {
  const recommendations: string[] = []

  if (clvPct >= 5) {
    recommendations.push('✅ Strong CLV bet - take it immediately')
    recommendations.push('✅ Textbook CLV play - this is what you want')
  } else if (clvPct >= 3) {
    recommendations.push('✅ Good CLV opportunity - acceptable play')
    recommendations.push('✅ Include in CLV portfolio for diversification')
  } else if (clvPct >= 2) {
    recommendations.push('⚠️ Borderline but playable')
    recommendations.push('⚠️ Only if building volume strategy')
  } else {
    recommendations.push('❌ Weak edge - consider skipping')
    recommendations.push('❌ Requires very large sample to realize edge')
  }

  if (isExchange) {
    recommendations.push('💡 Monitor price movement - exit option available if needed')
  }

  if (confidence >= 80) {
    recommendations.push('💡 High confidence supports this play')
  } else if (confidence < 50) {
    recommendations.push('⚠️ Lower confidence - accept higher variance')
  }

  return recommendations
}

function generateWarnings(clvPct: number, confidence: number, entryOdds: number, opportunity: any): string[] {
  const warnings: string[] = []

  if (entryOdds > 5) {
    warnings.push('⚠️ High odds mean lower win probability - this is variance-heavy')
  }

  if (confidence < 50) {
    warnings.push('⚠️ Lower confidence score means more noise in the data')
  }

  if (clvPct < 2) {
    warnings.push('⚠️ Thin edge may not overcome variance in short term')
  }

  warnings.push('❌ Do not chase narrative - this is a CLV play, not a conviction bet')
  warnings.push('❌ Do not increase stake because "one feels safer"')

  return warnings
}

