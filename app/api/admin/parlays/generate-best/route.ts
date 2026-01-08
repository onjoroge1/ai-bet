/**
 * POST /api/admin/parlays/generate-best
 * 
 * Generate best parlays from AdditionalMarketData table
 * Supports both multi-game (different matches) and single-game (same match) parlays
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBestParlays, GenerationConfig, ParlayCombination } from '@/lib/parlays/best-parlay-generator'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

/**
 * Convert ParlayCombination to database format and save
 */
async function saveParlayToDatabase(
  parlay: ParlayCombination,
  matchDataMap: Map<string, { homeTeam: string; awayTeam: string; league: string; kickoffDate: Date }>
): Promise<{ created: boolean; parlayId: string }> {
  try {
    // Get match data for earliest/latest kickoff
    const matchDates = parlay.matchIds
      .map(matchId => matchDataMap.get(matchId)?.kickoffDate)
      .filter((date): date is Date => date !== undefined)
      .sort((a, b) => a.getTime() - b.getTime())
    
    if (matchDates.length === 0) {
      throw new Error('No valid match dates found')
    }
    
    const earliestKickoff = matchDates[0]
    const latestKickoff = matchDates[matchDates.length - 1]
    
    // Determine kickoff window
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    let kickoffWindow = 'this_week'
    if (earliestKickoff >= today && earliestKickoff < tomorrow) {
      kickoffWindow = 'today'
    } else if (earliestKickoff >= tomorrow && earliestKickoff < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
      kickoffWindow = 'tomorrow'
    }
    
    // Determine league group
    const leagues = Array.from(new Set(parlay.matchIds.map(id => matchDataMap.get(id)?.league).filter(Boolean)))
    const leagueGroup = leagues.length === 1 ? leagues[0] || null : `${leagues.length} leagues`
    
    // Generate unique parlay ID
    const parlayId = randomUUID()
    
    // Check if similar parlay exists (same matchIds and outcomes)
    const existingParlays = await prisma.parlayConsensus.findMany({
      where: {
        parlayType: parlay.parlayType,
        legCount: parlay.legCount,
        earliestKickoff: {
          gte: new Date(earliestKickoff.getTime() - 60 * 60 * 1000), // Within 1 hour
          lte: new Date(earliestKickoff.getTime() + 60 * 60 * 1000)
        }
      },
      include: {
        legs: true
      }
    })
    
    // Check if this exact combination exists
    const parlaySignature = parlay.legs
      .map(leg => `${leg.matchId}:${leg.marketType}:${leg.marketSubtype || ''}:${leg.line || ''}`)
      .sort()
      .join('|')
    
    for (const existing of existingParlays) {
      const existingSignature = existing.legs
        .map(leg => `${leg.matchId}:${leg.outcome}`)
        .sort()
        .join('|')
      
      // Simple check: if same matchIds and same leg count, likely duplicate
      const existingMatchIds = new Set(existing.legs.map(l => l.matchId))
      const newMatchIds = new Set(parlay.matchIds)
      
      if (existingMatchIds.size === newMatchIds.size &&
          Array.from(existingMatchIds).every(id => newMatchIds.has(id)) &&
          existing.legCount === parlay.legCount) {
        return { created: false, parlayId: existing.parlayId }
      }
    }
    
    // Create parlay consensus
    const parlayConsensus = await prisma.parlayConsensus.create({
      data: {
        parlayId,
        apiVersion: 'v2',
        legCount: parlay.legCount,
        combinedProb: parlay.combinedProb,
        correlationPenalty: parlay.correlationPenalty,
        adjustedProb: parlay.adjustedProb,
        impliedOdds: parlay.impliedOdds,
        edgePct: parlay.parlayEdge,
        confidenceTier: parlay.confidenceTier,
        parlayType: parlay.parlayType === 'multi_game' ? 'cross_league' : 'single_game',
        leagueGroup,
        earliestKickoff,
        latestKickoff,
        kickoffWindow,
        status: 'active',
        syncedAt: new Date()
      }
    })
    
    // Create legs
    for (let i = 0; i < parlay.legs.length; i++) {
      const leg = parlay.legs[i]
      const matchData = matchDataMap.get(leg.matchId)
      
      if (!matchData) {
        logger.warn('Match data not found for leg', {
          tags: ['api', 'admin', 'parlays', 'generate'],
          data: { matchId: leg.matchId }
        })
        continue
      }
      
      // Determine outcome based on market type and subtype
      let outcome = 'H'
      if (leg.marketType === '1X2') {
        outcome = leg.marketSubtype === 'HOME' ? 'H' : leg.marketSubtype === 'AWAY' ? 'A' : 'D'
      } else if (leg.marketType === 'TOTALS') {
        outcome = leg.marketSubtype === 'OVER' ? 'OVER' : 'UNDER'
      } else if (leg.marketType === 'BTTS') {
        outcome = leg.marketSubtype === 'YES' ? 'YES' : 'NO'
      } else if (leg.marketType === 'DNB') {
        outcome = leg.marketSubtype === 'HOME' ? 'DNB_H' : 'DNB_A'
      }
      
      await prisma.parlayLeg.create({
        data: {
          parlayId: parlayConsensus.id,
          matchId: leg.matchId,
          outcome,
          homeTeam: matchData.homeTeam,
          awayTeam: matchData.awayTeam,
          modelProb: leg.consensusProb,
          decimalOdds: leg.decimalOdds || 0,
          edge: leg.edgeConsensus / 100, // Convert percentage to decimal
          legOrder: i + 1,
          additionalMarketId: leg.id
        }
      })
    }
    
    logger.info('Created parlay from best parlay generator', {
      tags: ['api', 'admin', 'parlays', 'generate'],
      data: {
        parlayId: parlayConsensus.parlayId,
        parlayType: parlay.parlayType,
        legCount: parlay.legCount,
        edge: parlay.parlayEdge
      }
    })
    
    return { created: true, parlayId: parlayConsensus.parlayId }
  } catch (error) {
    logger.error('Error saving parlay to database', {
      tags: ['api', 'admin', 'parlays', 'generate'],
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

/**
 * POST /api/admin/parlays/generate-best
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse request body for config
    let config: GenerationConfig = {}
    try {
      const body = await req.json()
      config = body.config || {}
    } catch {
      // No config provided, use defaults
    }
    
    logger.info('Generating best parlays from AdditionalMarketData', {
      tags: ['api', 'admin', 'parlays', 'generate'],
      data: { config }
    })
    
    // Generate parlays
    const parlays = await generateBestParlays(config)
    
    if (parlays.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No parlays generated (no eligible markets found)',
        parlaysGenerated: 0,
        parlaysCreated: 0,
        parlaysSkipped: 0,
        errors: 0
      })
    }
    
    // Get all unique matchIds
    const matchIds = Array.from(new Set(parlays.flatMap(p => p.matchIds)))
    
    // Fetch match data for all matches
    const matches = await prisma.marketMatch.findMany({
      where: {
        matchId: { in: matchIds }
      },
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true
      }
    })
    
    const matchDataMap = new Map(
      matches.map(m => [m.matchId, {
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league,
        kickoffDate: m.kickoffDate
      }])
    )
    
    // Save parlays to database
    let created = 0
    let skipped = 0
    let errors = 0
    
    for (const parlay of parlays) {
      try {
        // Verify all matches have data
        const missingMatches = parlay.matchIds.filter(id => !matchDataMap.has(id))
        if (missingMatches.length > 0) {
          logger.warn('Missing match data for parlay', {
            tags: ['api', 'admin', 'parlays', 'generate'],
            data: { missingMatches }
          })
          skipped++
          continue
        }
        
        const result = await saveParlayToDatabase(parlay, matchDataMap)
        if (result.created) {
          created++
        } else {
          skipped++
        }
      } catch (error) {
        errors++
        logger.error('Error processing parlay', {
          tags: ['api', 'admin', 'parlays', 'generate'],
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    logger.info('Best parlay generation complete', {
      tags: ['api', 'admin', 'parlays', 'generate'],
      data: {
        parlaysGenerated: parlays.length,
        created,
        skipped,
        errors
      }
    })
    
    return NextResponse.json({
      success: true,
      message: `Generated ${parlays.length} parlays, created ${created}, skipped ${skipped}`,
      parlaysGenerated: parlays.length,
      parlaysCreated: created,
      parlaysSkipped: skipped,
      errors,
      summary: {
        multiGame: parlays.filter(p => p.isMultiGame).length,
        singleGame: parlays.filter(p => !p.isMultiGame).length,
        byLegCount: {
          2: parlays.filter(p => p.legCount === 2).length,
          3: parlays.filter(p => p.legCount === 3).length,
          4: parlays.filter(p => p.legCount === 4).length,
          5: parlays.filter(p => p.legCount === 5).length
        }
      }
    })
  } catch (error) {
    logger.error('Error generating best parlays', {
      tags: ['api', 'admin', 'parlays', 'generate'],
      error: error instanceof Error ? error.message : String(error)
    })
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

