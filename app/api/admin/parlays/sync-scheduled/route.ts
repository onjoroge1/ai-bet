import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'

/**
 * Scheduled Parlay Sync Endpoint
 * 
 * This endpoint is designed to be called by cron jobs (Vercel Cron or external schedulers)
 * to automatically sync parlays from backend APIs.
 * 
 * Security: Uses CRON_SECRET environment variable for authentication
 */

async function syncParlaysFromVersion(version: 'v1' | 'v2'): Promise<{ synced: number; errors: number }> {
  const backendUrl = process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
  const apiKey = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'
  
  try {
    logger.info(`🕐 CRON: Syncing parlays from ${version}`, {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
      data: { version, backendUrl }
    })

    const response = await fetch(`${backendUrl}/api/${version}/parlays`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`🕐 CRON: Failed to fetch parlays from ${version}`, {
        tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
        data: { version, status: response.status, error: errorText }
      })
      throw new Error(`Backend API ${version} responded with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    let synced = 0
    let errors = 0

    // Check if models exist
    if (!prisma.parlayConsensus || !prisma.parlayLeg) {
      throw new Error('Parlay models not available. Run "npx prisma generate" and restart the server.')
    }

    for (const parlay of data.parlays) {
      try {
        // CRITICAL: Upsert parlay consensus and get the internal Prisma ID
        // The ParlayLeg.parlayId field references ParlayConsensus.id (internal ID), not parlayId (backend UUID)
        const parlayConsensus = await prisma.parlayConsensus.upsert({
          where: { parlayId: parlay.parlay_id },
          update: {
            apiVersion: version,
            legCount: parlay.leg_count,
            combinedProb: parlay.combined_prob,
            correlationPenalty: parlay.correlation_penalty,
            adjustedProb: parlay.adjusted_prob,
            impliedOdds: parlay.implied_odds,
            edgePct: parlay.edge_pct,
            confidenceTier: parlay.confidence_tier,
            parlayType: parlay.parlay_type,
            leagueGroup: parlay.league_group || null,
            earliestKickoff: new Date(parlay.earliest_kickoff),
            latestKickoff: new Date(parlay.latest_kickoff),
            kickoffWindow: parlay.kickoff_window,
            status: parlay.status,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
          create: {
            parlayId: parlay.parlay_id,
            apiVersion: version,
            legCount: parlay.leg_count,
            combinedProb: parlay.combined_prob,
            correlationPenalty: parlay.correlation_penalty,
            adjustedProb: parlay.adjusted_prob,
            impliedOdds: parlay.implied_odds,
            edgePct: parlay.edge_pct,
            confidenceTier: parlay.confidence_tier,
            parlayType: parlay.parlay_type,
            leagueGroup: parlay.league_group || null,
            earliestKickoff: new Date(parlay.earliest_kickoff),
            latestKickoff: new Date(parlay.latest_kickoff),
            kickoffWindow: parlay.kickoff_window,
            status: parlay.status,
            syncedAt: new Date(),
          },
        })

        // CRITICAL: Use the internal Prisma ID (parlayConsensus.id), NOT parlay.parlay_id (backend UUID)
        const parlayConsensusId = parlayConsensus.id

        // Delete existing legs and recreate
        await prisma.parlayLeg.deleteMany({
          where: { parlayId: parlayConsensusId },
        })

        // Create legs - CRITICAL: Use parlayConsensusId (internal Prisma ID), NOT parlay.parlay_id (backend UUID)
        for (let i = 0; i < parlay.legs.length; i++) {
          const leg = parlay.legs[i]
          await prisma.parlayLeg.create({
            data: {
              parlayId: parlayConsensusId, // Internal Prisma ID, not backend UUID!
              matchId: leg.match_id.toString(),
              outcome: leg.outcome,
              homeTeam: leg.home_team,
              awayTeam: leg.away_team,
              modelProb: leg.model_prob,
              decimalOdds: leg.decimal_odds,
              edge: leg.edge,
              legOrder: i + 1,
            },
          })
        }

        synced++
      } catch (error) {
        errors++
        logger.error(`🕐 CRON: Error syncing parlay ${parlay.parlay_id}`, {
          tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
          data: { version, parlayId: parlay.parlay_id, error: error instanceof Error ? error.message : 'Unknown error' }
        })
      }
    }

    // Mark expired parlays
    const now = new Date()
    await prisma.parlayConsensus.updateMany({
      where: {
        latestKickoff: { lt: now },
        status: 'active',
        apiVersion: version,
      },
      data: { status: 'expired' },
    })

    logger.info(`🕐 CRON: Completed syncing parlays from ${version}`, {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
      data: { version, synced, errors, total: data.parlays.length }
    })

    return { synced, errors }
  } catch (error) {
    logger.error(`🕐 CRON: Failed to sync parlays from ${version}`, {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
      data: { version, error: error instanceof Error ? error.message : 'Unknown error' }
    })
    throw error
  }
}

/**
 * GET /api/admin/parlays/sync-scheduled - Scheduled parlay sync (for cron jobs)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('🕐 CRON: Unauthorized parlay sync attempt', {
        tags: ['api', 'admin', 'parlays', 'cron', 'security'],
        data: { hasAuthHeader: !!authHeader }
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('🕐 CRON: Starting scheduled parlay sync', {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
      data: { startTime: new Date(startTime).toISOString() }
    })

    // Sync from both V1 and V2
    const results = await Promise.allSettled([
      syncParlaysFromVersion('v1'),
      syncParlaysFromVersion('v2'),
    ])

    const summary = {
      v1: { synced: 0, errors: 0, status: 'pending' as const },
      v2: { synced: 0, errors: 0, status: 'pending' as const },
    }

    results.forEach((result, index) => {
      const version = index === 0 ? 'v1' : 'v2'
      if (result.status === 'fulfilled') {
        summary[version] = {
          synced: result.value.synced,
          errors: result.value.errors,
          status: 'success' as const,
        }
      } else {
        summary[version] = {
          synced: 0,
          errors: 0,
          status: 'error' as const,
        }
        logger.error(`🕐 CRON: Failed to sync ${version}`, {
          tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
          data: { version, error: result.reason }
        })
      }
    })

    const totalSynced = summary.v1.synced + summary.v2.synced
    const totalErrors = summary.v1.errors + summary.v2.errors
    const totalTime = Date.now() - startTime

    logger.info('🕐 CRON: Scheduled parlay sync completed', {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
      data: {
        totalSynced,
        totalErrors,
        results: summary,
        duration: `${totalTime}ms`
      }
    })

    return NextResponse.json({
      success: true,
      message: `Synced ${totalSynced} parlays (${totalErrors} errors)`,
      results: summary,
      totals: {
        synced: totalSynced,
        errors: totalErrors,
      },
      duration: `${totalTime}ms`,
    })
  } catch (error) {
    logger.error('🕐 CRON: Error in scheduled parlay sync', {
      tags: ['api', 'admin', 'parlays', 'cron', 'sync'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to sync parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

