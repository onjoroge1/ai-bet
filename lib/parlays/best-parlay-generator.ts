/**
 * Best Parlay Generator Service
 * 
 * Generates high-quality parlays from AdditionalMarketData table
 * Supports both multi-game (different matches) and single-game (same match) parlays
 */

import prisma from '@/lib/db'

export interface CandidateLeg {
  id: string
  matchId: string
  marketType: string
  marketSubtype: string | null
  line: number | null
  consensusProb: number
  consensusConfidence: number
  modelAgreement: number
  edgeConsensus: number
  riskLevel: string
  correlationTags: string[]
  decimalOdds: number | null
  impliedProb: number | null
}

export interface ParlayCombination {
  legs: CandidateLeg[]
  legCount: number
  combinedProb: number
  correlationPenalty: number
  adjustedProb: number
  impliedOdds: number
  parlayEdge: number
  qualityScore: number
  confidenceTier: string
  parlayType: 'multi_game' | 'single_game'
  isMultiGame: boolean
  matchIds: string[]
}

export interface GenerationConfig {
  minLegEdge?: number // Minimum edge per leg (default: 6%)
  minParlayEdge?: number // Minimum parlay-level edge (default: 8%)
  minCombinedProb?: number // Minimum combined probability (default: 15%)
  maxLegCount?: number // Maximum legs per parlay (default: 5)
  minModelAgreement?: number // Minimum model agreement (default: 0.65)
  maxResults?: number // Maximum results per leg count (default: 20)
  parlayType?: 'multi_game' | 'single_game' | 'both' // Type of parlays to generate
}

const DEFAULT_CONFIG: Required<GenerationConfig> = {
  minLegEdge: 0.0, // Temporarily set to 0% since odds aren't populated yet
  minParlayEdge: 5.0, // Lower threshold, will filter by probability instead
  minCombinedProb: 0.15,
  maxLegCount: 5,
  minModelAgreement: 0.65,
  maxResults: 20,
  parlayType: 'both'
}

/**
 * Step 1: Generate candidate leg pool from AdditionalMarketData
 */
async function generateCandidateLegPool(config: Required<GenerationConfig>): Promise<CandidateLeg[]> {
  const candidateLegs = await prisma.additionalMarketData.findMany({
    where: {
      // Only UPCOMING matches
      match: {
        status: 'UPCOMING',
        kickoffDate: {
          gte: new Date() // Future matches only
        },
        isActive: true
      },
      // Quality filters
      ...(config.minLegEdge > 0 ? {
        edgeConsensus: {
          gte: config.minLegEdge / 100 // Convert percentage to decimal
        }
      } : {}), // Only filter by edge if threshold > 0
      consensusProb: {
        gte: 0.50 // Minimum 50% probability per leg
      },
      modelAgreement: {
        gte: config.minModelAgreement
      }
    },
    include: {
      match: {
        select: {
          matchId: true,
          status: true,
          kickoffDate: true
        }
      }
    },
    orderBy: [
      { consensusProb: 'desc' }, // Sort by probability first (most important when edge is 0)
      { modelAgreement: 'desc' },
      { edgeConsensus: 'desc' }
    ],
    take: 100 // Limit to top 100 legs to avoid memory issues
  })

  return candidateLegs.map(market => ({
    id: market.id,
    matchId: market.matchId,
    marketType: market.marketType,
    marketSubtype: market.marketSubtype,
    line: market.line ? Number(market.line) : null,
    consensusProb: Number(market.consensusProb),
    consensusConfidence: Number(market.consensusConfidence),
    modelAgreement: Number(market.modelAgreement),
    edgeConsensus: Number(market.edgeConsensus) * 100, // Convert to percentage
    riskLevel: market.riskLevel,
    correlationTags: market.correlationTags,
    decimalOdds: market.decimalOdds ? Number(market.decimalOdds) : null,
    impliedProb: market.impliedProb ? Number(market.impliedProb) : null
  }))
}

/**
 * Step 2: Filter legs by correlation rules
 */
