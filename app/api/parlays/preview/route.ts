import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { calculateQualityScore, isTradable, getRiskLevel } from '@/lib/parlays/quality-utils'

/**
 * GET /api/parlays/preview - Public endpoint to get preview and masked parlays
 * Returns 2 preview parlays (full data) + 13-18 masked parlays (partial data)
 * No authentication required - used for public parlay generator page
 */
export async function GET(request: NextRequest) {
  try {
    // Get UPCOMING match IDs from MarketMatch to filter parlays
    const now = new Date()
    const upcomingMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: { gt: now },
        isActive: true,
      },
      select: { matchId: true },
    })
    const upcomingMatchIds = new Set(
      upcomingMatches.map(m => String(m.matchId).trim()).filter(id => id && id !== 'undefined' && id !== 'null')
    )

    if (upcomingMatchIds.size === 0) {
      return NextResponse.json({
        parlays: [],
        message: 'No upcoming matches available'
      })
    }

    // Fetch more parlays to get preview + masked (fetch 30 to ensure we get 15-20 after filtering)
    const parlays = await prisma.parlayConsensus.findMany({
      where: {
        status: 'active',
      },
      select: {
        parlayId: true,
        apiVersion: true,
        legCount: true,
        combinedProb: true,
        edgePct: true,
        confidenceTier: true,
        parlayType: true,
        leagueGroup: true,
        earliestKickoff: true,
        latestKickoff: true,
        legs: {
          select: {
            id: true,
            matchId: true,
            outcome: true,
            homeTeam: true,
            awayTeam: true,
            modelProb: true,
            decimalOdds: true,
            edge: true,
            legOrder: true,
          },
          orderBy: { legOrder: 'asc' },
        },
      },
      take: 30, // Fetch more to filter and sort
    })

    // Filter parlays to only include those with all legs in upcoming matches
    // Sort by quality (edge + probability)
    const filteredParlays = parlays
      .filter(parlay => {
        if (!parlay.legs || parlay.legs.length === 0) return false
        
        // Check if all legs belong to upcoming matches
        const allLegsUpcoming = parlay.legs.every(leg => 
          upcomingMatchIds.has(String(leg.matchId).trim())
        )
        
        if (!allLegsUpcoming) return false

        // Only include tradable parlays (edge >= 5%, prob >= 5%)
        const edgePct = Number(parlay.edgePct)
        const combinedProb = Number(parlay.combinedProb)
        return isTradable(edgePct, combinedProb)
      })
      .map(parlay => {
        const edgePct = Number(parlay.edgePct)
        const combinedProb = Number(parlay.combinedProb)
        const qualityScore = calculateQualityScore(edgePct, combinedProb, parlay.confidenceTier)
        
        return {
          parlay,
          qualityScore,
          edgePct,
          combinedProb,
        }
      })
      .sort((a, b) => {
        // Sort by quality score (descending), then by edge (descending)
        const scoreDiff = b.qualityScore - a.qualityScore
        if (Math.abs(scoreDiff) > 0.1) return scoreDiff
        return b.edgePct - a.edgePct
      })
      .slice(0, 20) // Take top 20 (2 preview + up to 18 masked)
      .map(item => item.parlay)

    // Format response: first 2 are preview (full data), rest are masked (partial data)
    const formattedParlays = filteredParlays.map((parlay, index) => {
      const edgePct = Number(parlay.edgePct)
      const combinedProb = Number(parlay.combinedProb)
      const qualityScore = calculateQualityScore(edgePct, combinedProb, parlay.confidenceTier)
      const isPreview = index < 2
      
      if (isPreview) {
        // Preview parlays: full data
        return {
          parlay_id: parlay.parlayId,
          is_preview: true,
          leg_count: parlay.legCount,
          legs: parlay.legs.map(leg => ({
            edge: Number(leg.edge),
            outcome: leg.outcome,
            match_id: parseInt(leg.matchId),
            away_team: leg.awayTeam,
            home_team: leg.homeTeam,
            model_prob: Number(leg.modelProb),
            decimal_odds: Number(leg.decimalOdds),
          })),
          combined_prob: combinedProb,
          edge_pct: edgePct,
          confidence_tier: parlay.confidenceTier,
          parlay_type: parlay.parlayType,
          earliest_kickoff: parlay.earliestKickoff.toISOString(),
          latest_kickoff: parlay.latestKickoff.toISOString(),
          quality: {
            score: qualityScore,
            is_tradable: isTradable(edgePct, combinedProb),
            risk_level: getRiskLevel(combinedProb),
          },
        }
      } else {
        // Masked parlays: partial data only
        return {
          parlay_id: parlay.parlayId,
          is_preview: false,
          masked: true,
          leg_count: parlay.legCount,
          confidence_tier: parlay.confidenceTier,
          quality: {
            risk_level: getRiskLevel(combinedProb),
          },
        }
      }
    })

    return NextResponse.json({
      parlays: formattedParlays,
      count: formattedParlays.length,
      preview_count: 2,
      total_available: formattedParlays.length,
    })
  } catch (error) {
    logger.error('Error fetching parlay preview', {
      tags: ['api', 'parlays', 'preview'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to fetch parlay preview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

