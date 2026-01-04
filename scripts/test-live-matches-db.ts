import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testLiveMatches() {
  try {
    console.log('=== Testing LIVE Matches in Database ===\n')
    
    // Check LIVE matches
    const liveMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'LIVE',
        isActive: true,
        isArchived: false,
      },
      orderBy: { kickoffDate: 'asc' },
      take: 10,
      select: {
        matchId: true,
        status: true,
        lastSyncedAt: true,
        homeTeam: true,
        awayTeam: true,
        kickoffDate: true,
      },
    })

    console.log(`Found ${liveMatches.length} LIVE matches in database\n`)

    const now = Date.now()
    const LIVE_MAX_AGE = 30 * 1000 // 30 seconds

    liveMatches.forEach((match) => {
      const age = now - match.lastSyncedAt.getTime()
      const ageSeconds = Math.floor(age / 1000)
      const isStale = age > LIVE_MAX_AGE
      
      console.log(`Match: ${match.homeTeam} vs ${match.awayTeam}`)
      console.log(`  - Match ID: ${match.matchId}`)
      console.log(`  - Status: ${match.status}`)
      console.log(`  - Last Synced: ${match.lastSyncedAt.toISOString()}`)
      console.log(`  - Age: ${ageSeconds} seconds`)
      console.log(`  - Is Stale (>30s): ${isStale ? 'YES ❌' : 'NO ✅'}`)
      console.log('')
    })

    // Check if any are fresh
    const freshMatches = liveMatches.filter((match) => {
      const age = now - match.lastSyncedAt.getTime()
      return age <= LIVE_MAX_AGE
    })

    console.log(`\n=== Summary ===`)
    console.log(`Total LIVE matches: ${liveMatches.length}`)
    console.log(`Fresh matches (<30s old): ${freshMatches.length}`)
    console.log(`Stale matches (>30s old): ${liveMatches.length - freshMatches.length}`)

    if (freshMatches.length === 0 && liveMatches.length > 0) {
      console.log('\n⚠️  WARNING: All LIVE matches are stale!')
      console.log('   This means the API will fall back to external API')
      console.log('   Check sync process - it should sync LIVE matches every 30 seconds')
    }

    if (liveMatches.length === 0) {
      console.log('\n⚠️  WARNING: No LIVE matches in database!')
      console.log('   This means the API will always fall back to external API')
      console.log('   Check sync process - it should be syncing LIVE matches')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testLiveMatches()

