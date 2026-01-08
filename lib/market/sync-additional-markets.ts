/**
 * Sync Additional Market Data from QuickPurchase.predictionData.additional_markets_v2
 * to the AdditionalMarketData table
 */

import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

interface AdditionalMarketsV2 {
  dnb?: { home: number; away: number }
  btts?: { yes: number; no: number }
  totals?: Record<string, { over: number; under: number }>
  double_chance?: { "12": number; "1X": number; "X2": number }
  asian_handicap?: {
    home?: Record<string, { win: number; lose: number; push?: number }>
    away?: Record<string, { win: number; lose: number; push?: number }>
  }
  team_totals?: {
    home?: Record<string, { over: number; under: number }>
    away?: Record<string, { over: number; under: number }>
  }
  win_to_nil?: { home: number; away: number }
  clean_sheet?: { home: number; away: number }
  lambdas?: { home: number; away: number; fit_loss?: number }
  coherence?: {
    hda_sum?: number
    fit_loss?: number
    [key: string]: any
  }
}

interface V1ModelData {
  pick?: string
  confidence?: number
  probs?: { home: number; draw: number; away: number }
}

interface V2ModelData {
  pick?: string
  confidence?: number
  probs?: { home: number; draw: number; away: number }
}

/**
 * Calculate consensus probability from v1 and v2 models
 */
function calculateConsensus(
  v1Prob: number | undefined,
  v2Prob: number | undefined,
  v1Conf: number | undefined,
  v2Conf: number | undefined
): {
  consensusProb: number
  consensusConfidence: number
  modelAgreement: number
} {
  // If only one model available, use it
  if (!v1Prob && !v2Prob) {
    return { consensusProb: 0, consensusConfidence: 0, modelAgreement: 0 }
  }
  
  if (v1Prob && !v2Prob) {
    return {
      consensusProb: v1Prob,
      consensusConfidence: v1Conf || 0.5,
      modelAgreement: 1.0
    }
  }
  
  if (!v1Prob && v2Prob) {
    return {
      consensusProb: v2Prob,
      consensusConfidence: v2Conf || 0.5,
      modelAgreement: 1.0
    }
  }

  // Both models available - calculate weighted consensus
  const v1Weight = (v1Conf || 0.5) / ((v1Conf || 0.5) + (v2Conf || 0.5))
  const v2Weight = (v2Conf || 0.5) / ((v1Conf || 0.5) + (v2Conf || 0.5))

  const consensusProb = (v1Prob! * v1Weight) + (v2Prob! * v2Weight)
  const consensusConfidence = ((v1Conf || 0.5) + (v2Conf || 0.5)) / 2
  const modelAgreement = 1 - Math.abs(v1Prob! - v2Prob!)

  return { consensusProb, consensusConfidence, modelAgreement }
}

/**
 * Calculate edge from probability and odds
 */
function calculateEdge(modelProb: number, impliedProb: number): number {
  if (!impliedProb || impliedProb <= 0) return 0
  if (!modelProb || modelProb <= 0) return 0
  return (modelProb / impliedProb) - 1
}

/**
 * Determine risk level based on probability
 */
function getRiskLevel(prob: number): 'low' | 'medium' | 'high' {
  if (prob >= 0.20) return 'low'
  if (prob >= 0.10) return 'medium'
  return 'high'
}

/**
 * Get correlation tags for a market
 */
function getCorrelationTags(
  marketType: string,
  marketSubtype: string | null,
  line: number | null
): string[] {
  const tags: string[] = []
  
  if (marketType === 'TOTALS') {
    tags.push('TOTALS')
    if (line !== null) {
      if (line <= 1.5) tags.push('GOALS_LOW')
      if (line >= 2.5) tags.push('GOALS_HIGH')
      if (marketSubtype === 'OVER') tags.push('OVER')
      if (marketSubtype === 'UNDER') tags.push('UNDER')
    }
  }
  
  if (marketType === 'BTTS') {
    tags.push('BTTS')
    if (marketSubtype === 'YES') tags.push('GOALS_HIGH')
    if (marketSubtype === 'NO') tags.push('GOALS_LOW')
  }
  
  if (marketType === 'DNB' || marketType === '1X2') {
    tags.push('MATCH_RESULT')
    if (marketSubtype === 'HOME') tags.push('HOME_WIN')
    if (marketSubtype === 'AWAY') tags.push('AWAY_WIN')
  }
  
  return tags
}

/**
 * Process and sync additional market data for a single match
 */
