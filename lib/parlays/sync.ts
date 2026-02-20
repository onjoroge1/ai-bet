/**
 * Centralized parlay sync utilities
 * 
 * Handles syncing parlays from all backend sources into the local database:
 * - Standard parlays (v1/v2)
 * - Auto-parlays (match result combinations)
 * - Player scorer parlays (goal scorer combos)
 * 
 * All parlays are stored in ParlayConsensus + ParlayLeg tables with
 * different `parlayType` values for easy filtering.
 */

import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

const BACKEND_URL = process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
const API_KEY = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

interface SyncResult {
  synced: number
  errors: number
  source: string
}

/**
 * Fetch JSON from backend with timeout and error handling
 */
async function fetchBackend(endpoint: string, timeoutMs = 15000): Promise<any> {
  const url = `${BACKEND_URL}${endpoint}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Backend ${endpoint} responded ${response.status}: ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Sync auto-parlays (match result combinations) from backend
 * Endpoint: /api/v1/auto-parlays
 */
export async function syncAutoParlays(): Promise<SyncResult> {
  const source = 'auto-parlays'
  let synced = 0
  let errors = 0

  try {
    const data = await fetchBackend('/api/v1/auto-parlays')
    const parlays = data.parlays || data.auto_parlays || data.items || []

    if (!Array.isArray(parlays) || parlays.length === 0) {
      logger.info('No auto-parlays to sync', { tags: ['parlays', 'sync', source] })
      return { synced: 0, errors: 0, source }
    }

    logger.info(`Syncing ${parlays.length} auto-parlays`, {
      tags: ['parlays', 'sync', source],
    })

    for (const parlay of parlays) {
      try {
        const parlayId = parlay.parlay_id || parlay.id || `auto-${randomUUID()}`
        const legs = parlay.legs || parlay.selections || []
        if (legs.length === 0) continue

        // Calculate combined probability
        const combinedProb = legs.reduce((prob: number, leg: any) => {
          return prob * (leg.model_prob || leg.probability || leg.win_prob || 0.5)
        }, 1)

        const edgePct = parlay.edge_pct || parlay.edge || 0
        const fairOdds = combinedProb > 0 ? 1 / combinedProb : 999

        // Determine kickoff times from legs
        const kickoffDates = legs
          .map((l: any) => l.kickoff_date || l.match_date || l.kickoff)
          .filter(Boolean)
          .map((d: string) => new Date(d))

        const earliestKickoff = kickoffDates.length > 0
          ? new Date(Math.min(...kickoffDates.map((d: Date) => d.getTime())))
          : new Date(Date.now() + 24 * 60 * 60 * 1000)
        const latestKickoff = kickoffDates.length > 0
          ? new Date(Math.max(...kickoffDates.map((d: Date) => d.getTime())))
          : earliestKickoff

        const pc = await prisma.parlayConsensus.upsert({
          where: { parlayId },
          update: {
            legCount: legs.length,
            combinedProb,
            correlationPenalty: parlay.correlation_penalty || 1,
            adjustedProb: parlay.adjusted_prob || combinedProb,
            impliedOdds: fairOdds,
            edgePct,
            confidenceTier: parlay.confidence_tier || parlay.confidence || (combinedProb >= 0.25 ? 'high' : combinedProb >= 0.15 ? 'medium' : 'low'),
            parlayType: 'auto_parlay',
            leagueGroup: parlay.league_group || parlay.league || null,
            earliestKickoff,
            latestKickoff,
            kickoffWindow: parlay.kickoff_window || 'today',
            status: 'active',
            apiVersion: 'v1',
            syncedAt: new Date(),
          },
          create: {
            parlayId,
            legCount: legs.length,
            combinedProb,
            correlationPenalty: parlay.correlation_penalty || 1,
            adjustedProb: parlay.adjusted_prob || combinedProb,
            impliedOdds: fairOdds,
            edgePct,
            confidenceTier: parlay.confidence_tier || parlay.confidence || (combinedProb >= 0.25 ? 'high' : combinedProb >= 0.15 ? 'medium' : 'low'),
            parlayType: 'auto_parlay',
            leagueGroup: parlay.league_group || parlay.league || null,
            earliestKickoff,
            latestKickoff,
            kickoffWindow: parlay.kickoff_window || 'today',
            status: 'active',
            apiVersion: 'v1',
            syncedAt: new Date(),
          },
        })

        // Delete old legs and recreate
        await prisma.parlayLeg.deleteMany({ where: { parlayId: pc.id } })

        let legsCreated = 0
        for (let i = 0; i < legs.length; i++) {
          const leg = legs[i]
          try {
            const matchId = String(leg.match_id || leg.matchId || '0').trim()
            await prisma.parlayLeg.create({
              data: {
                parlayId: pc.id,
                matchId,
                outcome: leg.outcome || leg.selection || leg.pick || 'H',
                homeTeam: leg.home_team || leg.homeTeam || 'TBD',
                awayTeam: leg.away_team || leg.awayTeam || 'TBD',
                modelProb: Number(leg.model_prob || leg.probability || leg.win_prob || 0.5),
                decimalOdds: Number(leg.decimal_odds || leg.odds || (1 / (leg.model_prob || 0.5))),
                edge: Number(leg.edge || 0),
                legOrder: i + 1,
              },
            })
            legsCreated++
          } catch (legErr) {
            logger.warn(`Failed to create auto-parlay leg ${i + 1}`, {
              tags: ['parlays', 'sync', source],
              data: { error: legErr instanceof Error ? legErr.message : 'Unknown' },
            })
          }
        }

        if (legsCreated > 0) {
          synced++
        } else {
          await prisma.parlayConsensus.delete({ where: { id: pc.id } })
          errors++
        }
      } catch (parlayErr) {
        errors++
        logger.warn(`Failed to sync auto-parlay`, {
          tags: ['parlays', 'sync', source],
          data: { error: parlayErr instanceof Error ? parlayErr.message : 'Unknown' },
        })
      }
    }
  } catch (error) {
    logger.error(`Failed to fetch auto-parlays from backend`, {
      tags: ['parlays', 'sync', source, 'error'],
      data: { error: error instanceof Error ? error.message : 'Unknown' },
    })
  }

  return { synced, errors, source }
}

/**
 * Sync player scorer parlays from backend
 * Endpoints: /api/v1/player-parlays/best, /api/v1/player-parlays/best-v2
 */
export async function syncPlayerParlays(): Promise<SyncResult> {
  const source = 'player-parlays'
  let synced = 0
  let errors = 0

  // Try both endpoints
  const endpoints = [
    '/api/v1/player-parlays/best',
    '/api/v1/player-parlays/best-v2',
  ]

  for (const endpoint of endpoints) {
    try {
      const data = await fetchBackend(endpoint)
      const parlays = data.parlays || data.player_parlays || data.items || []

      if (!Array.isArray(parlays) || parlays.length === 0) continue

      const apiTag = endpoint.includes('v2') ? 'v2' : 'v1'

      logger.info(`Syncing ${parlays.length} player parlays from ${endpoint}`, {
        tags: ['parlays', 'sync', source],
      })

      for (const parlay of parlays) {
        try {
          const parlayId = parlay.parlay_id || parlay.id || `player-${apiTag}-${randomUUID()}`
          const legs = parlay.legs || parlay.players || parlay.selections || []
          if (legs.length === 0) continue

          const combinedProb = parlay.combined_prob || legs.reduce((prob: number, leg: any) => {
            return prob * (leg.model_prob || leg.probability || leg.score_prob || 0.3)
          }, 1)

          const edgePct = parlay.edge_pct || parlay.edge || 0
          const fairOdds = combinedProb > 0 ? 1 / combinedProb : 999

          const kickoffDates = legs
            .map((l: any) => l.kickoff_date || l.match_date || l.kickoff)
            .filter(Boolean)
            .map((d: string) => new Date(d))

          const earliestKickoff = kickoffDates.length > 0
            ? new Date(Math.min(...kickoffDates.map((d: Date) => d.getTime())))
            : new Date(Date.now() + 24 * 60 * 60 * 1000)
          const latestKickoff = kickoffDates.length > 0
            ? new Date(Math.max(...kickoffDates.map((d: Date) => d.getTime())))
            : earliestKickoff

          const pc = await prisma.parlayConsensus.upsert({
            where: { parlayId },
            update: {
              legCount: legs.length,
              combinedProb,
              correlationPenalty: parlay.correlation_penalty || 1,
              adjustedProb: parlay.adjusted_prob || combinedProb,
              impliedOdds: fairOdds,
              edgePct,
              confidenceTier: parlay.confidence_tier || parlay.confidence || 'medium',
              parlayType: 'player_scorer',
              leagueGroup: parlay.league_group || null,
              earliestKickoff,
              latestKickoff,
              kickoffWindow: parlay.kickoff_window || 'today',
              status: 'active',
              apiVersion: apiTag,
              syncedAt: new Date(),
            },
            create: {
              parlayId,
              legCount: legs.length,
              combinedProb,
              correlationPenalty: parlay.correlation_penalty || 1,
              adjustedProb: parlay.adjusted_prob || combinedProb,
              impliedOdds: fairOdds,
              edgePct,
              confidenceTier: parlay.confidence_tier || parlay.confidence || 'medium',
              parlayType: 'player_scorer',
              leagueGroup: parlay.league_group || null,
              earliestKickoff,
              latestKickoff,
              kickoffWindow: parlay.kickoff_window || 'today',
              status: 'active',
              apiVersion: apiTag,
              syncedAt: new Date(),
            },
          })

          // Delete old legs and recreate
          await prisma.parlayLeg.deleteMany({ where: { parlayId: pc.id } })

          let legsCreated = 0
          for (let i = 0; i < legs.length; i++) {
            const leg = legs[i]
            try {
              const matchId = String(leg.match_id || leg.matchId || '0').trim()
              // Player parlays may have player name as the "selection"
              const playerName = leg.player_name || leg.player || leg.name || ''
              const description = playerName ? `${playerName} to Score` : (leg.description || leg.selection || 'Player Pick')

              await prisma.parlayLeg.create({
                data: {
                  parlayId: pc.id,
                  matchId,
                  outcome: leg.outcome || leg.selection || description,
                  homeTeam: leg.home_team || leg.homeTeam || 'TBD',
                  awayTeam: leg.away_team || leg.awayTeam || 'TBD',
                  modelProb: Number(leg.model_prob || leg.probability || leg.score_prob || 0.3),
                  decimalOdds: Number(leg.decimal_odds || leg.odds || 3.0),
                  edge: Number(leg.edge || 0),
                  legOrder: i + 1,
                },
              })
              legsCreated++
            } catch (legErr) {
              logger.warn(`Failed to create player parlay leg ${i + 1}`, {
                tags: ['parlays', 'sync', source],
                data: { error: legErr instanceof Error ? legErr.message : 'Unknown' },
              })
            }
          }

          if (legsCreated > 0) {
            synced++
          } else {
            await prisma.parlayConsensus.delete({ where: { id: pc.id } })
            errors++
          }
        } catch (parlayErr) {
          errors++
        }
      }
    } catch (error) {
      logger.warn(`Failed to fetch player parlays from ${endpoint}`, {
        tags: ['parlays', 'sync', source],
        data: { error: error instanceof Error ? error.message : 'Unknown' },
      })
    }
  }

  return { synced, errors, source }
}

/**
 * Sync recommended parlays from backend
 * Endpoint: /api/v1/parlays/recommended
 */
export async function syncRecommendedParlays(): Promise<SyncResult> {
  const source = 'recommended'
  let synced = 0
  let errors = 0

  try {
    const data = await fetchBackend('/api/v1/parlays/recommended')
    const parlays = data.parlays || data.recommended || data.items || []

    if (!Array.isArray(parlays) || parlays.length === 0) {
      return { synced: 0, errors: 0, source }
    }

    for (const parlay of parlays) {
      try {
        const parlayId = parlay.parlay_id || `rec-${randomUUID()}`
        const legs = parlay.legs || []
        if (legs.length === 0) continue

        const combinedProb = parlay.combined_prob || 0.1
        const edgePct = parlay.edge_pct || 0

        const pc = await prisma.parlayConsensus.upsert({
          where: { parlayId },
          update: {
            legCount: legs.length,
            combinedProb,
            correlationPenalty: parlay.correlation_penalty || 1,
            adjustedProb: parlay.adjusted_prob || combinedProb,
            impliedOdds: parlay.implied_odds || (1 / combinedProb),
            edgePct,
            confidenceTier: parlay.confidence_tier || 'medium',
            parlayType: 'recommended',
            status: 'active',
            apiVersion: 'v1',
            syncedAt: new Date(),
          },
          create: {
            parlayId,
            legCount: legs.length,
            combinedProb,
            correlationPenalty: parlay.correlation_penalty || 1,
            adjustedProb: parlay.adjusted_prob || combinedProb,
            impliedOdds: parlay.implied_odds || (1 / combinedProb),
            edgePct,
            confidenceTier: parlay.confidence_tier || 'medium',
            parlayType: 'recommended',
            leagueGroup: parlay.league_group || null,
            earliestKickoff: parlay.earliest_kickoff ? new Date(parlay.earliest_kickoff) : new Date(),
            latestKickoff: parlay.latest_kickoff ? new Date(parlay.latest_kickoff) : new Date(),
            kickoffWindow: parlay.kickoff_window || 'today',
            status: 'active',
            apiVersion: 'v1',
            syncedAt: new Date(),
          },
        })

        await prisma.parlayLeg.deleteMany({ where: { parlayId: pc.id } })

        let legsCreated = 0
        for (let i = 0; i < legs.length; i++) {
          const leg = legs[i]
          try {
            await prisma.parlayLeg.create({
              data: {
                parlayId: pc.id,
                matchId: String(leg.match_id || '0').trim(),
                outcome: leg.outcome || 'H',
                homeTeam: leg.home_team || 'TBD',
                awayTeam: leg.away_team || 'TBD',
                modelProb: Number(leg.model_prob || 0.5),
                decimalOdds: Number(leg.decimal_odds || 2.0),
                edge: Number(leg.edge || 0),
                legOrder: i + 1,
              },
            })
            legsCreated++
          } catch {
            // Skip bad legs
          }
        }

        if (legsCreated > 0) synced++
        else {
          await prisma.parlayConsensus.delete({ where: { id: pc.id } })
          errors++
        }
      } catch {
        errors++
      }
    }
  } catch (error) {
    logger.warn(`Failed to fetch recommended parlays`, {
      tags: ['parlays', 'sync', source],
      data: { error: error instanceof Error ? error.message : 'Unknown' },
    })
  }

  return { synced, errors, source }
}

/**
 * Run a comprehensive sync of all parlay sources
 */
export async function syncAllParlays(): Promise<{
  autoParlays: SyncResult
  playerParlays: SyncResult
  recommended: SyncResult
}> {
  const [autoParlays, playerParlays, recommended] = await Promise.allSettled([
    syncAutoParlays(),
    syncPlayerParlays(),
    syncRecommendedParlays(),
  ])

  const defaultResult: SyncResult = { synced: 0, errors: 0, source: 'unknown' }

  return {
    autoParlays: autoParlays.status === 'fulfilled' ? autoParlays.value : { ...defaultResult, source: 'auto-parlays' },
    playerParlays: playerParlays.status === 'fulfilled' ? playerParlays.value : { ...defaultResult, source: 'player-parlays' },
    recommended: recommended.status === 'fulfilled' ? recommended.value : { ...defaultResult, source: 'recommended' },
  }
}

/**
 * Expire parlays whose latest kickoff has passed
 */
export async function expireOldParlays(): Promise<number> {
  const result = await prisma.parlayConsensus.updateMany({
    where: {
      latestKickoff: {
        not: null,
        lt: new Date()
      },
      status: 'active',
    },
    data: { status: 'expired' },
  })

  if (result.count > 0) {
    logger.info(`Expired ${result.count} old parlays`, {
      tags: ['parlays', 'expire'],
    })
  }

  return result.count
}

