import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPremiumAccess } from '@/lib/premium-access'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/premium/ai-intelligence/clv-openai
 * Generate OpenAI-powered CLV trading analysis
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { clvOpportunities, bankrollUnits = 100 } = body

    if (!clvOpportunities || !Array.isArray(clvOpportunities) || clvOpportunities.length === 0) {
      return NextResponse.json(
        { error: 'CLV opportunities array required' },
        { status: 400 }
      )
    }

    // Transform CLV opportunities to the format expected by OpenAI
    const bets = clvOpportunities.map((opp: any) => {
      const entryOdds = opp.best_odds || opp.entry_odds || 0
      const consensusOdds = opp.market_composite_odds || opp.consensus_odds || 0
      const clvPct = opp.clv_pct || 0
      const evPct = clvPct // Assuming CLV% = EV% for now
      const edgeScore = opp.confidence_score || opp.edge_score || 0
      const booksCount = opp.books_used || opp.books_count || 0
      const bestBook = opp.best_book_id || opp.book || 'unknown'
      
      // Calculate time to expiry (if expires_at is provided)
      let timeToExpiryMinutes = 60 // Default
      if (opp.expires_at) {
        const expiry = new Date(opp.expires_at)
        const now = new Date()
        const diffMs = expiry.getTime() - now.getTime()
        timeToExpiryMinutes = Math.max(0, Math.floor(diffMs / 60000))
      }

      const outcome = opp.outcome === 'H' ? 'Home Win' : 
                     opp.outcome === 'D' ? 'Draw' : 'Away Win'

      return {
        match: `${opp.home_team || 'Home'} vs ${opp.away_team || 'Away'}`,
        match_id: opp.match_id,
        league_id: opp.league_id || 0,
        market: outcome,
        price_offered: entryOdds,
        price_fair: consensusOdds,
        clv_percent: clvPct,
        ev_percent: evPct,
        edge_score: edgeScore,
        books_count: booksCount,
        book: bestBook,
        time_to_expiry_minutes: timeToExpiryMinutes,
      }
    })

    const prompt = `You are SnapBet's CLV Execution Trader.

Goal:

Given a list of betting opportunities with CLV/EV metrics, return an actionable trading plan that is driven by CLV capture (closing line value), not match narratives.

Rules:

- Use ONLY the provided fields (prices, fair/consensus, CLV/EV, score, liquidity/book info, time-to-expiry). Do not invent team strength, injuries, form, or tactical analysis.

- Treat high-odds outcomes as high-variance; recommend conservative staking even with strong CLV.

- Prefer "portfolio thinking": rank bets, size stakes relative to edge/quality, and include a trade-out plan if exchange liquidity exists.

- If a bet has weaker CLV or low quality score, mark it as optional or pass.

Output requirements:

- Return STRICT JSON only (no markdown, no extra text).

- Include: recommendation (TAKE/OPTIONAL/PASS), rationale, entry, staking_units, confidence, monitoring_plan, exit_plan, risk_notes, and portfolio_allocation_percent.

- Any numeric recommendation must be explainable from provided inputs.

Input:

${JSON.stringify({ bankroll_units: bankrollUnits, bets }, null, 2)}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4' for better quality
      messages: [
        {
          role: 'system',
          content: 'You are a professional CLV (Closing Line Value) trading advisor. Return ONLY valid JSON, no markdown, no explanations outside the JSON structure.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent, analytical responses
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response
    let tradingPlan
    try {
      tradingPlan = JSON.parse(responseText)
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        tradingPlan = JSON.parse(jsonMatch[1] || jsonMatch[0])
      } else {
        throw new Error('Failed to parse OpenAI response as JSON')
      }
    }

    return NextResponse.json({
      success: true,
      tradingPlan,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating OpenAI CLV analysis:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate CLV trading analysis', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

