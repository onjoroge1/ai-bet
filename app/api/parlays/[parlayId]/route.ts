import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/parlays/[parlayId] - Get single parlay with legs
 * Falls back to backend API if legs are missing from database
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parlayId: string }> }
) {
  try {
    const { parlayId } = await params

    // Try to get from database first
    if (prisma.parlayConsensus) {
      const parlay = await prisma.parlayConsensus.findUnique({
        where: { parlayId },
        include: {
          legs: {
            orderBy: { legOrder: 'asc' },
          },
        },
      })

      if (parlay && parlay.legs.length > 0) {
        return NextResponse.json({
          parlay_id: parlay.parlayId,
          api_version: parlay.apiVersion,
          leg_count: parlay.legCount,
          legs: parlay.legs.map((leg) => ({
            edge: Number(leg.edge),
            outcome: leg.outcome,
            match_id: parseInt(leg.matchId),
            away_team: leg.awayTeam,
            home_team: leg.homeTeam,
            model_prob: Number(leg.modelProb),
            decimal_odds: Number(leg.decimalOdds),
          })),
          combined_prob: Number(parlay.combinedProb),
          correlation_penalty: Number(parlay.correlationPenalty),
          adjusted_prob: Number(parlay.adjustedProb),
          implied_odds: Number(parlay.impliedOdds),
          edge_pct: Number(parlay.edgePct),
          confidence_tier: parlay.confidenceTier,
          parlay_type: parlay.parlayType,
          league_group: parlay.leagueGroup,
          earliest_kickoff: parlay.earliestKickoff.toISOString(),
          latest_kickoff: parlay.latestKickoff.toISOString(),
          kickoff_window: parlay.kickoffWindow,
          status: parlay.status,
          created_at: parlay.createdAt.toISOString(),
          synced_at: parlay.syncedAt.toISOString(),
        })
      }
    }

    // Fallback: Fetch from backend API
    const backendUrl = process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
    const apiKey = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

    // Try both V1 and V2
    for (const version of ['v2', 'v1']) {
      try {
        const response = await fetch(`${backendUrl}/api/${version}/parlays`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          const matchingParlay = data.parlays?.find((p: any) => p.parlay_id === parlayId)
          
          if (matchingParlay) {
            return NextResponse.json({
              parlay_id: matchingParlay.parlay_id,
              api_version: version,
              leg_count: matchingParlay.leg_count,
              legs: matchingParlay.legs || [],
              combined_prob: matchingParlay.combined_prob,
              correlation_penalty: matchingParlay.correlation_penalty,
              adjusted_prob: matchingParlay.adjusted_prob,
              implied_odds: matchingParlay.implied_odds,
              edge_pct: matchingParlay.edge_pct,
              confidence_tier: matchingParlay.confidence_tier,
              parlay_type: matchingParlay.parlay_type,
              league_group: matchingParlay.league_group,
              earliest_kickoff: matchingParlay.earliest_kickoff,
              latest_kickoff: matchingParlay.latest_kickoff,
              kickoff_window: matchingParlay.kickoff_window,
              status: matchingParlay.status,
              created_at: matchingParlay.created_at,
              synced_at: new Date().toISOString(),
            })
          }
        }
      } catch (err) {
        logger.error(`Error fetching parlay from ${version}`, {
          tags: ['api', 'parlays'],
          data: { parlayId, version, error: err instanceof Error ? err.message : 'Unknown error' }
        })
      }
    }

    return NextResponse.json(
      { error: 'Parlay not found' },
      { status: 404 }
    )
  } catch (error) {
    logger.error('Error fetching parlay details', {
      tags: ['api', 'parlays'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to fetch parlay details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



