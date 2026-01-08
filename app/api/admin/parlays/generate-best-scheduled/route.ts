/**
 * POST /api/admin/parlays/generate-best-scheduled
 * 
 * Cron job endpoint for scheduled best parlay generation
 * Authenticates using CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateBestParlays, GenerationConfig } from '@/lib/parlays/best-parlay-generator'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

/**
 * Convert ParlayCombination to database format and save
 */
async function saveParlayToDatabase(
  parlay: Awaited<ReturnType<typeof generateBestParlays>>[0],
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
    
    // Check if similar parlay exists
    const existingParlays = await prisma.parlayConsensus.findMany({
      where: {
        parlayType: parlay.parlayType === 'multi_game' ? 'cross_league' : 'single_game',
        legCount: parlay.legCount,
        earliestKickoff: {
          gte: new Date(earliestKickoff.getTime() - 60 * 60 * 1000),
          lte: new Date(earliestKickoff.getTime() + 60 * 60 * 1000)
        }
      },
      include: {
        legs: true
      }
    })
    
    // Check for duplicates
    const existingMatchIds = existingParlays.map(ep => {
      const matchSet = new Set(ep.legs.map(l => l.matchId))
      return Array.from(matchSet).sort().join(',')
    })
    
    const newMatchIds = parlay.matchIds.sort().join(',')
    if (existingMatchIds.includes(newMatchIds)) {
      return { created: false, parlayId: '' }
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
          tags: ['api', 'admin', 'parlays', 'cron'],
          data: { matchId: leg.matchId }
        })
        continue
      }
      
      // Determine outcome
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
          edge: leg.edgeConsensus / 100,
          legOrder: i + 1,
          additionalMarketId: leg.id
        }
      })
    }
    
    return { created: true, parlayId: parlayConsensus.parlayId }
  } catch (error) {
    logger.error('Error saving parlay to database', {
      tags: ['api', 'admin', 'parlays', 'cron'],
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

/**
 * POST /api/admin/parlays/generate-best-scheduled
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate using CRON_SECRET
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret) {
      logger.error('CRON_SECRET not configured', {
        tags: ['api', 'admin', 'parlays', 'cron']
      })
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron request', {
        tags: ['api', 'admin', 'parlays', 'cron']
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse request body for config (optional)
    let config: GenerationConfig = {}
    try {
      const body = await req.json().catch(() => ({}))
      config = body.config || {}
    } catch {
      // No config provided, use defaults
    }
    
    logger.info('Scheduled best parlay generation started', {
      tags: ['api', 'admin', 'parlays', 'cron'],
      data: { config }
    })
    
    // Generate parlays with default config optimized for daily generation
    const generationConfig: GenerationConfig = {
      ...config,
      minLegEdge: config.minLegEdge || 8.0,
      minParlayEdge: config.minParlayEdge || 10.0,
      minCombinedProb: config.minCombinedProb || 0.15,
      maxLegCount: config.maxLegCount || 4,
      maxResults: config.maxResults || 20,
      parlayType: config.parlayType || 'both'
    }
    
    const parlays = await generateBestParlays(generationConfig)
    
    if (parlays.length === 0) {
      logger.info('No parlays generated', {
        tags: ['api', 'admin', 'parlays', 'cron']
      })
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
    
    // Fetch match data
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
    
    // Save parlays
    let created = 0
    let skipped = 0
    let errors = 0
    
    for (const parlay of parlays) {
      try {
        const missingMatches = parlay.matchIds.filter(id => !matchDataMap.has(id))
        if (missingMatches.length > 0) {
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
          tags: ['api', 'admin', 'parlays', 'cron'],
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    logger.info('Scheduled best parlay generation complete', {
      tags: ['api', 'admin', 'parlays', 'cron'],
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
    logger.error('Error in scheduled best parlay generation', {
      tags: ['api', 'admin', 'parlays', 'cron'],
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