function filterCorrelatedLegs(
  legs: CandidateLeg[],
  parlayType: 'multi_game' | 'single_game'
): CandidateLeg[] {
  if (parlayType === 'multi_game') {
    // For multi-game: Group by matchId, take top 1-2 per match
    const legsByMatch = new Map<string, CandidateLeg[]>()
    
    for (const leg of legs) {
      if (!legsByMatch.has(leg.matchId)) {
        legsByMatch.set(leg.matchId, [])
      }
      legsByMatch.get(leg.matchId)!.push(leg)
    }
    
    // Take top 1-2 legs per match (sorted by edge)
    const filtered: CandidateLeg[] = []
    for (const [, matchLegs] of legsByMatch) {
      const sorted = matchLegs.sort((a, b) => b.edgeConsensus - a.edgeConsensus)
      filtered.push(...sorted.slice(0, 2)) // Top 2 per match
    }
    
    return filtered
  } else {
    // For single-game: All legs from same match, filter correlated markets
    return legs.filter(leg => {
      // Keep all legs (correlation will be handled in combination generation)
      return true
    })
  }
}

/**
 * Check if two legs are correlated
 */
function areLegsCorrelated(leg1: CandidateLeg, leg2: CandidateLeg): boolean {
  // Same match correlation checks
  if (leg1.matchId === leg2.matchId) {
    // Home Win + Over 2.5 correlation
    if (
      (leg1.marketType === '1X2' && leg1.marketSubtype === 'HOME' &&
       leg2.marketType === 'TOTALS' && leg2.marketSubtype === 'OVER' && leg2.line && leg2.line >= 2.5) ||
      (leg2.marketType === '1X2' && leg2.marketSubtype === 'HOME' &&
       leg1.marketType === 'TOTALS' && leg1.marketSubtype === 'OVER' && leg1.line && leg1.line >= 2.5)
    ) {
      return true
    }
    
    // Home Win + BTTS Yes correlation
    if (
      (leg1.marketType === '1X2' && leg1.marketSubtype === 'HOME' &&
       leg2.marketType === 'BTTS' && leg2.marketSubtype === 'YES') ||
      (leg2.marketType === '1X2' && leg2.marketSubtype === 'HOME' &&
       leg1.marketType === 'BTTS' && leg1.marketSubtype === 'YES')
    ) {
      return true
    }
    
    // Over 2.5 + BTTS Yes correlation
    if (
      (leg1.marketType === 'TOTALS' && leg1.marketSubtype === 'OVER' && leg1.line && leg1.line >= 2.5 &&
       leg2.marketType === 'BTTS' && leg2.marketSubtype === 'YES') ||
      (leg2.marketType === 'TOTALS' && leg2.marketSubtype === 'OVER' && leg2.line && leg2.line >= 2.5 &&
       leg1.marketType === 'BTTS' && leg1.marketSubtype === 'YES')
    ) {
      return true
    }
  }
  
  return false
}

/**
 * Calculate correlation penalty
 */
function calculateCorrelationPenalty(
  legCount: number,
  hasCorrelation: boolean,
  isMultiGame: boolean
): number {
  if (isMultiGame) {
    // Multi-game parlays: Lower penalty (different matches)
    const basePenalty = {
      2: 0.92, // 8% penalty
      3: 0.90, // 10% penalty
      4: 0.88, // 12% penalty
      5: 0.85  // 15% penalty
    }[legCount] || 0.85
    
    return hasCorrelation ? basePenalty * 0.95 : basePenalty
  } else {
    // Single-game parlays: Higher penalty (same match)
    const basePenalty = {
      2: 0.85, // 15% penalty
      3: 0.80, // 20% penalty
      4: 0.75, // 25% penalty
      5: 0.70  // 30% penalty
    }[legCount] || 0.70
    
    return hasCorrelation ? basePenalty * 0.90 : basePenalty
  }
}

/**
 * Calculate quality score (0-100)
 */
function calculateQualityScore(parlay: ParlayCombination): number {
  // Edge weight: 35%
  const edgeScore = Math.min(parlay.parlayEdge, 50) / 50 * 35
  
  // Probability weight: 25%
  const probScore = Math.min(parlay.adjustedProb * 100, 100) * 0.25
  
  // Model agreement weight: 20%
  const avgAgreement = parlay.legs.reduce((sum, leg) => sum + leg.modelAgreement, 0) / parlay.legCount
  const agreementScore = avgAgreement * 20
  
  // Diversification weight: 10%
  const uniqueMatches = new Set(parlay.matchIds).size
  const diversityScore = parlay.isMultiGame 
    ? (uniqueMatches === parlay.legCount ? 1.0 : 0.5) * 10
    : 0.5 * 10 // SGPs get lower diversity score
  
  // Risk adjustment: 10%
  const avgRiskScore = parlay.legs.reduce((sum, leg) => {
    const riskValue = leg.riskLevel === 'low' ? 1.0 : leg.riskLevel === 'medium' ? 0.8 : 0.6
    return sum + riskValue
  }, 0) / parlay.legCount
  const riskScore = avgRiskScore * 10
  
  return edgeScore + probScore + agreementScore + diversityScore + riskScore
}

