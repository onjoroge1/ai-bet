/**
 * Backfill script to populate finalResult for all FINISHED matches
 * that have currentScore but missing finalResult
 * 
 * Run with: npx tsx scripts/backfill-final-results.ts
 */

import prisma from '../lib/db'

async function backfillFinalResults() {
  console.log(`\n🔧 Backfilling finalResult for all FINISHED matches...\n`)
  console.log('='.repeat(60))
  
  // Find all FINISHED matches that have currentScore but no finalResult
  const matchesToFix = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      currentScore: {
        not: null
      },
      finalResult: null
    },
    select: {
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      currentScore: true,
      finalResult: true,
      status: true,
      kickoffDate: true
    }
  })
  
  console.log(`\n📊 Found ${matchesToFix.length} matches to fix\n`)
  
  if (matchesToFix.length === 0) {
    console.log('✅ No matches need fixing!')
    await prisma.$disconnect()
    return
  }
  
  let successCount = 0
  let errorCount = 0
  
  for (const match of matchesToFix) {
    try {
      const currentScore = match.currentScore as { home?: number; away?: number } | null
      
      if (!currentScore || (currentScore.home === undefined && currentScore.away === undefined)) {
        console.log(`⚠️  Skipping match ${match.matchId}: currentScore is invalid`, currentScore)
        continue
      }
      
      const finalResult = {
        score: {
          home: currentScore.home ?? 0,
          away: currentScore.away ?? 0
        },
        outcome: (currentScore.home ?? 0) > (currentScore.away ?? 0) ? 'home' : 
                 (currentScore.away ?? 0) > (currentScore.home ?? 0) ? 'away' : 'draw',
        outcome_text: (currentScore.home ?? 0) > (currentScore.away ?? 0) ? 'Home Win' : 
                     (currentScore.away ?? 0) > (currentScore.home ?? 0) ? 'Away Win' : 'Draw'
      }
      
      await prisma.marketMatch.update({
        where: { matchId: match.matchId },
        data: {
          finalResult: finalResult
        }
      })
      
      console.log(`✅ Fixed match ${match.matchId}: ${match.homeTeam} ${finalResult.score.home}-${finalResult.score.away} ${match.awayTeam}`)
      successCount++
    } catch (error) {
      console.error(`❌ Error fixing match ${match.matchId}:`, error)
      errorCount++
    }
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`\n📊 Summary:`)
  console.log(`   Total matches: ${matchesToFix.length}`)
  console.log(`   ✅ Successfully fixed: ${successCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log(`\n✅ Done!\n`)
  
  await prisma.$disconnect()
}

// Also check LIVE matches that are likely finished
async function fixLikelyFinishedLiveMatches() {
  console.log(`\n🔧 Checking LIVE matches that are likely finished...\n`)
  console.log('='.repeat(60))
  
  const now = new Date()
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  
  // Find LIVE matches older than 3 hours that have currentScore
  const liveMatchesToFix = await prisma.marketMatch.findMany({
    where: {
      status: 'LIVE',
      currentScore: {
        not: null
      },
      kickoffDate: {
        lt: threeHoursAgo
      }
    },
    select: {
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      currentScore: true,
      finalResult: true,
      status: true,
      kickoffDate: true
    }
  })
  
  console.log(`\n📊 Found ${liveMatchesToFix.length} LIVE matches older than 3 hours\n`)
  
  if (liveMatchesToFix.length === 0) {
    console.log('✅ No LIVE matches need fixing!')
    return
  }
  
  let successCount = 0
  let errorCount = 0
  
  for (const match of liveMatchesToFix) {
    try {
      const currentScore = match.currentScore as { home?: number; away?: number } | null
      
      if (!currentScore || (currentScore.home === undefined && currentScore.away === undefined)) {
        console.log(`⚠️  Skipping match ${match.matchId}: currentScore is invalid`, currentScore)
        continue
      }
      
      const hoursSinceKickoff = (now.getTime() - match.kickoffDate.getTime()) / (1000 * 60 * 60)
      
      const finalResult = {
        score: {
          home: currentScore.home ?? 0,
          away: currentScore.away ?? 0
        },
        outcome: (currentScore.home ?? 0) > (currentScore.away ?? 0) ? 'home' : 
                 (currentScore.away ?? 0) > (currentScore.home ?? 0) ? 'away' : 'draw',
        outcome_text: (currentScore.home ?? 0) > (currentScore.away ?? 0) ? 'Home Win' : 
                     (currentScore.away ?? 0) > (currentScore.home ?? 0) ? 'Away Win' : 'Draw'
      }
      
      await prisma.marketMatch.update({
        where: { matchId: match.matchId },
        data: {
          status: 'FINISHED',
          finalResult: finalResult
        }
      })
      
      console.log(`✅ Fixed match ${match.matchId} (${hoursSinceKickoff.toFixed(2)}h old): ${match.homeTeam} ${finalResult.score.home}-${finalResult.score.away} ${match.awayTeam}`)
      successCount++
    } catch (error) {
      console.error(`❌ Error fixing match ${match.matchId}:`, error)
      errorCount++
    }
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`\n📊 Summary:`)
  console.log(`   Total LIVE matches: ${liveMatchesToFix.length}`)
  console.log(`   ✅ Successfully fixed: ${successCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log(`\n✅ Done!\n`)
}

async function main() {
  await backfillFinalResults()
  await fixLikelyFinishedLiveMatches()
}

main().catch(console.error)

