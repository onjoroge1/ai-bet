import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Parlays API Route
 * 
 * Features:
 * - Syncs parlays from backend V1 and V2 APIs
 * - Tracks API version (v1, v2) for each parlay
 * - GET: Returns list of parlays (with optional filters)
 * - POST: Syncs parlays from backend APIs
 */

interface BackendParlay {
  parlay_id: string
  leg_count: number
  legs: Array<{
    edge: number
    outcome: string
    match_id: number
    away_team: string
    home_team: string
    model_prob: number
    decimal_odds: number
  }>
  combined_prob: number
  correlation_penalty: number
  adjusted_prob: number
  implied_odds: number
  edge_pct: number
  confidence_tier: string
  parlay_type: string
  league_group?: string
  earliest_kickoff: string
  latest_kickoff: string
  kickoff_window: string
  status: string
  created_at: string
}

interface BackendParlaysResponse {
  count: number
  status_filter: string
  parlays: BackendParlay[]
}

/**
 * Sync parlays from a specific API version
 */
async function syncParlaysFromVersion(version: 'v1' | 'v2'): Promise<{ synced: number; errors: number }> {
  const backendUrl = process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
  const apiKey = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'
  
  try {
    logger.info(`Syncing parlays from ${version}`, {
      tags: ['api', 'parlays', 'sync'],
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
      logger.error(`Failed to fetch parlays from ${version}`, {
        tags: ['api', 'parlays', 'sync'],
        data: { version, status: response.status, error: errorText }
      })
      throw new Error(`Backend API ${version} responded with status ${response.status}: ${errorText}`)
    }

    const data: BackendParlaysResponse = await response.json()
    let synced = 0
    let errors = 0

    logger.info(`Fetched ${data.parlays.length} parlays from ${version} API`, {
      tags: ['api', 'parlays', 'sync'],
      data: { 
        version, 
        totalParlays: data.parlays.length,
        sampleParlay: data.parlays[0] ? {
          parlay_id: data.parlays[0].parlay_id,
          leg_count: data.parlays[0].leg_count,
          legs_count: data.parlays[0].legs?.length || 0,
          has_legs: !!(data.parlays[0].legs && data.parlays[0].legs.length > 0)
        } : null
      }
    })

    // Check if parlayConsensus model exists
    if (!prisma.parlayConsensus) {
      throw new Error('ParlayConsensus model not found. Run "npx prisma generate" and restart the server.')
    }

    for (const parlay of data.parlays) {
      logger.info(`Processing parlay ${parlay.parlay_id}`, {
        tags: ['api', 'parlays', 'sync'],
        data: { 
          version, 
          parlayId: parlay.parlay_id,
          legCount: parlay.leg_count,
          legsInResponse: parlay.legs?.length || 0,
          hasLegs: !!(parlay.legs && parlay.legs.length > 0)
        }
      })
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

        // CRITICAL: Use the internal Prisma ID (parlayConsensus.id), not the backend parlay_id
        const parlayConsensusId = parlayConsensus.id

        logger.info(`Got ParlayConsensus internal ID: ${parlayConsensusId} for backend parlay_id: ${parlay.parlay_id}`, {
          tags: ['api', 'parlays', 'sync'],
          data: { 
            version, 
            backendParlayId: parlay.parlay_id,
            internalId: parlayConsensusId
          }
        })

        // Delete existing legs and recreate (to handle changes)
        if (!prisma.parlayLeg) {
          logger.error('ParlayLeg model not found', {
            tags: ['api', 'parlays', 'sync'],
            data: { version, parlayId: parlay.parlay_id }
          })
          throw new Error('ParlayLeg model not found. Run "npx prisma generate" and restart the server.')
        }

        // CRITICAL: Delete using the internal Prisma ID
        const deletedCount = await prisma.parlayLeg.deleteMany({
          where: { parlayId: parlayConsensusId },
        })
        
        logger.info(`Deleted ${deletedCount.count} existing legs for parlay ${parlay.parlay_id}`, {
          tags: ['api', 'parlays', 'sync'],
          data: { 
            version, 
            backendParlayId: parlay.parlay_id,
            internalId: parlayConsensusId,
            deletedCount: deletedCount.count
          }
        })

        // Create legs - IMPORTANT: Get legs from API response, not hardcoded
        if (!parlay.legs || parlay.legs.length === 0) {
          logger.warn(`⚠️ Parlay ${parlay.parlay_id} has no legs in API response`, {
            tags: ['api', 'parlays', 'sync'],
            data: { 
              version, 
              parlayId: parlay.parlay_id, 
              legCount: parlay.leg_count,
              parlayData: JSON.stringify(parlay).substring(0, 200)
            }
          })
        } else {
          logger.info(`📋 Creating ${parlay.legs.length} legs for parlay ${parlay.parlay_id}`, {
            tags: ['api', 'parlays', 'sync'],
            data: { 
              version, 
              parlayId: parlay.parlay_id, 
              legCount: parlay.legs.length,
              legs: parlay.legs.map((l, idx) => ({
                index: idx + 1,
                match_id: l.match_id,
                outcome: l.outcome,
                home_team: l.home_team,
                away_team: l.away_team
              }))
            }
          })

          // Get MarketMatch data to enrich team names if missing
          const legMatchIds = parlay.legs.map(l => l.match_id.toString())
          const marketMatches = await prisma.marketMatch.findMany({
            where: {
              matchId: { in: legMatchIds }
            },
            select: {
              matchId: true,
              homeTeam: true,
              awayTeam: true
            }
          })
          const matchMap = new Map(marketMatches.map(m => [m.matchId, m]))

          let legsCreated = 0
          for (let i = 0; i < parlay.legs.length; i++) {
            const leg = parlay.legs[i]
            try {
              // Enrich team names from MarketMatch if missing or "TBD"
              const matchData = matchMap.get(leg.match_id.toString())
              const homeTeam = (leg.home_team && leg.home_team !== 'TBD') 
                ? leg.home_team 
                : (matchData?.homeTeam || leg.home_team || 'TBD')
              const awayTeam = (leg.away_team && leg.away_team !== 'TBD') 
                ? leg.away_team 
                : (matchData?.awayTeam || leg.away_team || 'TBD')

              // CRITICAL: Use parlayConsensusId (internal Prisma ID), NOT parlay.parlay_id (backend UUID)
              const createdLeg = await prisma.parlayLeg.create({
                data: {
                  parlayId: parlayConsensusId, // Internal Prisma ID, not backend UUID!
                  matchId: leg.match_id.toString(),
                  outcome: leg.outcome,
                  homeTeam,
                  awayTeam,
                  modelProb: leg.model_prob,
                  decimalOdds: leg.decimal_odds,
                  edge: leg.edge,
                  legOrder: i + 1,
                },
              })
              legsCreated++
              logger.info(`✅ Created leg ${i + 1}/${parlay.legs.length} for parlay ${parlay.parlay_id}`, {
                tags: ['api', 'parlays', 'sync'],
                data: { 
                  version, 
                  backendParlayId: parlay.parlay_id,
                  internalId: parlayConsensusId,
                  legOrder: i + 1,
                  matchId: leg.match_id,
                  outcome: leg.outcome,
                  homeTeam: leg.home_team,
                  awayTeam: leg.away_team,
                  legId: createdLeg.id
                }
              })
            } catch (legError) {
              logger.error(`❌ Error creating leg ${i + 1} for parlay ${parlay.parlay_id}`, {
                tags: ['api', 'parlays', 'sync'],
                data: { 
                  version, 
                  backendParlayId: parlay.parlay_id,
                  internalId: parlayConsensusId,
                  legIndex: i,
                  legData: leg,
                  error: legError instanceof Error ? legError.message : 'Unknown error',
                  errorStack: legError instanceof Error ? legError.stack : undefined
                }
              })
              // Don't throw - continue with other legs
              errors++
            }
          }
          
          if (legsCreated > 0) {
            logger.info(`✅ Successfully created ${legsCreated}/${parlay.legs.length} legs for parlay ${parlay.parlay_id}`, {
              tags: ['api', 'parlays', 'sync'],
              data: { version, parlayId: parlay.parlay_id, legsCreated, totalLegs: parlay.legs.length }
            })
          } else {
            logger.error(`❌ Failed to create any legs for parlay ${parlay.parlay_id}`, {
              tags: ['api', 'parlays', 'sync'],
              data: { version, parlayId: parlay.parlay_id, totalLegs: parlay.legs.length }
            })
          }
        }

        synced++
      } catch (error) {
        errors++
        logger.error(`Error syncing parlay ${parlay.parlay_id}`, {
          tags: ['api', 'parlays', 'sync'],
          data: { version, parlayId: parlay.parlay_id, error: error instanceof Error ? error.message : 'Unknown error' }
        })
      }
    }

    // Mark expired parlays (where latest_kickoff has passed)
    const now = new Date()
    await prisma.parlayConsensus.updateMany({
      where: {
        latestKickoff: { lt: now },
        status: 'active',
        apiVersion: version,
      },
      data: { status: 'expired' },
    })

    logger.info(`Completed syncing parlays from ${version}`, {
      tags: ['api', 'parlays', 'sync'],
      data: { version, synced, errors, total: data.parlays.length }
    })

    return { synced, errors }
  } catch (error) {
    logger.error(`Failed to sync parlays from ${version}`, {
      tags: ['api', 'parlays', 'sync'],
      data: { version, error: error instanceof Error ? error.message : 'Unknown error' }
    })
    throw error
  }
}