/**
 * Generate combinations efficiently with early termination
 * Uses iterative approach with limited depth to avoid stack overflow
 */
function* generateCombinations(
  legs: CandidateLeg[],
  legCount: number,
  isMultiGame: boolean,
  maxCombinations: number = 10000
): Generator<CandidateLeg[], void, unknown> {
  if (legCount === 0) {
    yield []
    return
  }
  if (legs.length < legCount) return
  
  let count = 0
  
  if (isMultiGame) {
    // Multi-game: Each leg must be from different match
    const legsByMatch = new Map<string, CandidateLeg[]>()
    for (const leg of legs) {
      if (!legsByMatch.has(leg.matchId)) {
        legsByMatch.set(leg.matchId, [])
      }
      legsByMatch.get(leg.matchId)!.push(leg)
    }
    
    const uniqueMatchIds = Array.from(legsByMatch.keys())
    if (uniqueMatchIds.length < legCount) {
      return // Not enough different matches
    }
    
    // Limit to top 20 matches for performance
    const limitedMatchIds = uniqueMatchIds.slice(0, 20)
    if (limitedMatchIds.length < legCount) {
      return
    }
    
    // Iterative approach using a stack
    const stack: Array<{ current: CandidateLeg[], availableMatches: string[], remaining: number }> = [
      { current: [], availableMatches: limitedMatchIds, remaining: legCount }
    ]
    
    while (stack.length > 0 && count < maxCombinations) {
      const { current, availableMatches, remaining } = stack.pop()!
      
      if (remaining === 0) {
        yield [...current]
        count++
        continue
      }
      
      // Limit how many matches we explore to prevent explosion
      const matchesToExplore = availableMatches.slice(0, Math.min(10, availableMatches.length))
      
      for (let i = matchesToExplore.length - 1; i >= 0; i--) {
        const matchId = matchesToExplore[i]
        const matchLegs = legsByMatch.get(matchId) || []
        
        // Only take top leg per match for performance
        const topLeg = matchLegs[0]
        if (topLeg) {
          stack.push({
            current: [...current, topLeg],
            availableMatches: matchesToExplore.slice(i + 1),
            remaining: remaining - 1
          })
        }
      }
    }
  } else {
    // Single-game: All legs from same match
    // Group by match first
    const legsByMatch = new Map<string, CandidateLeg[]>()
    for (const leg of legs) {
      if (!legsByMatch.has(leg.matchId)) {
        legsByMatch.set(leg.matchId, [])
      }
      legsByMatch.get(leg.matchId)!.push(leg)
    }
    
    // Generate for each match separately
    for (const [, matchLegs] of legsByMatch) {
      if (matchLegs.length < legCount) continue
      
      // Limit to top 10 legs per match
      const limitedLegs = matchLegs.slice(0, 10)
      
      // Iterative approach
      const stack: Array<{ current: CandidateLeg[], start: number, remaining: number }> = [
        { current: [], start: 0, remaining: legCount }
      ]
      
      while (stack.length > 0 && count < maxCombinations) {
        const { current, start, remaining } = stack.pop()!
        
        if (remaining === 0) {
          yield [...current]
          count++
          continue
        }
        
        const end = Math.min(start + remaining + 5, limitedLegs.length) // Limit search space
        
        for (let i = end - 1; i >= start; i--) {
          const leg = limitedLegs[i]
          stack.push({
            current: [...current, leg],
            start: i + 1,
            remaining: remaining - 1
          })
        }
      }
      
      if (count >= maxCombinations) break
    }
  }
}

/**
 * Step 3: Generate parlay combinations
 */
