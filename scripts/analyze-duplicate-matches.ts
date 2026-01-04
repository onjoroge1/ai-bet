/**
 * Analyze duplicate matches in live table
 * Checks database, API response, and transformation logic
 */

import prisma from '../lib/db'

async function analyzeDuplicates() {
  console.log('=== Analyzing Duplicate Matches ===\n')

  // 1. Check database for duplicates
  console.log('1. Checking database for duplicate matchIds...')
  const allLiveMatches = await prisma.marketMatch.findMany({
    where: {
      status: 'LIVE',
      isActive: true,
      isArchived: false,
    },
    select: {
      id: true,
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      consensusOdds: true,
      allBookmakers: true,
      lastSyncedAt: true,
      createdAt: true,
    },
    orderBy: {
      matchId: 'asc',
    },
  })

  console.log(`   Total LIVE matches in database: ${allLiveMatches.length}`)

  // Group by matchId to find duplicates
  const matchIdGroups = new Map<string, typeof allLiveMatches>()
  allLiveMatches.forEach((match) => {
    const matchId = match.matchId
    if (!matchIdGroups.has(matchId)) {
      matchIdGroups.set(matchId, [])
    }
    matchIdGroups.get(matchId)!.push(match)
  })

  // Find duplicates
  const duplicates = Array.from(matchIdGroups.entries()).filter(
    ([_, matches]) => matches.length > 1
  )

  if (duplicates.length > 0) {
    console.log(`   ⚠️ Found ${duplicates.length} duplicate matchIds in database:`)
    duplicates.forEach(([matchId, matches]) => {
      console.log(`\n   Match ID: ${matchId}`)
      matches.forEach((match, index) => {
        console.log(`     Duplicate ${index + 1}:`)
        console.log(`       DB ID: ${match.id}`)
        console.log(`       Teams: ${match.homeTeam} vs ${match.awayTeam}`)
        console.log(`       Consensus Odds:`, match.consensusOdds)
        console.log(`       All Bookmakers:`, match.allBookmakers ? 'Has data' : 'No data')
        console.log(`       Last Synced: ${match.lastSyncedAt}`)
        console.log(`       Created: ${match.createdAt}`)
      })
    })
  } else {
    console.log('   ✅ No duplicates found in database')
  }

  // 2. Check specific match ID 1396383
  console.log('\n2. Checking specific match ID 1396383...')
  const specificMatches = await prisma.marketMatch.findMany({
    where: {
      matchId: '1396383',
    },
    select: {
      id: true,
      matchId: true,
      status: true,
      homeTeam: true,
      awayTeam: true,
      consensusOdds: true,
      allBookmakers: true,
      primaryBook: true,
      booksCount: true,
      lastSyncedAt: true,
      createdAt: true,
      isActive: true,
      isArchived: true,
    },
  })

  if (specificMatches.length > 0) {
    console.log(`   Found ${specificMatches.length} record(s) for match 1396383:`)
    specificMatches.forEach((match, index) => {
      console.log(`\n   Record ${index + 1}:`)
      console.log(`     DB ID: ${match.id}`)
      console.log(`     Status: ${match.status}`)
      console.log(`     Teams: ${match.homeTeam} vs ${match.awayTeam}`)
      console.log(`     Is Active: ${match.isActive}`)
      console.log(`     Is Archived: ${match.isArchived}`)
      console.log(`     Consensus Odds:`, JSON.stringify(match.consensusOdds, null, 2))
      console.log(`     Primary Book: ${match.primaryBook}`)
      console.log(`     Books Count: ${match.booksCount}`)
      console.log(`     All Bookmakers:`, match.allBookmakers ? 'Has data' : 'No data')
      if (match.allBookmakers) {
        const books = match.allBookmakers as any
        console.log(`     Bookmaker Keys:`, Object.keys(books))
      }
      console.log(`     Last Synced: ${match.lastSyncedAt}`)
      console.log(`     Created: ${match.createdAt}`)
    })
  } else {
    console.log('   ⚠️ No records found for match 1396383')
  }

  // 3. Check for matches with same teams but different matchIds
  console.log('\n3. Checking for matches with same teams but different matchIds...')
  const teamGroups = new Map<string, typeof allLiveMatches>()
  allLiveMatches.forEach((match) => {
    const key = `${match.homeTeam} vs ${match.awayTeam}`
    if (!teamGroups.has(key)) {
      teamGroups.set(key, [])
    }
    teamGroups.get(key)!.push(match)
  })

  const sameTeamDuplicates = Array.from(teamGroups.entries()).filter(
    ([_, matches]) => matches.length > 1
  )

  if (sameTeamDuplicates.length > 0) {
    console.log(`   ⚠️ Found ${sameTeamDuplicates.length} team combinations with multiple matchIds:`)
    sameTeamDuplicates.slice(0, 5).forEach(([teams, matches]) => {
      console.log(`\n   ${teams}:`)
      matches.forEach((match) => {
        console.log(`     Match ID: ${match.matchId} (DB ID: ${match.id})`)
      })
    })
  } else {
    console.log('   ✅ No team duplicates found')
  }

  // 4. Summary
  console.log('\n=== Summary ===')
  console.log(`Total LIVE matches: ${allLiveMatches.length}`)
  console.log(`Unique matchIds: ${matchIdGroups.size}`)
  console.log(`Duplicate matchIds: ${duplicates.length}`)
  if (duplicates.length > 0) {
    console.log('\n⚠️ ACTION REQUIRED: Database has duplicate matchIds!')
    console.log('   This could cause matches to appear twice in the frontend.')
    console.log('   Recommendation: Deduplicate by keeping the most recent record.')
  }
}

// Run analysis
analyzeDuplicates()
  .catch((error) => {
    console.error('Error analyzing duplicates:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })

