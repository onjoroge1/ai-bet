/**
 * Parlay Analysis Script - Enhanced Version
 * 
 * Analyzes:
 * 1. UPCOMING matches from MarketMatch table
 * 2. Potential single-game parlays from QuickPurchase.predictionData.additional_markets_v2
 * 3. Existing multi-game parlays for UPCOMING matches
 * 4. High-performing parlay combinations
 * 
 * Run with: npx tsx scripts/analyze-parlays.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MarketData {
  dnb?: { home: number; away: number }
  btts?: { yes: number; no: number }
  totals?: Record<string, { over: number; under: number }>
  asian_handicap?: {
    home?: Record<string, { win: number; lose: number; push?: number }>
    away?: Record<string, { win: number; lose: number; push?: number }>
  }
  double_chance?: { "12": number; "1X": number; "X2": number }
  win_to_nil?: { home: number; away: number }
  clean_sheet?: { home: number; away: number }
  team_totals?: {
    home?: Record<string, { over: number; under: number }>
    away?: Record<string, { over: number; under: number }>
  }
}

interface PotentialSGP {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: Date
  legs: Array<{
    market: string
    side: string
    probability: number
    description: string
  }>
  combinedProb: number
  fairOdds: number
  confidence: 'high' | 'medium' | 'low'
}

async function analyzeParlays() {
  console.log('🔍 Analyzing parlays for UPCOMING matches...\n')
  
  try {
    // Step 1: Get UPCOMING matches from MarketMatch
    console.log('📊 Step 1: Fetching UPCOMING matches from MarketMatch...')
    const upcomingMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: { gte: new Date() },
        isActive: true
      },
      select: { 
        id: true,
        matchId: true, 
        homeTeam: true, 
        awayTeam: true, 
        league: true, 
        kickoffDate: true 
      },
      orderBy: { kickoffDate: 'asc' }
    })
    
    console.log(`   ✅ Found ${upcomingMatches.length} UPCOMING matches`)
    if (upcomingMatches.length === 0) {
      console.log('   ⚠️  No UPCOMING matches found. Exiting.\n')
      return
    }
    
    const upcomingMatchIdSet = new Set(upcomingMatches.map(m => m.matchId))
    console.log(`   📅 Date range: ${upcomingMatches[0].kickoffDate.toISOString()} to ${upcomingMatches[upcomingMatches.length - 1].kickoffDate.toISOString()}\n`)
    
    // Step 2: Get QuickPurchase records with predictionData for UPCOMING matches
    console.log('📊 Step 2: Fetching QuickPurchase records with predictionData...')
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: { in: Array.from(upcomingMatchIdSet) },
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: null }
      },
      select: {
        id: true,
        matchId: true,
        name: true,
        predictionData: true
      }
    })
    
    console.log(`   ✅ Found ${quickPurchases.length} QuickPurchase records with predictionData\n`)
    
    // Step 3: Analyze potential single-game parlays from additional_markets_v2
    console.log('📊 Step 3: Analyzing potential single-game parlays from additional_markets_v2...')
    const potentialSGPs: PotentialSGP[] = []
    
    for (const qp of quickPurchases) {
      const match = upcomingMatches.find(m => m.matchId === qp.matchId)
      if (!match) continue
      
      const predictionData = qp.predictionData as any
      const marketsV2 = predictionData?.additional_markets_v2 as MarketData | undefined
      
      if (!marketsV2) continue
      
      // Generate potential SGP legs from available markets
      const legs: PotentialSGP['legs'] = []
      
      // Safe Builder (2-3 legs) - High probability markets
      if (marketsV2.dnb) {
        if (marketsV2.dnb.home >= 0.55) {
          legs.push({
            market: 'DNB',
            side: 'HOME',
            probability: marketsV2.dnb.home,
            description: `Draw No Bet - Home (${(marketsV2.dnb.home * 100).toFixed(1)}%)`
          })
        }
        if (marketsV2.dnb.away >= 0.55) {
          legs.push({
            market: 'DNB',
            side: 'AWAY',
            probability: marketsV2.dnb.away,
            description: `Draw No Bet - Away (${(marketsV2.dnb.away * 100).toFixed(1)}%)`
          })
        }
      }
      
      // Totals - Under lines (safe)
      if (marketsV2.totals) {
        if (marketsV2.totals['3_5']?.under >= 0.55) {
          legs.push({
            market: 'TOTALS',
            side: 'UNDER',
            probability: marketsV2.totals['3_5'].under,
            description: `Under 3.5 Goals (${(marketsV2.totals['3_5'].under * 100).toFixed(1)}%)`
          })
        }
        if (marketsV2.totals['4_5']?.under >= 0.55) {
          legs.push({
            market: 'TOTALS',
            side: 'UNDER',
            probability: marketsV2.totals['4_5'].under,
            description: `Under 4.5 Goals (${(marketsV2.totals['4_5'].under * 100).toFixed(1)}%)`
          })
        }
        if (marketsV2.totals['2_5']?.over >= 0.55) {
          legs.push({
            market: 'TOTALS',
            side: 'OVER',
            probability: marketsV2.totals['2_5'].over,
            description: `Over 2.5 Goals (${(marketsV2.totals['2_5'].over * 100).toFixed(1)}%)`
          })
        }
      }
      
      // BTTS
      if (marketsV2.btts) {
        if (marketsV2.btts.no >= 0.55) {
          legs.push({
            market: 'BTTS',
            side: 'NO',
            probability: marketsV2.btts.no,
            description: `Both Teams to Score - No (${(marketsV2.btts.no * 100).toFixed(1)}%)`
          })
        }
        if (marketsV2.btts.yes >= 0.55) {
          legs.push({
            market: 'BTTS',
            side: 'YES',
            probability: marketsV2.btts.yes,
            description: `Both Teams to Score - Yes (${(marketsV2.btts.yes * 100).toFixed(1)}%)`
          })
        }
      }
      
      // Double Chance
      if (marketsV2.double_chance) {
        if (marketsV2.double_chance['1X'] >= 0.55) {
          legs.push({
            market: 'DOUBLE_CHANCE',
            side: '1X',
            probability: marketsV2.double_chance['1X'],
            description: `Double Chance 1X (${(marketsV2.double_chance['1X'] * 100).toFixed(1)}%)`
          })
        }
        if (marketsV2.double_chance['X2'] >= 0.55) {
          legs.push({
            market: 'DOUBLE_CHANCE',
            side: 'X2',
            probability: marketsV2.double_chance['X2'],
            description: `Double Chance X2 (${(marketsV2.double_chance['X2'] * 100).toFixed(1)}%)`
          })
        }
      }
      
      // Win to Nil
      if (marketsV2.win_to_nil) {
        if (marketsV2.win_to_nil.home >= 0.35) {
          legs.push({
            market: 'WIN_TO_NIL',
            side: 'HOME',
            probability: marketsV2.win_to_nil.home,
            description: `Win to Nil - Home (${(marketsV2.win_to_nil.home * 100).toFixed(1)}%)`
          })
        }
        if (marketsV2.win_to_nil.away >= 0.35) {
          legs.push({
            market: 'WIN_TO_NIL',
            side: 'AWAY',
            probability: marketsV2.win_to_nil.away,
            description: `Win to Nil - Away (${(marketsV2.win_to_nil.away * 100).toFixed(1)}%)`
          })
        }
      }
      
      // Generate SGP combinations (2-3 legs)
      if (legs.length >= 2) {
        // Safe combinations (2 legs, high probability)
        const safeLegs = legs.filter(l => l.probability >= 0.55).slice(0, 3)
        if (safeLegs.length >= 2) {
          for (let i = 0; i < safeLegs.length - 1; i++) {
            for (let j = i + 1; j < safeLegs.length; j++) {
              const leg1 = safeLegs[i]
              const leg2 = safeLegs[j]
              
              // Avoid contradictory legs
              if (leg1.market === leg2.market && leg1.side !== leg2.side) continue
              
              const combinedProb = leg1.probability * leg2.probability
              const fairOdds = 1 / combinedProb
              
              potentialSGPs.push({
                matchId: match.matchId,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                league: match.league,
                kickoffDate: match.kickoffDate,
                legs: [leg1, leg2],
                combinedProb,
                fairOdds,
                confidence: combinedProb >= 0.30 ? 'high' : combinedProb >= 0.20 ? 'medium' : 'low'
              })
              
              // 3-leg combinations if available
              if (safeLegs.length >= 3 && j < safeLegs.length - 1) {
                for (let k = j + 1; k < safeLegs.length; k++) {
                  const leg3 = safeLegs[k]
                  if (leg1.market === leg3.market && leg1.side !== leg3.side) continue
                  if (leg2.market === leg3.market && leg2.side !== leg3.side) continue
                  
                  const combinedProb3 = leg1.probability * leg2.probability * leg3.probability
                  const fairOdds3 = 1 / combinedProb3
                  
                  potentialSGPs.push({
                    matchId: match.matchId,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    league: match.league,
                    kickoffDate: match.kickoffDate,
                    legs: [leg1, leg2, leg3],
                    combinedProb: combinedProb3,
                    fairOdds: fairOdds3,
                    confidence: combinedProb3 >= 0.20 ? 'medium' : 'low'
                  })
                }
              }
            }
          }
        }
      }
    }
    
    // Sort by combined probability (highest first)
    potentialSGPs.sort((a, b) => b.combinedProb - a.combinedProb)
    
    console.log(`   ✅ Generated ${potentialSGPs.length} potential single-game parlay combinations\n`)
    
    // Step 4: Analyze existing parlays for UPCOMING matches
    console.log('📊 Step 4: Analyzing existing parlays for UPCOMING matches...')
    const allParlays = await prisma.parlayConsensus.findMany({
      where: { status: 'active' },
      include: { 
        legs: { 
          orderBy: { legOrder: 'asc' } 
        } 
      }
    })
    
    // Filter for parlays where ALL legs are from UPCOMING matches
    const fullyUpcomingParlays = allParlays.filter(parlay => {
      return parlay.legs.length > 0 && parlay.legs.every(leg => upcomingMatchIdSet.has(leg.matchId))
    })
    
    // Sort by edge percentage (highest first)
    fullyUpcomingParlays.sort((a, b) => Number(b.edgePct) - Number(a.edgePct))
    
    console.log(`   ✅ Found ${fullyUpcomingParlays.length} existing parlays (all legs UPCOMING)\n`)
    
    // Step 5: Present Results
    console.log('\n' + '═'.repeat(100))
    console.log('🎯 POTENTIAL PARLAYS FOR UPCOMING MATCHES')
    console.log('═'.repeat(100))
    
    // Single-Game Parlays
    if (potentialSGPs.length > 0) {
      console.log(`\n📋 SINGLE-GAME PARLAYS (${potentialSGPs.length} potential combinations)`)
      console.log('─'.repeat(100))
      
      // Group by match
      const sgpsByMatch = new Map<string, PotentialSGP[]>()
      potentialSGPs.forEach(sgp => {
        const key = sgp.matchId
        if (!sgpsByMatch.has(key)) {
          sgpsByMatch.set(key, [])
        }
        sgpsByMatch.get(key)!.push(sgp)
      })
      
      let count = 1
      for (const [matchId, sgps] of Array.from(sgpsByMatch.entries()).slice(0, 10)) {
        const firstSGP = sgps[0]
        console.log(`\n${count}. ${firstSGP.homeTeam} vs ${firstSGP.awayTeam}`)
        console.log(`   League: ${firstSGP.league} | Kickoff: ${firstSGP.kickoffDate.toISOString()}`)
        console.log(`   Match ID: ${matchId}`)
        console.log(`   Available SGPs: ${sgps.length}`)
        
        // Show top 3 SGPs for this match
        sgps.slice(0, 3).forEach((sgp, idx) => {
          console.log(`\n   SGP ${idx + 1} (${sgp.confidence.toUpperCase()} confidence):`)
          console.log(`   └─ Legs (${sgp.legs.length}):`)
          sgp.legs.forEach((leg, legIdx) => {
            console.log(`      ${legIdx + 1}. ${leg.description}`)
          })
          console.log(`   └─ Combined Probability: ${(sgp.combinedProb * 100).toFixed(1)}%`)
          console.log(`   └─ Fair Odds: ${sgp.fairOdds.toFixed(2)}`)
        })
        count++
      }
      
      if (sgpsByMatch.size > 10) {
        console.log(`\n   ... and ${sgpsByMatch.size - 10} more matches with potential SGPs`)
      }
    } else {
      console.log('\n⚠️  No single-game parlays generated (need predictionData with additional_markets_v2)')
    }
    
    // Existing Multi-Game Parlays
    if (fullyUpcomingParlays.length > 0) {
      console.log(`\n\n📋 EXISTING MULTI-GAME PARLAYS (${fullyUpcomingParlays.length} fully UPCOMING)`)
      console.log('─'.repeat(100))
      
      fullyUpcomingParlays.slice(0, 20).forEach((parlay, idx) => {
        const uniqueMatchIds = new Set(parlay.legs.map(leg => leg.matchId))
        
        console.log(`\n${idx + 1}. Parlay ID: ${parlay.parlayId}`)
        console.log(`   Type: ${parlay.parlayType || 'N/A'} | Legs: ${parlay.legCount}`)
        console.log(`   Edge: ${Number(parlay.edgePct).toFixed(2)}% | Confidence: ${parlay.confidenceTier}`)
        console.log(`   Odds: ${Number(parlay.impliedOdds).toFixed(2)} | Combined Prob: ${(Number(parlay.combinedProb) * 100).toFixed(1)}%`)
        console.log(`   Kickoff Window: ${parlay.kickoffWindow} (${parlay.earliestKickoff.toISOString()} - ${parlay.latestKickoff.toISOString()})`)
        console.log(`   Matches (${uniqueMatchIds.size}):`)
        
        Array.from(uniqueMatchIds).forEach(matchId => {
          const match = upcomingMatches.find(m => m.matchId === matchId)
          const legsForMatch = parlay.legs.filter(l => l.matchId === matchId)
          const legDetails = legsForMatch.map(l => 
            `${l.outcome} (${(Number(l.modelProb) * 100).toFixed(1)}%, odds: ${Number(l.decimalOdds).toFixed(2)})`
          ).join(', ')
          
          console.log(`     • ${match?.homeTeam || 'N/A'} vs ${match?.awayTeam || 'N/A'}`)
          console.log(`       League: ${match?.league || 'N/A'} | Kickoff: ${match?.kickoffDate ? match.kickoffDate.toISOString() : 'N/A'}`)
          console.log(`       Legs: ${legDetails}`)
        })
      })
      
      if (fullyUpcomingParlays.length > 20) {
        console.log(`\n   ... and ${fullyUpcomingParlays.length - 20} more parlays`)
      }
    } else {
      console.log('\n⚠️  No existing fully UPCOMING multi-game parlays found')
    }
    
    // Summary
    console.log('\n\n' + '═'.repeat(100))
    console.log('📊 SUMMARY')
    console.log('═'.repeat(100))
    console.log(`   UPCOMING Matches: ${upcomingMatches.length}`)
    console.log(`   QuickPurchase Records with predictionData: ${quickPurchases.length}`)
    console.log(`   Potential Single-Game Parlays: ${potentialSGPs.length}`)
    console.log(`   └─ High Confidence: ${potentialSGPs.filter(s => s.confidence === 'high').length}`)
    console.log(`   └─ Medium Confidence: ${potentialSGPs.filter(s => s.confidence === 'medium').length}`)
    console.log(`   └─ Low Confidence: ${potentialSGPs.filter(s => s.confidence === 'low').length}`)
    console.log(`   Existing Multi-Game Parlays (fully UPCOMING): ${fullyUpcomingParlays.length}`)
    console.log(`   └─ Average Edge: ${fullyUpcomingParlays.length > 0 ? (fullyUpcomingParlays.reduce((sum, p) => sum + Number(p.edgePct), 0) / fullyUpcomingParlays.length).toFixed(2) : 0}%`)
    console.log(`   └─ High Confidence: ${fullyUpcomingParlays.filter(p => p.confidenceTier === 'high').length}`)
    console.log(`   └─ Medium Confidence: ${fullyUpcomingParlays.filter(p => p.confidenceTier === 'medium').length}`)
    console.log('═'.repeat(100))
    console.log('✅ Analysis complete!\n')
    
  } catch (error) {
    console.error('❌ Error during analysis:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the analysis
analyzeParlays()
  .catch(console.error)
  .finally(() => {
    console.log('🔌 Database connection closed')
    process.exit(0)
  })
