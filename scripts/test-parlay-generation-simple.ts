/**
 * Simple test for parlay generation
 */

import { generateBestParlays } from '../lib/parlays/best-parlay-generator'
import prisma from '../lib/db'

async function testGeneration() {
  console.log('Testing parlay generation...\n')
  
  try {
    const parlays = await generateBestParlays({
      minLegEdge: 0.0,
      minParlayEdge: 0.0, // Lower threshold for testing
      minCombinedProb: 0.15,
      maxLegCount: 4, // Limit to 4 legs max
      minModelAgreement: 0.60,
      maxResults: 10, // Only top 10
      parlayType: 'both'
    })
    
    console.log(`✅ Generated ${parlays.length} parlays\n`)
    
    if (parlays.length > 0) {
      console.log('Sample parlay:')
      const sample = parlays[0]
      console.log(`  Type: ${sample.parlayType} (${sample.isMultiGame ? 'Multi-Game' : 'Single-Game'})`)
      console.log(`  Legs: ${sample.legCount}`)
      console.log(`  Edge: ${sample.parlayEdge.toFixed(2)}%`)
      console.log(`  Prob: ${(sample.combinedProb * 100).toFixed(2)}%`)
      console.log(`  Quality: ${sample.qualityScore.toFixed(2)}/100`)
      console.log(`  Matches: ${sample.matchIds.length} different`)
    }
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
  } finally {
    await prisma.$disconnect()
  }
}

testGeneration()