function generateParlayCombinations(
  filteredLegs: CandidateLeg[],
  config: Required<GenerationConfig>,
  parlayType: 'multi_game' | 'single_game'
): ParlayCombination[] {
  const isMultiGame = parlayType === 'multi_game'
  const parlays: ParlayCombination[] = []
  
  for (let legCount = 2; legCount <= config.maxLegCount; legCount++) {
    const combinationGenerator = generateCombinations(filteredLegs, legCount, isMultiGame, 5000)
    let combinationCount = 0
    
    for (const legs of combinationGenerator) {
      combinationCount++
      
      // Limit total combinations processed
      if (combinationCount > 10000) {
        break
      }
      // Calculate combined probability
      const combinedProb = legs.reduce((prod, leg) => prod * leg.consensusProb, 1)
      
      // Check correlation
      let hasCorrelation = false
      for (let i = 0; i < legs.length; i++) {
        for (let j = i + 1; j < legs.length; j++) {
          if (areLegsCorrelated(legs[i], legs[j])) {
            hasCorrelation = true
            break
          }
        }
        if (hasCorrelation) break
      }
      
      // Calculate correlation penalty
      const correlationPenalty = calculateCorrelationPenalty(legCount, hasCorrelation, isMultiGame)
      const adjustedProb = combinedProb * correlationPenalty
      
      // Calculate parlay-level edge
      const impliedOdds = 1 / adjustedProb
      const fairOdds = 1 / combinedProb
      const parlayEdge = ((impliedOdds - fairOdds) / fairOdds) * 100
      
      // Filter by thresholds
      if (parlayEdge < config.minParlayEdge || adjustedProb < config.minCombinedProb) {
        continue
      }
      
      // Calculate average model agreement
      const avgAgreement = legs.reduce((sum, leg) => sum + leg.modelAgreement, 0) / legCount
      
      // Determine confidence tier
      let confidenceTier = 'low'
      if (avgAgreement >= 0.80 && parlayEdge >= 15) {
        confidenceTier = 'high'
      } else if (avgAgreement >= 0.70 && parlayEdge >= 10) {
        confidenceTier = 'medium'
      }
      
      const matchIds = legs.map(l => l.matchId)
      
      const parlay: ParlayCombination = {
        legs,
        legCount,
        combinedProb,
        correlationPenalty,
        adjustedProb,
        impliedOdds,
        parlayEdge,
        qualityScore: 0, // Will calculate after
        confidenceTier,
        parlayType,
        isMultiGame,
        matchIds
      }
      
      // Calculate quality score
      parlay.qualityScore = calculateQualityScore(parlay)
      
      parlays.push(parlay)
    }
  }
  
  return parlays
}

/**
 * Main function: Generate best parlays
 */
export async function generateBestParlays(
  config: GenerationConfig = {}
): Promise<ParlayCombination[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Step 1: Generate candidate leg pool
  const candidateLegs = await generateCandidateLegPool(finalConfig)
  
  if (candidateLegs.length === 0) {
    return []
  }
  
  const allParlays: ParlayCombination[] = []
  
  // Generate multi-game parlays
  if (finalConfig.parlayType === 'both' || finalConfig.parlayType === 'multi_game') {
    const multiGameLegs = filterCorrelatedLegs(candidateLegs, 'multi_game')
    const multiGameParlays = generateParlayCombinations(multiGameLegs, finalConfig, 'multi_game')
    allParlays.push(...multiGameParlays)
  }
  
  // Generate single-game parlays
  if (finalConfig.parlayType === 'both' || finalConfig.parlayType === 'single_game') {
    // Group by match for SGP generation
    const legsByMatch = new Map<string, CandidateLeg[]>()
    for (const leg of candidateLegs) {
      if (!legsByMatch.has(leg.matchId)) {
        legsByMatch.set(leg.matchId, [])
      }
      legsByMatch.get(leg.matchId)!.push(leg)
    }
    
    for (const [, matchLegs] of legsByMatch) {
      if (matchLegs.length >= 2) {
        const sgpLegs = filterCorrelatedLegs(matchLegs, 'single_game')
        const sgps = generateParlayCombinations(sgpLegs, finalConfig, 'single_game')
        allParlays.push(...sgps)
      }
    }
  }
  
  // Sort by quality score and edge
  allParlays.sort((a, b) => {
    if (Math.abs(a.qualityScore - b.qualityScore) > 0.1) {
      return b.qualityScore - a.qualityScore
    }
    return b.parlayEdge - a.parlayEdge
  })
  
  // Limit results per leg count
  const resultMap = new Map<number, ParlayCombination[]>()
  for (const parlay of allParlays) {
    if (!resultMap.has(parlay.legCount)) {
      resultMap.set(parlay.legCount, [])
    }
    const legCountParlays = resultMap.get(parlay.legCount)!
    if (legCountParlays.length < finalConfig.maxResults) {
      legCountParlays.push(parlay)
    }
  }
  
  // Flatten and return
  const results: ParlayCombination[] = []
  for (const [, parlays] of resultMap) {
    results.push(...parlays)
  }
  
  return results.sort((a, b) => b.qualityScore - a.qualityScore)
}

