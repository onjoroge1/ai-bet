/**
 * Diagnostic script to check why match 1379152 shows 0-0
 * Run with: npx tsx scripts/diagnose-match-score.ts 1379152
 */

import prisma from '../lib/db'
import { transformMarketMatchToApiFormat } from '../lib/market-match-helpers'

async function diagnoseMatch(matchId: string) {
  console.log(`\n🔍 Diagnosing match ${matchId}...\n`)
  console.log('='.repeat(60))
  
  // Step 1: Check database
  console.log('\n📊 STEP 1: Database Check')
  console.log('-'.repeat(60))
  const dbMatch = await prisma.marketMatch.findUnique({
    where: { matchId: String(matchId) },
  })
  
  if (!dbMatch) {
    console.log(`❌ Match ${matchId} not found in database`)
    return
  }
  
  console.log(`✅ Match found in database`)
  console.log(`   Status: ${dbMatch.status}`)
  console.log(`   Home: ${dbMatch.homeTeam}`)
  console.log(`   Away: ${dbMatch.awayTeam}`)
  console.log(`   League: ${dbMatch.league}`)
  
  // Check finalResult
  console.log(`\n   finalResult field:`)
  if (dbMatch.finalResult) {
    const finalResult = dbMatch.finalResult as any
    console.log(`   ✅ EXISTS`)
    console.log(`   Type: ${typeof finalResult}`)
    console.log(`   Value:`, JSON.stringify(finalResult, null, 2))
    console.log(`   Keys:`, Object.keys(finalResult))
    
    if (finalResult.score) {
      console.log(`   ✅ Has score field:`, finalResult.score)
    } else {
      console.log(`   ⚠️  No score field in finalResult`)
    }
  } else {
    console.log(`   ❌ MISSING or NULL`)
  }
  
  // Check currentScore
  console.log(`\n   currentScore field:`)
  if (dbMatch.currentScore) {
    const currentScore = dbMatch.currentScore as any
    console.log(`   ✅ EXISTS:`, currentScore)
  } else {
    console.log(`   ❌ MISSING or NULL`)
  }
  
  // Step 2: Transform check
  console.log(`\n\n🔄 STEP 2: Transform Check`)
  console.log('-'.repeat(60))
  
  if (dbMatch.status === 'FINISHED') {
    console.log(`✅ Match is FINISHED - will use transform function`)
    const transformed = transformMarketMatchToApiFormat(dbMatch)
    
    console.log(`\n   Transformed result:`)
    console.log(`   final_result:`, transformed.final_result ? JSON.stringify(transformed.final_result, null, 2) : '❌ MISSING')
    console.log(`   score:`, transformed.score ? JSON.stringify(transformed.score, null, 2) : '❌ MISSING')
    
    if (transformed.final_result?.score) {
      console.log(`   ✅ final_result.score exists:`, transformed.final_result.score)
    } else {
      console.log(`   ⚠️  final_result.score missing`)
    }
    
    if (transformed.score) {
      console.log(`   ✅ score exists:`, transformed.score)
    } else {
      console.log(`   ⚠️  score missing`)
    }
    
    // Check what frontend would receive
    console.log(`\n   Frontend would receive:`)
    console.log(`   matchData.final_result?.score:`, transformed.final_result?.score || 'undefined')
    console.log(`   matchData.score:`, transformed.score || 'undefined')
    
    const frontendScore = transformed.final_result?.score || transformed.score
    if (frontendScore) {
      console.log(`   ✅ Frontend would get:`, frontendScore)
    } else {
      console.log(`   ❌ Frontend would get: undefined → defaults to { home: 0, away: 0 }`)
    }
  } else {
    console.log(`⚠️  Match status is ${dbMatch.status}, not FINISHED`)
  }
  
  console.log(`\n${'='.repeat(60)}\n`)
  
  // Summary
  console.log(`📋 SUMMARY:`)
  console.log(`   Database has finalResult: ${!!dbMatch.finalResult}`)
  if (dbMatch.finalResult) {
    const fr = dbMatch.finalResult as any
    console.log(`   finalResult has score: ${!!fr.score}`)
    if (fr.score) {
      console.log(`   Score value: ${fr.score.home}-${fr.score.away}`)
    }
  }
  console.log(`   Database has currentScore: ${!!dbMatch.currentScore}`)
  if (dbMatch.currentScore) {
    const cs = dbMatch.currentScore as any
    console.log(`   currentScore value: ${cs.home}-${cs.away}`)
  }
  
  await prisma.$disconnect()
}

// Get matchId from command line or use default
const matchId = process.argv[2] || '1379152'
diagnoseMatch(matchId).catch(console.error)

