/**
 * Script to verify MarketMatch data collection
 * Run with: npx tsx scripts/verify-market-data.ts
 */

import prisma from '../lib/db'

async function verifyMarketData() {
  console.log('🔍 MarketMatch Data Verification')
  console.log('================================')
  console.log('')

  try {
    // 1. Check total matches
    const totalMatches = await prisma.marketMatch.count()
    console.log(`📊 Total Matches: ${totalMatches}`)
    console.log('')

    // 2. Check by status
    const upcomingCount = await prisma.marketMatch.count({
      where: { status: 'UPCOMING', isActive: true }
    })
    const liveCount = await prisma.marketMatch.count({
      where: { status: 'LIVE', isActive: true }
    })
    const finishedCount = await prisma.marketMatch.count({
      where: { status: 'FINISHED' }
    })

    console.log('📈 Matches by Status:')
    console.log(`  - Upcoming: ${upcomingCount}`)
    console.log(`  - Live: ${liveCount}`)
    console.log(`  - Finished: ${finishedCount}`)
    console.log('')

    // 3. Check recent syncs (last 5 minutes)
    const recentlySynced = await prisma.marketMatch.count({
      where: {
        lastSyncedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000)
        }
      }
    })
    console.log(`🔄 Recently Synced (last 5 min): ${recentlySynced}`)
    console.log('')

    // 4. Check sync errors
    const matchesWithErrors = await prisma.marketMatch.count({
      where: {
        syncErrors: { gt: 0 }
      }
    })
    console.log(`⚠️  Matches with Sync Errors: ${matchesWithErrors}`)
    if (matchesWithErrors > 0) {
      const errorMatches = await prisma.marketMatch.findMany({
        where: { syncErrors: { gt: 0 } },
        select: {
          matchId: true,
          status: true,
          syncErrors: true,
          lastSyncError: true,
          lastSyncedAt: true
        },
        take: 5
      })
      console.log('  Sample errors:')
      errorMatches.forEach(m => {
        console.log(`    - ${m.matchId}: ${m.syncErrors} errors - ${m.lastSyncError}`)
      })
    }
    console.log('')

    // 5. Check data completeness
    console.log('✅ Data Completeness Check:')
    
    const withOdds = await prisma.marketMatch.count({
      where: { consensusOdds: { not: null } }
    })
    console.log(`  - Matches with odds: ${withOdds}/${totalMatches} (${Math.round(withOdds/totalMatches*100)}%)`)

    const withV1Model = await prisma.marketMatch.count({
      where: { v1Model: { not: null } }
    })
    console.log(`  - Matches with V1 model: ${withV1Model}/${totalMatches} (${Math.round(withV1Model/totalMatches*100)}%)`)

    const withV2Model = await prisma.marketMatch.count({
      where: { v2Model: { not: null } }
    })
    console.log(`  - Matches with V2 model: ${withV2Model}/${totalMatches} (${Math.round(withV2Model/totalMatches*100)}%)`)

    const withBookmakers = await prisma.marketMatch.count({
      where: { allBookmakers: { not: null } }
    })
    console.log(`  - Matches with bookmakers: ${withBookmakers}/${totalMatches} (${Math.round(withBookmakers/totalMatches*100)}%)`)
    console.log('')

    // 6. Sample recent matches
    console.log('📋 Sample Recent Matches (last 5):')
    const recentMatches = await prisma.marketMatch.findMany({
      orderBy: { lastSyncedAt: 'desc' },
      take: 5,
      select: {
        matchId: true,
        status: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        consensusOdds: true,
        v1Model: true,
        v2Model: true,
        currentScore: true,
        lastSyncedAt: true,
        syncCount: true,
        syncPriority: true
      }
    })

    recentMatches.forEach((match, index) => {
      console.log(`\n  ${index + 1}. ${match.homeTeam} vs ${match.awayTeam}`)
      console.log(`     Match ID: ${match.matchId}`)
      console.log(`     Status: ${match.status}`)
      console.log(`     League: ${match.league}`)
      console.log(`     Kickoff: ${match.kickoffDate.toISOString()}`)
      console.log(`     Last Synced: ${match.lastSyncedAt.toISOString()}`)
      console.log(`     Sync Count: ${match.syncCount}`)
      console.log(`     Priority: ${match.syncPriority || 'N/A'}`)
      console.log(`     Has Odds: ${match.consensusOdds ? 'Yes' : 'No'}`)
      console.log(`     Has V1: ${match.v1Model ? 'Yes' : 'No'}`)
      console.log(`     Has V2: ${match.v2Model ? 'Yes' : 'No'}`)
      if (match.currentScore) {
        console.log(`     Score: ${(match.currentScore as any).home} - ${(match.currentScore as any).away}`)
      }
    })

    console.log('')
    console.log('================================')
    console.log('✅ Verification Complete!')
    console.log('')

    // 7. Summary
    console.log('📊 Summary:')
    console.log(`  Total Matches: ${totalMatches}`)
    console.log(`  Active (Upcoming + Live): ${upcomingCount + liveCount}`)
    console.log(`  Recently Synced: ${recentlySynced}`)
    console.log(`  With Errors: ${matchesWithErrors}`)
    console.log(`  Data Completeness: ${Math.round((withOdds + withV1Model) / (totalMatches * 2) * 100)}%`)

  } catch (error) {
    console.error('❌ Error verifying data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyMarketData()

