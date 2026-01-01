/**
 * Fix match status and populate finalResult from currentScore
 * Run with: npx tsx scripts/fix-match-status.ts 1379152
 */

import prisma from '../lib/db'

async function fixMatchStatus(matchId: string) {
  console.log(`\n🔧 Fixing match ${matchId}...\n`)
  
  const dbMatch = await prisma.marketMatch.findUnique({
    where: { matchId: String(matchId) },
  })
  
  if (!dbMatch) {
    console.log(`❌ Match ${matchId} not found`)
    await prisma.$disconnect()
    return
  }
  
  console.log(`Current state:`)
  console.log(`  Status: ${dbMatch.status}`)
  console.log(`  finalResult: ${dbMatch.finalResult ? 'EXISTS' : 'NULL'}`)
  console.log(`  currentScore:`, dbMatch.currentScore)
  
  // Check if match should be FINISHED
  const kickoffTime = dbMatch.kickoffDate.getTime()
  const now = Date.now()
  const hoursSinceKickoff = (now - kickoffTime) / (1000 * 60 * 60)
  const shouldBeFinished = hoursSinceKickoff > 3 // More than 3 hours = likely finished
  
  console.log(`\nTime check:`)
  console.log(`  Kickoff: ${dbMatch.kickoffDate.toISOString()}`)
  console.log(`  Hours since kickoff: ${hoursSinceKickoff.toFixed(2)}`)
  console.log(`  Should be finished: ${shouldBeFinished}`)
  
  if (dbMatch.status === 'LIVE' && shouldBeFinished) {
    console.log(`\n✅ Match should be marked as FINISHED`)
    
    // Get currentScore
    const currentScore = dbMatch.currentScore as { home?: number; away?: number } | null
    
    if (currentScore && (currentScore.home !== undefined || currentScore.away !== undefined)) {
      // Create finalResult from currentScore
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
      
      console.log(`\nUpdating match:`)
      console.log(`  Status: LIVE → FINISHED`)
      console.log(`  finalResult: NULL →`, JSON.stringify(finalResult, null, 2))
      
      await prisma.marketMatch.update({
        where: { matchId: String(matchId) },
        data: {
          status: 'FINISHED',
          finalResult: finalResult
        }
      })
      
      console.log(`\n✅ Match updated successfully!`)
      console.log(`   Status: FINISHED`)
      console.log(`   finalResult:`, finalResult)
    } else {
      console.log(`\n⚠️  Cannot create finalResult: currentScore is missing or invalid`)
      console.log(`   currentScore:`, currentScore)
    }
  } else if (dbMatch.status === 'FINISHED') {
    console.log(`\n✅ Match is already FINISHED`)
    
    if (!dbMatch.finalResult && currentScore) {
      // Match is FINISHED but missing finalResult - populate it
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
      
      console.log(`\n⚠️  Match is FINISHED but missing finalResult`)
      console.log(`   Populating finalResult from currentScore:`, finalResult)
      
      await prisma.marketMatch.update({
        where: { matchId: String(matchId) },
        data: {
          finalResult: finalResult
        }
      })
      
      console.log(`\n✅ finalResult populated!`)
    } else if (dbMatch.finalResult) {
      console.log(`   ✅ finalResult already exists:`, dbMatch.finalResult)
    }
  } else {
    console.log(`\n⚠️  Match status is ${dbMatch.status}, not updating`)
  }
  
  await prisma.$disconnect()
  console.log(`\n✅ Done!\n`)
}

const matchId = process.argv[2] || '1379152'
fixMatchStatus(matchId).catch(console.error)