/**
 * GET /api/parlays - Get list of parlays
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const apiVersion = searchParams.get('version') as 'v1' | 'v2' | null
    const confidenceTier = searchParams.get('confidence_tier')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {
      status,
    }

    if (apiVersion) {
      where.apiVersion = apiVersion
    }

    if (confidenceTier) {
      where.confidenceTier = confidenceTier
    }

    // Check if parlayConsensus model exists (Prisma client might need regeneration)
    if (!prisma.parlayConsensus) {
      logger.error('ParlayConsensus model not found in Prisma client', {
        tags: ['api', 'parlays'],
        data: { message: 'Run "npx prisma generate" and restart the dev server' }
      })
      return NextResponse.json(
        { error: 'Parlay models not available. Please run "npx prisma generate" and restart the server.' },
        { status: 503 }
      )
    }

    const [parlays, total] = await Promise.all([
      prisma.parlayConsensus.findMany({
        where,
        include: {
          legs: {
            orderBy: { legOrder: 'asc' },
          },
        },
        orderBy: [
          { edgePct: 'desc' },
          { earliestKickoff: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.parlayConsensus.count({ where }),
    ])

    // Log legs retrieval for debugging
    logger.info(`Retrieved ${parlays.length} parlays from database`, {
      tags: ['api', 'parlays'],
      data: {
        total,
        returned: parlays.length,
        legsCounts: parlays.map(p => ({
          parlayId: p.parlayId,
          legsCount: p.legs.length,
          legCount: p.legCount
        }))
      }
    })

    return NextResponse.json({
      count: total,
      parlays: parlays.map((parlay) => ({
        parlay_id: parlay.parlayId,
        api_version: parlay.apiVersion,
        leg_count: parlay.legCount,
        legs: parlay.legs && parlay.legs.length > 0 
          ? parlay.legs.map((leg) => ({
              edge: Number(leg.edge),
              outcome: leg.outcome,
              match_id: parseInt(leg.matchId),
              away_team: leg.awayTeam,
              home_team: leg.homeTeam,
              model_prob: Number(leg.modelProb),
              decimal_odds: Number(leg.decimalOdds),
            }))
          : [], // Return empty array if no legs (not hardcoded - from DB)
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
      })),
    })
  } catch (error) {
    logger.error('Error fetching parlays', {
      tags: ['api', 'parlays'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to fetch parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/parlays - Sync parlays from backend APIs
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const versions = body.versions || ['v1', 'v2'] // Default to both versions
    const syncVersion = body.version as 'v1' | 'v2' | 'both' | undefined

    const versionsToSync: ('v1' | 'v2')[] = 
      syncVersion === 'both' ? ['v1', 'v2'] :
      syncVersion === 'v1' || syncVersion === 'v2' ? [syncVersion] :
      Array.isArray(versions) ? versions.filter((v): v is 'v1' | 'v2' => v === 'v1' || v === 'v2') :
      ['v1', 'v2']

    logger.info('Starting parlay sync', {
      tags: ['api', 'parlays', 'sync'],
      data: { versions: versionsToSync }
    })

    const results = await Promise.allSettled(
      versionsToSync.map(version => syncParlaysFromVersion(version))
    )

    const summary = {
      v1: { synced: 0, errors: 0, status: 'pending' as const },
      v2: { synced: 0, errors: 0, status: 'pending' as const },
    }

    versionsToSync.forEach((version, index) => {
      const result = results[index]
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
        logger.error(`Failed to sync ${version}`, {
          tags: ['api', 'parlays', 'sync'],
          data: { version, error: result.reason }
        })
      }
    })

    const totalSynced = summary.v1.synced + summary.v2.synced
    const totalErrors = summary.v1.errors + summary.v2.errors

    return NextResponse.json({
      success: true,
      message: `Synced ${totalSynced} parlays (${totalErrors} errors)`,
      results: summary,
      totals: {
        synced: totalSynced,
        errors: totalErrors,
      },
    })
  } catch (error) {
    logger.error('Error syncing parlays', {
      tags: ['api', 'parlays', 'sync'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to sync parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

