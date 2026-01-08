/**
 * Debug Edge Calculation Script
 * 
 * Check why edgeConsensus is 0 for markets
 */

import prisma from '../lib/db'

async function debugEdgeCalculation() {
  console.log('🔍 Debugging Edge Calculation...\n')

  try {
    // Check sample markets with their edge data
    const sampleMarkets = await prisma.additionalMarketData.findMany({
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
            awayTeam: true
          }
        }
      },
      orderBy: {
        consensusProb: 'desc'
      }
    })

    console.log(`📊 Found ${sampleMarkets.length} markets for UPCOMING matches\n`)

    sampleMarkets.forEach((market, idx) => {
      console.log(`\nMarket ${idx + 1}: ${market.match.homeTeam} vs ${market.match.awayTeam}`)
      console.log(`  Market: ${market.marketType} ${market.marketSubtype || ''} (Line: ${market.line || 'N/A'})`)
      console.log(`  V1 Model Prob: ${market.v1ModelProb ? Number(market.v1ModelProb) : 'NULL'}`)
      console.log(`  V2 Model Prob: ${market.v2ModelProb ? Number(market.v2ModelProb) : 'NULL'}`)
      console.log(`  Consensus Prob: ${Number(market.consensusProb)} (${(Number(market.consensusProb) * 100).toFixed(2)}%)`)
      console.log(`  Decimal Odds: ${market.decimalOdds ? Number(market.decimalOdds) : 'NULL'}`)
      console.log(`  Implied Prob: ${market.impliedProb ? Number(market.impliedProb) : 'NULL'}`)
      console.log(`  Edge V1: ${market.edgeV1 ? Number(market.edgeV1) : 'NULL'}`)
      console.log(`  Edge V2: ${market.edgeV2 ? Number(market.edgeV2) : 'NULL'}`)
      console.log(`  Edge Consensus: ${Number(market.edgeConsensus)} (${(Number(market.edgeConsensus) * 100).toFixed(2)}%)`)
      console.log(`  Model Agreement: ${Number(market.modelAgreement)} (${(Number(market.modelAgreement) * 100).toFixed(2)}%)`)
      
      // Calculate edge manually if we have the data
      if (market.decimalOdds && market.consensusProb) {
        const decimalOdds = Number(market.decimalOdds)
        const consensusProb = Number(market.consensusProb)
        const impliedProb = 1 / decimalOdds
        const calculatedEdge = (consensusProb / impliedProb) - 1
        console.log(`  Calculated Edge: ${calculatedEdge.toFixed(4)} (${(calculatedEdge * 100).toFixed(2)}%)`)
      }
    })

    // Check edge distribution
    console.log('\n\n📈 Edge Distribution:')
    const edgeStats = await prisma.additionalMarketData.groupBy({
      by: ['matchId'],
      where: {
        match: {
          status: 'UPCOMING',
          kickoffDate: {
            gte: new Date()
          }
        }
      },
      _count: {
        id: true
      },
      _avg: {
        edgeConsensus: true,
        consensusProb: true
      },
      _min: {
        edgeConsensus: true
      },
      _max: {
        edgeConsensus: true
      }
    })

    console.log(`  Markets grouped by match: ${edgeStats.length}`)
    if (edgeStats.length > 0) {
      const edges = edgeStats.map(s => Number(s._avg.edgeConsensus || 0))
      const nonZeroEdges = edges.filter(e => e > 0)
      console.log(`  Markets with non-zero edge: ${nonZeroEdges.length}/${edges.length}`)
      if (nonZeroEdges.length > 0) {
        console.log(`  Average edge (non-zero): ${(nonZeroEdges.reduce((a, b) => a + b, 0) / nonZeroEdges.length * 100).toFixed(2)}%`)
        console.log(`  Max edge: ${(Math.max(...nonZeroEdges) * 100).toFixed(2)}%`)
      } else {
        console.log(`  ⚠️  ALL markets have zero edge!`)
      }
    }

    // Check if decimalOdds is populated
    console.log('\n\n🎲 Decimal Odds Check:')
    const oddsStats = await prisma.additionalMarketData.groupBy({
      by: ['matchId'],
      where: {
        match: {
          status: 'UPCOMING',
          kickoffDate: {
            gte: new Date()
          }
        }
      },
      _count: {
        decimalOdds: true,
        id: true
      }
    })

    const totalMarkets = oddsStats.reduce((sum, s) => sum + s._count.id, 0)
    const marketsWithOdds = oddsStats.reduce((sum, s) => sum + s._count.decimalOdds, 0)
    console.log(`  Markets with decimalOdds: ${marketsWithOdds}/${totalMarkets}`)
    if (marketsWithOdds === 0) {
      console.log(`  ⚠️  NO markets have decimalOdds! This is why edge is 0.`)
      console.log(`  💡 Need to populate decimalOdds from MarketMatch.consensusOdds or external odds source.`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

debugEdgeCalculation()
  .then(() => {
    console.log('\n✨ Debug complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Debug failed:', error)
    process.exit(1)
  })

