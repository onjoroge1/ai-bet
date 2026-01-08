/**
 * Test script for Best Parlay Generator
 * 
 * This script tests the parlay generation logic and helps diagnose issues
 */

import prisma from '../lib/db'
import { generateBestParlays } from '../lib/parlays/best-parlay-generator'

async function testBestParlayGenerator() {
  console.log('🔍 Testing Best Parlay Generator...\n')

  try {
    // Step 1: Check AdditionalMarketData table
    console.log('📊 Step 1: Checking AdditionalMarketData table...')
    const totalMarkets = await prisma.additionalMarketData.count()
    console.log(`   Total markets in AdditionalMarketData: ${totalMarkets}`)

    if (totalMarkets === 0) {
      console.log('   ⚠️  No markets found in AdditionalMarketData table!')
      console.log('   💡 Run the Additional Markets sync first.')
      return
    }

    // Step 2: Check UPCOMING matches
    console.log('\n📅 Step 2: Checking UPCOMING matches...')
    const upcomingMatches = await prisma.marketMatch.count({
      where: {
        status: 'UPCOMING',
        kickoffDate: {
          gte: new Date()
        }
      }
    })
    console.log(`   UPCOMING matches: ${upcomingMatches}`)

    const sampleUpcomingMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: {
          gte: new Date()
        }
      },
      take: 3,
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true
      },
      orderBy: {
        kickoffDate: 'asc'
      }
    })

    if (sampleUpcomingMatches.length > 0) {
      console.log('   Sample upcoming matches:')
      sampleUpcomingMatches.forEach(match => {
        console.log(`     - ${match.homeTeam} vs ${match.awayTeam} (${match.league}) - ${match.kickoffDate.toISOString()}`)
      })
    } else {
      console.log('   ⚠️  No UPCOMING matches found!')
      return
    }

    // Step 3: Check AdditionalMarketData linked to UPCOMING matches
    console.log('\n🔗 Step 3: Checking AdditionalMarketData for UPCOMING matches...')
    const marketsForUpcoming = await prisma.additionalMarketData.findMany({
      where: {
        match: {
          status: 'UPCOMING',
          kickoffDate: {
            gte: new Date()
          }
        }
      },
      take: 10,
      include: {
        match: {
          select: {
            matchId: true,
            homeTeam: true,
            awayTeam: true,
            kickoffDate: true
          }
        }
      }
    })
    console.log(`   Markets linked to UPCOMING matches: ${marketsForUpcoming.length}`)

    if (marketsForUpcoming.length > 0) {
      console.log('   Sample markets:')
      marketsForUpcoming.slice(0, 5).forEach(market => {
        console.log(`     - ${market.match.homeTeam} vs ${market.match.awayTeam}`)
        console.log(`       Market: ${market.marketType} ${market.marketSubtype || ''} (Line: ${market.line || 'N/A'})`)
        console.log(`       Edge: ${Number(market.edgeConsensus) * 100}%, Prob: ${Number(market.consensusProb) * 100}%, Agreement: ${Number(market.modelAgreement) * 100}%`)
        console.log('')
      })
    } else {
      console.log('   ⚠️  No AdditionalMarketData found for UPCOMING matches!')
      console.log('   💡 Make sure Additional Markets sync has run and linked markets to UPCOMING matches.')
      return
    }

    // Step 4: Check data quality against thresholds
    console.log('📈 Step 4: Checking data quality against thresholds...')
    
    const thresholds = {
      minLegEdge: 0.0, // 0% (no edge filter since odds not populated)
      minParlayEdge: 5.0, // 5% (lower since we can't calculate true edge)
      minCombinedProb: 0.15, // 15%
      minModelAgreement: 0.60 // 60% (slightly lower)
    }

    console.log(`   Thresholds:`)
    console.log(`     - Min leg edge: ${thresholds.minLegEdge}%`)
    console.log(`     - Min parlay edge: ${thresholds.minParlayEdge}%`)
    console.log(`     - Min combined prob: ${thresholds.minCombinedProb * 100}%`)
    console.log(`     - Min model agreement: ${thresholds.minModelAgreement * 100}%`)

    // Count markets meeting criteria
    const whereClause: any = {
      match: {
        status: 'UPCOMING',
        kickoffDate: {
          gte: new Date()
        }
      },
      consensusProb: {
        gte: 0.50
      },
      modelAgreement: {
        gte: thresholds.minModelAgreement
      }
    }
    
    // Only filter by edge if threshold > 0
    if (thresholds.minLegEdge > 0) {
      whereClause.edgeConsensus = {
        gte: thresholds.minLegEdge / 100
      }
    }
    
    const marketsMeetingCriteria = await prisma.additionalMarketData.findMany({
      where: whereClause,
      select: {
        edgeConsensus: true,
        consensusProb: true,
        modelAgreement: true
      }
    })

    console.log(`\n   Markets meeting criteria: ${marketsMeetingCriteria.length}`)

    if (marketsMeetingCriteria.length > 0) {
      const avgEdge = marketsMeetingCriteria.reduce((sum, m) => sum + Number(m.edgeConsensus) * 100, 0) / marketsMeetingCriteria.length
      const avgProb = marketsMeetingCriteria.reduce((sum, m) => sum + Number(m.consensusProb) * 100, 0) / marketsMeetingCriteria.length
      const avgAgreement = marketsMeetingCriteria.reduce((sum, m) => sum + Number(m.modelAgreement) * 100, 0) / marketsMeetingCriteria.length

      console.log(`   Average edge: ${avgEdge.toFixed(2)}%`)
      console.log(`   Average prob: ${avgProb.toFixed(2)}%`)
      console.log(`   Average agreement: ${avgAgreement.toFixed(2)}%`)

      // Show distribution
      const byEdge = {
        '6-10%': marketsMeetingCriteria.filter(m => {
          const e = Number(m.edgeConsensus) * 100
          return e >= 6 && e < 10
        }).length,
        '10-15%': marketsMeetingCriteria.filter(m => {
          const e = Number(m.edgeConsensus) * 100
          return e >= 10 && e < 15
        }).length,
        '15%+': marketsMeetingCriteria.filter(m => {
          const e = Number(m.edgeConsensus) * 100
          return e >= 15
        }).length
      }
      console.log(`   Edge distribution:`)
      Object.entries(byEdge).forEach(([range, count]) => {
        console.log(`     - ${range}: ${count} markets`)
      })
    } else {
      console.log('   ⚠️  No markets meet the criteria!')
      console.log('   💡 Try lowering the thresholds or check the data quality.')

      // Check with relaxed thresholds
      console.log('\n   Checking with relaxed thresholds (edge >= 3%, prob >= 40%, agreement >= 50%)...')
      const relaxedMarkets = await prisma.additionalMarketData.findMany({
        where: {
          match: {
            status: 'UPCOMING',
            kickoffDate: {
              gte: new Date()
            }
          },
          edgeConsensus: {
            gte: 0.03 // 3%
          },
          consensusProb: {
            gte: 0.40 // 40%
          },
          modelAgreement: {
            gte: 0.50 // 50%
          }
        },
        take: 10
      })
      console.log(`   Markets with relaxed criteria: ${relaxedMarkets.length}`)
    }

    // Step 5: Test generation with current thresholds
    console.log('\n🚀 Step 5: Testing parlay generation with current thresholds...')
    const parlays = await generateBestParlays({
      minLegEdge: thresholds.minLegEdge,
      minParlayEdge: thresholds.minParlayEdge,
      minCombinedProb: thresholds.minCombinedProb,
      maxLegCount: 5,
      minModelAgreement: thresholds.minModelAgreement,
      maxResults: 20,
      parlayType: 'both'
    })

    console.log(`   Generated parlays: ${parlays.length}`)

    if (parlays.length > 0) {
      console.log('\n   Sample parlays:')
      parlays.slice(0, 3).forEach((parlay, idx) => {
        console.log(`\n   Parlay ${idx + 1}:`)
        console.log(`     Type: ${parlay.parlayType} (${parlay.isMultiGame ? 'Multi-Game' : 'Single-Game'})`)
        console.log(`     Legs: ${parlay.legCount}`)
        console.log(`     Edge: ${parlay.parlayEdge.toFixed(2)}%`)
        console.log(`     Combined Prob: ${(parlay.combinedProb * 100).toFixed(2)}%`)
        console.log(`     Adjusted Prob: ${(parlay.adjustedProb * 100).toFixed(2)}%`)
        console.log(`     Quality Score: ${parlay.qualityScore.toFixed(2)}/100`)
        console.log(`     Confidence: ${parlay.confidenceTier}`)
        console.log(`     Matches: ${parlay.matchIds.length} different matches`)
        console.log(`     Legs:`)
        parlay.legs.forEach((leg, legIdx) => {
          console.log(`       ${legIdx + 1}. Match: ${leg.matchId}`)
          console.log(`          Market: ${leg.marketType} ${leg.marketSubtype || ''}`)
          console.log(`          Edge: ${leg.edgeConsensus.toFixed(2)}%, Prob: ${(leg.consensusProb * 100).toFixed(2)}%`)
        })
      })
    } else {
      console.log('   ⚠️  No parlays generated!')
      
      // Try with relaxed thresholds
      console.log('\n   Testing with relaxed thresholds...')
      const relaxedParlays = await generateBestParlays({
        minLegEdge: 3.0,
        minParlayEdge: 5.0,
        minCombinedProb: 0.10,
        maxLegCount: 5,
        minModelAgreement: 0.50,
        maxResults: 20,
        parlayType: 'both'
      })
      console.log(`   Generated with relaxed thresholds: ${relaxedParlays.length}`)
      
      if (relaxedParlays.length > 0) {
        console.log('   ✅ Parlays can be generated with relaxed thresholds!')
        console.log('   💡 Consider adjusting the default thresholds in the generator.')
      }
    }

    // Step 6: Check match distribution
    console.log('\n📊 Step 6: Checking match distribution...')
    const marketsByMatch = await prisma.additionalMarketData.groupBy({
      by: ['matchId'],
      where: {
        match: {
          status: 'UPCOMING',
          kickoffDate: {
            gte: new Date()
          }
        },
        edgeConsensus: {
          gte: thresholds.minLegEdge / 100
        },
        consensusProb: {
          gte: 0.50
        }
      },
      _count: {
        id: true
      }
    })

    console.log(`   Matches with eligible markets: ${marketsByMatch.length}`)
    
    if (marketsByMatch.length > 0) {
      const marketsPerMatch = marketsByMatch.map(m => m._count.id)
      const avgMarketsPerMatch = marketsPerMatch.reduce((a, b) => a + b, 0) / marketsPerMatch.length
      const maxMarketsPerMatch = Math.max(...marketsPerMatch)
      const minMarketsPerMatch = Math.min(...marketsPerMatch)

      console.log(`   Avg markets per match: ${avgMarketsPerMatch.toFixed(2)}`)
      console.log(`   Min markets per match: ${minMarketsPerMatch}`)
      console.log(`   Max markets per match: ${maxMarketsPerMatch}`)

      if (marketsByMatch.length < 2) {
        console.log('   ⚠️  Need at least 2 different matches for multi-game parlays!')
      }
    }

    console.log('\n✅ Test complete!')

  } catch (error) {
    console.error('❌ Error during test:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testBestParlayGenerator()
  .then(() => {
    console.log('\n✨ Script finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })

