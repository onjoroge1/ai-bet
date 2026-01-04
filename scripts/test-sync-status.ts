import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testSyncStatus() {
  try {
    console.log('=== Sync Status Analysis ===\n')
    
    // Check most recent LIVE match sync
    const recentLive = await prisma.marketMatch.findFirst({
      where: { status: 'LIVE' },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true, matchId: true, homeTeam: true, awayTeam: true }
    })

    if (recentLive) {
      const now = new Date()
      const diff = Math.floor((now.getTime() - recentLive.lastSyncedAt.getTime()) / 1000)
      console.log('Most recent LIVE match sync:')
      console.log(`  - Match: ${recentLive.homeTeam} vs ${recentLive.awayTeam}`)
      console.log(`  - Last Synced: ${recentLive.lastSyncedAt.toISOString()}`)
      console.log(`  - Time since sync: ${diff} seconds (${Math.floor(diff / 60)} minutes)`)
      console.log(`  - Status: ${diff > 30 ? '❌ STALE (should sync every 30s)' : '✅ FRESH'}`)
    } else {
      console.log('❌ No LIVE matches in database')
    }

    console.log('\n=== Root Cause ===')
    if (recentLive) {
      const diff = Math.floor((Date.now() - recentLive.lastSyncedAt.getTime()) / 1000)
      if (diff > 30) {
        console.log('🔴 PROBLEM: All LIVE matches are stale (>30 seconds old)')
        console.log('   This means:')
        console.log('   1. Sync process is NOT running OR')
        console.log('   2. Sync process is failing OR')
        console.log('   3. External API is too slow for sync to complete')
        console.log('\n   Result: API falls back to external API, which times out')
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSyncStatus()

