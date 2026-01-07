import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { isTradable, getRiskLevel, calculateQualityScore } from '@/lib/parlays/quality-utils'

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
    let duplicatesSkipped = 0

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

    // DEDUPLICATION: Track seen leg combinations to prevent duplicates
    // Key: sorted leg combination (match_id:outcome pairs)
    // Value: { parlay_id, edge_pct } - keep the one with highest edge
    const seenLegCombinations = new Map<string, { parlayId: string; edgePct: number; parlay: BackendParlay }>()

    // First pass: identify duplicates and keep the best one (highest edge %)
    for (const parlay of data.parlays) {
      // Skip parlays without legs (cannot create valid combination key)
      if (!parlay.legs || parlay.legs.length === 0) {
        continue
      }

      // Create unique key from leg combinations (match_id:outcome pairs, sorted)
      const legKey = parlay.legs
        .map(l => `${l.match_id}:${l.outcome}`)
        .sort()
        .join('|')

      const existing = seenLegCombinations.get(legKey)
      if (existing) {
        // Duplicate found - keep the one with higher edge %
        if (parlay.edge_pct > existing.edgePct) {
          seenLegCombinations.set(legKey, {
            parlayId: parlay.parlay_id,
            edgePct: parlay.edge_pct,
            parlay: parlay
          })
          duplicatesSkipped++
          logger.info(`Duplicate parlay found - keeping higher edge: ${parlay.parlay_id} (${parlay.edge_pct}%) vs ${existing.parlayId} (${existing.edgePct}%)`, {
            tags: ['api', 'parlays', 'sync', 'deduplication'],
            data: {
              version,
              legKey,
              kept: parlay.parlay_id,
              skipped: existing.parlayId,
              edgeKept: parlay.edge_pct,
              edgeSkipped: existing.edgePct
            }
          })
        } else {
          duplicatesSkipped++
          logger.info(`Duplicate parlay found - skipping lower edge: ${parlay.parlay_id} (${parlay.edge_pct}%) vs ${existing.parlayId} (${existing.edgePct}%)`, {
            tags: ['api', 'parlays', 'sync', 'deduplication'],
            data: {
              version,
              legKey,
              kept: existing.parlayId,
              skipped: parlay.parlay_id,
              edgeKept: existing.edgePct,
              edgeSkipped: parlay.edge_pct
            }
          })
        }
      } else {
        // First occurrence of this leg combination
        seenLegCombinations.set(legKey, {
          parlayId: parlay.parlay_id,
          edgePct: parlay.edge_pct,
          parlay: parlay
        })
      }
    }

    // Get unique parlays (best ones for each leg combination)
    const uniqueParlays = Array.from(seenLegCombinations.values()).map(item => item.parlay)
    
    logger.info(`Deduplication complete: ${data.parlays.length} total → ${uniqueParlays.length} unique parlays (${duplicatesSkipped} duplicates skipped)`, {
      tags: ['api', 'parlays', 'sync', 'deduplication'],
      data: {
        version,
        totalParlays: data.parlays.length,
        uniqueParlays: uniqueParlays.length,
        duplicatesSkipped
      }
    })

    // Process only unique parlays
    for (const parlay of uniqueParlays) {
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
          // Mark parlay as invalid if no legs
          await prisma.parlayConsensus.update({
            where: { id: parlayConsensusId },
            data: { status: 'invalid' }
          })
          errors++
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
          // CRITICAL: Normalize matchIds to strings for consistent comparison
          const legMatchIds = parlay.legs.map(l => {
            const matchId = l.match_id
            if (matchId === null || matchId === undefined) {
              logger.warn(`⚠️ Leg has null/undefined match_id`, {
                tags: ['api', 'parlays', 'sync'],
                data: { version, parlayId: parlay.parlay_id, leg }
              })
              return null
            }
            return String(matchId).trim()
          }).filter((id): id is string => id !== null)

          if (legMatchIds.length === 0) {
            logger.error(`❌ No valid matchIds found for parlay ${parlay.parlay_id}`, {
              tags: ['api', 'parlays', 'sync'],
              data: { version, parlayId: parlay.parlay_id, legs: parlay.legs }
            })
            // Mark parlay as invalid and rollback
            await prisma.parlayConsensus.delete({ where: { id: parlayConsensusId } })
            errors++
            continue
          }

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
          const legErrors: Array<{ legIndex: number; error: string; leg: any }> = []

          for (let i = 0; i < parlay.legs.length; i++) {
            const leg = parlay.legs[i]
            try {
              // Validate required fields
              if (!leg.match_id && leg.match_id !== 0) {
                throw new Error(`Missing match_id for leg ${i + 1}`)
              }

              // Normalize matchId to string for consistency
              const normalizedMatchId = String(leg.match_id).trim()
              if (!normalizedMatchId || normalizedMatchId === 'undefined' || normalizedMatchId === 'null') {
                throw new Error(`Invalid match_id for leg ${i + 1}: ${leg.match_id}`)
              }

              // Validate outcome
              if (!leg.outcome || !['H', 'D', 'A'].includes(leg.outcome)) {
                throw new Error(`Invalid outcome for leg ${i + 1}: ${leg.outcome}`)
              }

              // Validate probability values
              if (leg.model_prob === null || leg.model_prob === undefined || isNaN(Number(leg.model_prob))) {
                throw new Error(`Invalid model_prob for leg ${i + 1}: ${leg.model_prob}`)
              }

              if (leg.decimal_odds === null || leg.decimal_odds === undefined || isNaN(Number(leg.decimal_odds))) {
                throw new Error(`Invalid decimal_odds for leg ${i + 1}: ${leg.decimal_odds}`)
              }

              // Enrich team names from MarketMatch if missing or "TBD"
              const matchData = matchMap.get(normalizedMatchId)
              const homeTeam = (leg.home_team && leg.home_team !== 'TBD') 
                ? leg.home_team 
                : (matchData?.homeTeam || leg.home_team || 'TBD')
              const awayTeam = (leg.away_team && leg.away_team !== 'TBD') 
                ? leg.away_team 
                : (matchData?.awayTeam || leg.away_team || 'TBD')

              // CRITICAL: Use parlayConsensusId (internal Prisma ID), NOT parlay.parlay_id (backend UUID)
              // CRITICAL: Prisma Decimal fields need to be strings or numbers (they auto-convert, but be explicit)
              const createdLeg = await prisma.parlayLeg.create({
                data: {
                  parlayId: parlayConsensusId, // Internal Prisma ID, not backend UUID!
                  matchId: normalizedMatchId, // Normalized string matchId
                  outcome: leg.outcome,
                  homeTeam,
                  awayTeam,
                  modelProb: Number(leg.model_prob), // Prisma Decimal accepts number or string
                  decimalOdds: Number(leg.decimal_odds),
                  edge: Number(leg.edge || 0), // Default to 0 if missing
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
                  matchId: normalizedMatchId,
                  outcome: leg.outcome,
                  homeTeam: leg.home_team,
                  awayTeam: leg.away_team,
                  legId: createdLeg.id
                }
              })
            } catch (legError) {
              const errorMessage = legError instanceof Error ? legError.message : 'Unknown error'
              logger.error(`❌ Error creating leg ${i + 1} for parlay ${parlay.parlay_id}`, {
                tags: ['api', 'parlays', 'sync'],
                data: { 
                  version, 
                  backendParlayId: parlay.parlay_id,
                  internalId: parlayConsensusId,
                  legIndex: i,
                  legData: leg,
                  error: errorMessage,
                  errorStack: legError instanceof Error ? legError.stack : undefined
                }
              })
              legErrors.push({ legIndex: i, error: errorMessage, leg })
              errors++
            }
          }
          
          // CRITICAL: Validate legs were created successfully
          if (legsCreated === 0) {
            // No legs created - rollback parlay creation
            logger.error(`❌ Failed to create any legs for parlay ${parlay.parlay_id}, rolling back parlay creation`, {
              tags: ['api', 'parlays', 'sync'],
              data: { 
                version, 
                parlayId: parlay.parlay_id, 
                totalLegs: parlay.legs.length,
                internalParlayId: parlayConsensusId,
                legErrors,
                sampleLeg: parlay.legs[0] ? {
                  match_id: parlay.legs[0].match_id,
                  match_id_type: typeof parlay.legs[0].match_id,
                  outcome: parlay.legs[0].outcome,
                  home_team: parlay.legs[0].home_team,
                  away_team: parlay.legs[0].away_team,
                  model_prob: parlay.legs[0].model_prob,
                  model_prob_type: typeof parlay.legs[0].model_prob,
                  decimal_odds: parlay.legs[0].decimal_odds,
                  decimal_odds_type: typeof parlay.legs[0].decimal_odds,
                  edge: parlay.legs[0].edge,
                  edge_type: typeof parlay.legs[0].edge,
                } : null,
              }
            })
            
            // Rollback: Delete parlay if no legs created
            await prisma.parlayConsensus.delete({ where: { id: parlayConsensusId } })
            continue // Skip incrementing synced counter
          } else if (legsCreated < parlay.legs.length) {
            // Some legs failed - mark parlay as invalid
            logger.warn(`⚠️ Only ${legsCreated}/${parlay.legs.length} legs created for parlay ${parlay.parlay_id}, marking as invalid`, {
              tags: ['api', 'parlays', 'sync'],
              data: { 
                version, 
                parlayId: parlay.parlay_id, 
                legsCreated, 
                totalLegs: parlay.legs.length,
                legErrors
              }
            })
            await prisma.parlayConsensus.update({
              where: { id: parlayConsensusId },
              data: { status: 'invalid' }
            })
          } else {
            logger.info(`✅ Successfully created ${legsCreated}/${parlay.legs.length} legs for parlay ${parlay.parlay_id}`, {
              tags: ['api', 'parlays', 'sync'],
              data: { version, parlayId: parlay.parlay_id, legsCreated, totalLegs: parlay.legs.length }
            })
          }
        }

        // Only increment synced if parlay has legs AND is valid
        if (parlay.legs && parlay.legs.length > 0) {
          const actualLegCount = await prisma.parlayLeg.count({
            where: { parlayId: parlayConsensusId }
          })
          const parlayStatus = await prisma.parlayConsensus.findUnique({
            where: { id: parlayConsensusId },
            select: { status: true }
          })
          
          // Only count as synced if parlay exists, has legs, and is active (not invalid)
          if (actualLegCount > 0 && parlayStatus?.status === 'active') {
            synced++
          }
        }
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
      data: { 
        version, 
        synced, 
        errors, 
        total: data.parlays.length,
        unique: uniqueParlays.length,
        duplicatesSkipped
      }
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
    const tradableOnly = searchParams.get('tradable_only') !== 'false' // Default to true (tradable only)
    const minEdge = parseFloat(searchParams.get('min_edge') || '5') // Default 5%
    const minProb = parseFloat(searchParams.get('min_prob') || '0.05') // Default 5%

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

    // Get UPCOMING match IDs from MarketMatch to filter parlays
    // CRITICAL: Normalize matchIds to strings for consistent comparison
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

    logger.info(`Filtering parlays by UPCOMING matches`, {
      tags: ['api', 'parlays'],
      data: {
        upcomingMatchCount: upcomingMatchIds.size,
        sampleMatchIds: Array.from(upcomingMatchIds).slice(0, 5)
      }
    })

    // Fetch parlays with legs - optimized query
    // Note: We fetch limit * 2 instead of limit * 3 for better efficiency
    // Quality filtering will reduce the count further
    const allParlays = await prisma.parlayConsensus.findMany({
      where,
      select: {
        id: true,
        parlayId: true,
        apiVersion: true,
        legCount: true,
        combinedProb: true,
        correlationPenalty: true,
        adjustedProb: true,
        impliedOdds: true,
        edgePct: true,
        confidenceTier: true,
        parlayType: true,
        leagueGroup: true,
        earliestKickoff: true,
        latestKickoff: true,
        kickoffWindow: true,
        status: true,
        createdAt: true,
        syncedAt: true,
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
      orderBy: [
        { edgePct: 'desc' },
        { earliestKickoff: 'asc' },
      ],
      // Reduced multiplier: quality filtering + upcoming filtering should still yield enough results
      take: limit * 2, // Get 2x more to filter down (reduced from 3x)
      skip: offset,
    })

    // Filter parlays: Only include those where ALL legs reference UPCOMING matches
    // CRITICAL: Normalize matchIds for comparison (both are strings, but ensure consistency)
    // Also apply quality filtering
    let filteredParlays = allParlays.filter(parlay => {
      if (!parlay.legs || parlay.legs.length === 0) return false
      // Ensure all legs have valid matchIds and all reference UPCOMING matches
      const hasUpcomingMatches = parlay.legs.every(leg => {
        if (!leg.matchId) return false
        const normalizedMatchId = String(leg.matchId).trim()
        return upcomingMatchIds.has(normalizedMatchId)
      })
      if (!hasUpcomingMatches) return false
      
      // Quality filtering
      const edgePct = Number(parlay.edgePct)
      const combinedProb = Number(parlay.combinedProb)
      
      // Minimum edge and probability thresholds
      if (edgePct < minEdge) return false
      if (combinedProb < minProb) return false
      
      // Tradability filter (default: only tradable)
      if (tradableOnly && !isTradable(edgePct, combinedProb)) return false
      
      return true
    })
    
    // Calculate quality scores for sorting
    const parlaysWithScores = filteredParlays.map(parlay => ({
      parlay,
      qualityScore: calculateQualityScore(
        Number(parlay.edgePct),
        Number(parlay.combinedProb),
        parlay.confidenceTier
      )
    }))
    
    // Sort by quality score (edge is primary, quality score is secondary)
    parlaysWithScores.sort((a, b) => {
      // Primary: edge (descending)
      const edgeDiff = Number(b.parlay.edgePct) - Number(a.parlay.edgePct)
      if (Math.abs(edgeDiff) > 0.1) {
        return edgeDiff
      }
      // Secondary: quality score (descending)
      return b.qualityScore - a.qualityScore
    })
    
    filteredParlays = parlaysWithScores.map(item => item.parlay).slice(0, limit) // Apply limit after filtering

    // Get total count of filtered parlays (for accurate pagination)
    // Optimized: Only select fields needed for filtering
    const allParlaysForCount = await prisma.parlayConsensus.findMany({
      where,
      select: {
        edgePct: true,
        combinedProb: true,
        confidenceTier: true,
        legs: {
          select: {
            matchId: true,
          },
        },
      },
    })
    const totalFiltered = allParlaysForCount.filter(parlay => {
      if (!parlay.legs || parlay.legs.length === 0) return false
      // Normalize matchIds for comparison
      const hasUpcomingMatches = parlay.legs.every(leg => {
        if (!leg.matchId) return false
        const normalizedMatchId = String(leg.matchId).trim()
        return upcomingMatchIds.has(normalizedMatchId)
      })
      if (!hasUpcomingMatches) return false
      
      // Apply same quality filters for count
      const edgePct = Number(parlay.edgePct)
      const combinedProb = Number(parlay.combinedProb)
      if (edgePct < minEdge) return false
      if (combinedProb < minProb) return false
      if (tradableOnly && !isTradable(edgePct, combinedProb)) return false
      
      return true
    }).length

    // Log legs retrieval for debugging
    logger.info(`Retrieved ${filteredParlays.length} parlays filtered by UPCOMING matches`, {
      tags: ['api', 'parlays'],
      data: {
        totalBeforeFilter: allParlays.length,
        totalAfterFilter: filteredParlays.length,
        totalFiltered,
        upcomingMatchCount: upcomingMatchIds.size,
        legsCounts: filteredParlays.map(p => ({
          parlayId: p.parlayId,
          legsCount: p.legs.length,
          legCount: p.legCount
        }))
      }
    })

    return NextResponse.json({
      count: totalFiltered,
      filters: {
        tradableOnly,
        minEdge,
        minProb,
      },
      parlays: filteredParlays.map((parlay) => {
        const edgePct = Number(parlay.edgePct)
        const combinedProb = Number(parlay.combinedProb)
        const qualityScore = calculateQualityScore(edgePct, combinedProb, parlay.confidenceTier)
        
        return {
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
          combined_prob: combinedProb,
          correlation_penalty: Number(parlay.correlationPenalty),
          adjusted_prob: Number(parlay.adjustedProb),
          implied_odds: Number(parlay.impliedOdds),
          edge_pct: edgePct,
          confidence_tier: parlay.confidenceTier,
          parlay_type: parlay.parlayType,
          league_group: parlay.leagueGroup,
          earliest_kickoff: parlay.earliestKickoff.toISOString(),
          latest_kickoff: parlay.latestKickoff.toISOString(),
          kickoff_window: parlay.kickoffWindow,
          status: parlay.status,
          created_at: parlay.createdAt.toISOString(),
          synced_at: parlay.syncedAt.toISOString(),
          // Quality indicators
          quality: {
            score: qualityScore,
            is_tradable: isTradable(edgePct, combinedProb),
            risk_level: getRiskLevel(combinedProb),
            has_low_edge: edgePct < 5,
            has_low_probability: combinedProb < 0.05,
          },
        }
      }),
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
 * 
 * Authentication:
 * - Admin session (for manual UI requests)
 * - CRON_SECRET (for automated cron jobs)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for CRON_SECRET authentication (for cron jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`

    // If not cron request, check for admin session (for manual UI requests)
    if (!isCronRequest) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
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