async function syncMatchAdditionalMarkets(
  matchId: string,
  predictionData: any,
  v1Model: V1ModelData | null,
  v2Model: V2ModelData | null
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0
  let updated = 0
  let errors = 0

  try {
    const marketsV2 = predictionData?.additional_markets_v2 as AdditionalMarketsV2 | undefined

    if (!marketsV2) {
      logger.debug(`No additional_markets_v2 found for match ${matchId}`)
      return { created, updated, errors }
    }

    const marketRecords: Prisma.AdditionalMarketDataCreateManyInput[] = []

    // Process 1X2 markets from v1/v2 models
    if (v1Model?.probs || v2Model?.probs) {
      const v1Probs = v1Model?.probs
      const v2Probs = v2Model?.probs

      // Home Win
      if (v1Probs?.home || v2Probs?.home) {
        const consensus = calculateConsensus(
          v1Probs?.home,
          v2Probs?.home,
          v1Model?.confidence,
          v2Model?.confidence
        )
        marketRecords.push({
          matchId,
          marketType: '1X2',
          marketSubtype: 'HOME',
          line: null,
          v1ModelProb: v1Probs?.home ? new Prisma.Decimal(v1Probs.home) : null,
          v1Confidence: v1Model?.confidence ? new Prisma.Decimal(v1Model.confidence) : null,
          v1Pick: v1Model?.pick,
          v2ModelProb: v2Probs?.home ? new Prisma.Decimal(v2Probs.home) : null,
          v2Confidence: v2Model?.confidence ? new Prisma.Decimal(v2Model.confidence) : null,
          v2Pick: v2Model?.pick,
          consensusProb: new Prisma.Decimal(consensus.consensusProb),
          consensusConfidence: new Prisma.Decimal(consensus.consensusConfidence),
          modelAgreement: new Prisma.Decimal(consensus.modelAgreement),
          edgeConsensus: new Prisma.Decimal(0), // Will be calculated if odds available
          correlationTags: getCorrelationTags('1X2', 'HOME', null),
          riskLevel: getRiskLevel(consensus.consensusProb),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }

      // Draw
      if (v1Probs?.draw || v2Probs?.draw) {
        const consensus = calculateConsensus(
          v1Probs?.draw,
          v2Probs?.draw,
          v1Model?.confidence,
          v2Model?.confidence
        )
        marketRecords.push({
          matchId,
          marketType: '1X2',
          marketSubtype: 'DRAW',
          line: null,
          v1ModelProb: v1Probs?.draw ? new Prisma.Decimal(v1Probs.draw) : null,
          v1Confidence: v1Model?.confidence ? new Prisma.Decimal(v1Model.confidence) : null,
          v1Pick: v1Model?.pick,
          v2ModelProb: v2Probs?.draw ? new Prisma.Decimal(v2Probs.draw) : null,
          v2Confidence: v2Model?.confidence ? new Prisma.Decimal(v2Model.confidence) : null,
          v2Pick: v2Model?.pick,
          consensusProb: new Prisma.Decimal(consensus.consensusProb),
          consensusConfidence: new Prisma.Decimal(consensus.consensusConfidence),
          modelAgreement: new Prisma.Decimal(consensus.modelAgreement),
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: getCorrelationTags('1X2', 'DRAW', null),
          riskLevel: getRiskLevel(consensus.consensusProb),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }

      // Away Win
      if (v1Probs?.away || v2Probs?.away) {
        const consensus = calculateConsensus(
          v1Probs?.away,
          v2Probs?.away,
          v1Model?.confidence,
          v2Model?.confidence
        )
        marketRecords.push({
          matchId,
          marketType: '1X2',
          marketSubtype: 'AWAY',
          line: null,
          v1ModelProb: v1Probs?.away ? new Prisma.Decimal(v1Probs.away) : null,
          v1Confidence: v1Model?.confidence ? new Prisma.Decimal(v1Model.confidence) : null,
          v1Pick: v1Model?.pick,
          v2ModelProb: v2Probs?.away ? new Prisma.Decimal(v2Probs.away) : null,
          v2Confidence: v2Model?.confidence ? new Prisma.Decimal(v2Model.confidence) : null,
          v2Pick: v2Model?.pick,
          consensusProb: new Prisma.Decimal(consensus.consensusProb),
          consensusConfidence: new Prisma.Decimal(consensus.consensusConfidence),
          modelAgreement: new Prisma.Decimal(consensus.modelAgreement),
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: getCorrelationTags('1X2', 'AWAY', null),
          riskLevel: getRiskLevel(consensus.consensusProb),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }
    }

    // Process DNB (Draw No Bet)
    if (marketsV2.dnb) {
      if (marketsV2.dnb.home) {
        marketRecords.push({
          matchId,
          marketType: 'DNB',
          marketSubtype: 'HOME',
          line: null,
          consensusProb: new Prisma.Decimal(marketsV2.dnb.home),
          consensusConfidence: new Prisma.Decimal(0.7), // Default confidence for DNB
          modelAgreement: new Prisma.Decimal(1.0), // Single source
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: getCorrelationTags('DNB', 'HOME', null),
          riskLevel: getRiskLevel(marketsV2.dnb.home),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }
      if (marketsV2.dnb.away) {
        marketRecords.push({
          matchId,
          marketType: 'DNB',
          marketSubtype: 'AWAY',
          line: null,
          consensusProb: new Prisma.Decimal(marketsV2.dnb.away),
          consensusConfidence: new Prisma.Decimal(0.7),
          modelAgreement: new Prisma.Decimal(1.0),
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: getCorrelationTags('DNB', 'AWAY', null),
          riskLevel: getRiskLevel(marketsV2.dnb.away),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }
    }

    // Process BTTS (Both Teams to Score)
    if (marketsV2.btts) {
      if (marketsV2.btts.yes) {
        marketRecords.push({
          matchId,
          marketType: 'BTTS',
          marketSubtype: 'YES',
          line: null,
          consensusProb: new Prisma.Decimal(marketsV2.btts.yes),
          consensusConfidence: new Prisma.Decimal(0.7),
          modelAgreement: new Prisma.Decimal(1.0),
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: getCorrelationTags('BTTS', 'YES', null),
          riskLevel: getRiskLevel(marketsV2.btts.yes),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }
      if (marketsV2.btts.no) {
        marketRecords.push({
          matchId,
          marketType: 'BTTS',
          marketSubtype: 'NO',
          line: null,
          consensusProb: new Prisma.Decimal(marketsV2.btts.no),
          consensusConfidence: new Prisma.Decimal(0.7),
          modelAgreement: new Prisma.Decimal(1.0),
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: getCorrelationTags('BTTS', 'NO', null),
          riskLevel: getRiskLevel(marketsV2.btts.no),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }
    }

    // Process Totals (Over/Under)
    if (marketsV2.totals) {
      for (const [lineStr, values] of Object.entries(marketsV2.totals)) {
        const line = parseFloat(lineStr.replace('_', '.'))
        
        if (values.over) {
          marketRecords.push({
            matchId,
            marketType: 'TOTALS',
            marketSubtype: 'OVER',
            line: new Prisma.Decimal(line),
            consensusProb: new Prisma.Decimal(values.over),
            consensusConfidence: new Prisma.Decimal(0.7),
            modelAgreement: new Prisma.Decimal(1.0),
            edgeConsensus: new Prisma.Decimal(0),
            correlationTags: getCorrelationTags('TOTALS', 'OVER', line),
            riskLevel: getRiskLevel(values.over),
            settleType: 'WIN_LOSE',
            dataSource: 'additional_markets_v2',
          })
        }
        
        if (values.under) {
          marketRecords.push({
            matchId,
            marketType: 'TOTALS',
            marketSubtype: 'UNDER',
            line: new Prisma.Decimal(line),
            consensusProb: new Prisma.Decimal(values.under),
            consensusConfidence: new Prisma.Decimal(0.7),
            modelAgreement: new Prisma.Decimal(1.0),
            edgeConsensus: new Prisma.Decimal(0),
            correlationTags: getCorrelationTags('TOTALS', 'UNDER', line),
            riskLevel: getRiskLevel(values.under),
            settleType: 'WIN_LOSE',
            dataSource: 'additional_markets_v2',
          })
        }
      }
    }

    // Process Double Chance
    if (marketsV2.double_chance) {
      if (marketsV2.double_chance["12"]) {
        marketRecords.push({
          matchId,
          marketType: 'DOUBLE_CHANCE',
          marketSubtype: '12',
          line: null,
          consensusProb: new Prisma.Decimal(marketsV2.double_chance["12"]),
          consensusConfidence: new Prisma.Decimal(0.7),
          modelAgreement: new Prisma.Decimal(1.0),
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: ['DOUBLE_CHANCE', 'MATCH_RESULT'],
          riskLevel: getRiskLevel(marketsV2.double_chance["12"]),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }
      if (marketsV2.double_chance["1X"]) {
        marketRecords.push({
          matchId,
          marketType: 'DOUBLE_CHANCE',
          marketSubtype: '1X',
          line: null,
          consensusProb: new Prisma.Decimal(marketsV2.double_chance["1X"]),
          consensusConfidence: new Prisma.Decimal(0.7),
          modelAgreement: new Prisma.Decimal(1.0),
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: ['DOUBLE_CHANCE', 'MATCH_RESULT', 'HOME_WIN'],
          riskLevel: getRiskLevel(marketsV2.double_chance["1X"]),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }
      if (marketsV2.double_chance["X2"]) {
        marketRecords.push({
          matchId,
          marketType: 'DOUBLE_CHANCE',
          marketSubtype: 'X2',
          line: null,
          consensusProb: new Prisma.Decimal(marketsV2.double_chance["X2"]),
          consensusConfidence: new Prisma.Decimal(0.7),
          modelAgreement: new Prisma.Decimal(1.0),
          edgeConsensus: new Prisma.Decimal(0),
          correlationTags: ['DOUBLE_CHANCE', 'MATCH_RESULT', 'AWAY_WIN'],
          riskLevel: getRiskLevel(marketsV2.double_chance["X2"]),
          settleType: 'WIN_LOSE',
          dataSource: 'additional_markets_v2',
        })
      }
    }

    // Upsert all market records
    for (const record of marketRecords) {
      try {
        // Check if record exists first to determine if it's create or update
        const existing = await prisma.additionalMarketData.findFirst({
          where: {
            matchId: record.matchId,
            marketType: record.marketType,
            marketSubtype: record.marketSubtype ?? null,
            line: record.line ?? null,
          },
        })

        if (existing) {
          await prisma.additionalMarketData.update({
            where: { id: existing.id },
            data: {
              ...record,
              lastUpdated: new Date(),
            },
          })
          updated++
        } else {
          await prisma.additionalMarketData.create({
            data: record,
          })
          created++
        }

        if (existing) {
          updated++
        } else {
          created++
        }
      } catch (error) {
        errors++
        logger.error(`Failed to upsert market data for match ${matchId}`, {
          error: error instanceof Error ? error.message : String(error),
          marketType: record.marketType,
          marketSubtype: record.marketSubtype,
        })
      }
    }
  } catch (error) {
    errors++
    logger.error(`Failed to process additional markets for match ${matchId}`, {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return { created, updated, errors }
}

/**
 * Sync additional market data for all upcoming matches
 */
export async function syncAdditionalMarketsForUpcomingMatches(): Promise<{
  total: number
  processed: number
  created: number
  updated: number
  errors: number
  skipped: number
}> {
  const startTime = Date.now()
  let total = 0
  let processed = 0
  let totalCreated = 0
  let totalUpdated = 0
  let totalErrors = 0
  let skipped = 0

  try {
    logger.info('🔄 Starting sync of additional market data for upcoming matches', {
      tags: ['sync', 'additional-markets'],
    })

    // Get all upcoming matches
    const upcomingMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: { gte: new Date() },
        isActive: true,
      },
      select: {
        matchId: true,
        v1Model: true,
        v2Model: true,
      },
    })

    total = upcomingMatches.length
    logger.info(`Found ${total} upcoming matches to process`, {
      tags: ['sync', 'additional-markets'],
    })

    // Get QuickPurchase records for these matches
    const matchIds = upcomingMatches.map((m) => m.matchId)
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: { in: matchIds },
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: Prisma.JsonNull },
      },
      select: {
        matchId: true,
        predictionData: true,
      },
    })

    const qpMap = new Map(quickPurchases.map((qp) => [qp.matchId, qp]))

    // Process each match
    for (const match of upcomingMatches) {
      const quickPurchase = qpMap.get(match.matchId)

      if (!quickPurchase || !quickPurchase.predictionData) {
        skipped++
        continue
      }

      const result = await syncMatchAdditionalMarkets(
        match.matchId,
        quickPurchase.predictionData,
        match.v1Model as V1ModelData | null,
        match.v2Model as V2ModelData | null
      )

      totalCreated += result.created
      totalUpdated += result.updated
      totalErrors += result.errors
      processed++

      // Log progress every 10 matches
      if (processed % 10 === 0) {
        logger.debug(`Processed ${processed}/${total} matches`, {
          tags: ['sync', 'additional-markets'],
        })
      }
    }

    const duration = Date.now() - startTime
    logger.info('✅ Completed sync of additional market data', {
      tags: ['sync', 'additional-markets'],
      data: {
        total,
        processed,
        created: totalCreated,
        updated: totalUpdated,
        errors: totalErrors,
        skipped,
        durationMs: duration,
      },
    })

    return {
      total,
      processed,
      created: totalCreated,
      updated: totalUpdated,
      errors: totalErrors,
      skipped,
    }
  } catch (error) {
    logger.error('❌ Failed to sync additional market data', {
      tags: ['sync', 'additional-markets'],
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

