/**
 * Verification script for MarketMatch sync
 * Checks endpoint response and database data collection
 * 
 * Usage: npx tsx scripts/verify-market-sync.ts
 */

import prisma from '../lib/db'

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'

interface SyncResponse {
  success: boolean
  results?: {
    live?: { synced: number; errors: number; skipped: number }
    upcoming?: { synced: number; errors: number; skipped: number }
    completed?: { synced: number; errors: number; skipped: number }
  }
  summary?: {
    totalSynced: number
    totalErrors: number
    totalSkipped: number
    duration: string
  }
  error?: string
}

async function testEndpoint(type: 'live' | 'upcoming' | 'completed'): Promise<SyncResponse | null> {
  try {
    const url = `${BASE_URL}/api/admin/market/sync-scheduled?type=${type}`
    console.log(`\n📡 Testing endpoint: ${url}`)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ HTTP ${response.status}: ${errorText}`)
      return null
    }

    const data = await response.json() as SyncResponse
    return data
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return null
  }
}

async function checkDatabase() {
  console.log('\n📊 Checking Database...')
  console.log('=' .repeat(50))

  try {
    // Count matches by status
    const statusCounts = await prisma.marketMatch.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    })

    console.log('\n📈 Match Counts by Status:')
    for (const group of statusCounts) {
      console.log(`  ${group.status}: ${group._count.id} matches`)
    }

    // Get sync statistics
    const syncStats = await prisma.marketMatch.groupBy({
      by: ['status'],
      _avg: {
        syncCount: true,
      },
      _max: {
        lastSyncedAt: true,
      },
      _sum: {
        syncErrors: true,
      },
    })

    console.log('\n🔄 Sync Statistics:')
    for (const stat of syncStats) {
      console.log(`  ${stat.status}:`)
      console.log(`    - Avg Syncs: ${stat._avg.syncCount?.toFixed(1) || 0}`)
      console.log(`    - Last Sync: ${stat._max.lastSyncedAt?.toISOString() || 'Never'}`)
      console.log(`    - Total Errors: ${stat._sum.syncErrors || 0}`)
    }

    // Check sample upcoming matches
    const upcomingSamples = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        isActive: true,
      },
      orderBy: {
        kickoffDate: 'asc',
      },
      take: 5,
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        consensusOdds: true,
        v1Model: true,
        v2Model: true,
        lastSyncedAt: true,
        syncCount: true,
      },
    })

    console.log('\n📋 Sample Upcoming Matches (first 5):')
    for (const match of upcomingSamples) {
      console.log(`  ${match.matchId}: ${match.homeTeam} vs ${match.awayTeam}`)
      console.log(`    League: ${match.league}`)
      console.log(`    Kickoff: ${match.kickoffDate.toISOString()}`)
      console.log(`    Has Consensus Odds: ${!!match.consensusOdds}`)
      console.log(`    Has V1 Model: ${!!match.v1Model}`)
      console.log(`    Has V2 Model: ${!!match.v2Model}`)
      console.log(`    Last Synced: ${match.lastSyncedAt.toISOString()}`)
      console.log(`    Sync Count: ${match.syncCount}`)
      console.log('')
    }

    // Check sample live matches
    const liveSamples = await prisma.marketMatch.findMany({
      where: {
        status: 'LIVE',
        isActive: true,
      },
      orderBy: {
        lastSyncedAt: 'desc',
      },
      take: 3,
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        currentScore: true,
        elapsed: true,
        lastSyncedAt: true,
      },
    })

    if (liveSamples.length > 0) {
      console.log('\n⚡ Sample Live Matches (first 3):')
      for (const match of liveSamples) {
        console.log(`  ${match.matchId}: ${match.homeTeam} vs ${match.awayTeam}`)
        if (match.currentScore) {
          const score = match.currentScore as { home: number; away: number }
          console.log(`    Score: ${score.home} - ${score.away}`)
        }
        console.log(`    Elapsed: ${match.elapsed || 0} minutes`)
        console.log(`    Last Synced: ${match.lastSyncedAt.toISOString()}`)
        console.log('')
      }
    } else {
      console.log('\n⚡ No live matches found')
    }

    // Check data completeness
    const completeness = await prisma.marketMatch.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      where: {
        isActive: true,
      },
    })

    const totalWithOdds = await prisma.marketMatch.count({
      where: {
        isActive: true,
        consensusOdds: { not: null },
      },
    })

    const totalWithV1 = await prisma.marketMatch.count({
      where: {
        isActive: true,
        v1Model: { not: null },
      },
    })

    const totalWithV2 = await prisma.marketMatch.count({
      where: {
        isActive: true,
        v2Model: { not: null },
      },
    })

    const totalActive = completeness.reduce((sum, g) => sum + g._count.id, 0)

    console.log('\n✅ Data Completeness:')
    console.log(`  Total Active Matches: ${totalActive}`)
    console.log(`  Matches with Consensus Odds: ${totalWithOdds} (${((totalWithOdds / totalActive) * 100).toFixed(1)}%)`)
    console.log(`  Matches with V1 Model: ${totalWithV1} (${((totalWithV1 / totalActive) * 100).toFixed(1)}%)`)
    console.log(`  Matches with V2 Model: ${totalWithV2} (${((totalWithV2 / totalActive) * 100).toFixed(1)}%)`)

    // Check for errors
    const matchesWithErrors = await prisma.marketMatch.count({
      where: {
        isActive: true,
        syncErrors: { gt: 0 },
      },
    })

    if (matchesWithErrors > 0) {
      console.log(`\n⚠️  Matches with Sync Errors: ${matchesWithErrors}`)
      const errorMatches = await prisma.marketMatch.findMany({
        where: {
          isActive: true,
          syncErrors: { gt: 0 },
        },
        select: {
          matchId: true,
          status: true,
          syncErrors: true,
          lastSyncError: true,
        },
        take: 5,
      })
      for (const match of errorMatches) {
        console.log(`  ${match.matchId} (${match.status}): ${match.syncErrors} errors`)
        if (match.lastSyncError) {
          console.log(`    Last Error: ${match.lastSyncError}`)
        }
      }
    }

  } catch (error) {
    console.error('❌ Database check failed:', error)
  }
}

async function verifyExpectedResponse(response: SyncResponse, type: string) {
  console.log(`\n✅ Expected Response Format for ${type}:`)
  console.log('=' .repeat(50))
  
  const expected = {
    success: true,
    results: {
      [type]: {
        synced: 'number (>= 0)',
        errors: 'number (>= 0)',
        skipped: 'number (>= 0)',
      },
    },
    summary: {
      totalSynced: 'number (>= 0)',
      totalErrors: 'number (>= 0)',
      totalSkipped: 'number (>= 0)',
      duration: 'string (e.g., "1234ms")',
    },
  }

  console.log(JSON.stringify(expected, null, 2))

  console.log(`\n📋 Actual Response for ${type}:`)
  console.log('=' .repeat(50))
  console.log(JSON.stringify(response, null, 2))

  // Validate response structure
  console.log(`\n🔍 Validation:`)
  const issues: string[] = []

  if (response.success !== true) {
    issues.push('❌ success should be true')
  } else {
    console.log('✅ success: true')
  }

  if (!response.results) {
    issues.push('❌ results object missing')
  } else {
    console.log('✅ results object present')
    
    const typeResult = response.results[type as keyof typeof response.results]
    if (!typeResult) {
      issues.push(`❌ results.${type} missing`)
    } else {
      console.log(`✅ results.${type} present`)
      
      if (typeof typeResult.synced !== 'number') {
        issues.push(`❌ results.${type}.synced should be number`)
      } else {
        console.log(`✅ results.${type}.synced: ${typeResult.synced}`)
      }
      
      if (typeof typeResult.errors !== 'number') {
        issues.push(`❌ results.${type}.errors should be number`)
      } else {
        console.log(`✅ results.${type}.errors: ${typeResult.errors}`)
      }
      
      if (typeof typeResult.skipped !== 'number') {
        issues.push(`❌ results.${type}.skipped should be number`)
      } else {
        console.log(`✅ results.${type}.skipped: ${typeResult.skipped}`)
      }
    }
  }

  if (!response.summary) {
    issues.push('❌ summary object missing')
  } else {
    console.log('✅ summary object present')
    
    if (typeof response.summary.totalSynced !== 'number') {
      issues.push('❌ summary.totalSynced should be number')
    } else {
      console.log(`✅ summary.totalSynced: ${response.summary.totalSynced}`)
    }
    
    if (typeof response.summary.duration !== 'string') {
      issues.push('❌ summary.duration should be string')
    } else {
      console.log(`✅ summary.duration: ${response.summary.duration}`)
    }
  }

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues Found:`)
    for (const issue of issues) {
      console.log(`  ${issue}`)
    }
  } else {
    console.log(`\n✅ Response structure is valid!`)
  }

  return issues.length === 0
}

async function main() {
  console.log('🔍 MarketMatch Sync Verification')
  console.log('=' .repeat(50))
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Cron Secret: ${CRON_SECRET.substring(0, 10)}...`)

  // Test upcoming matches sync
  console.log('\n' + '='.repeat(50))
  console.log('TEST 1: Upcoming Matches Sync')
  console.log('='.repeat(50))
  
  const upcomingResponse = await testEndpoint('upcoming')
  if (upcomingResponse) {
    await verifyExpectedResponse(upcomingResponse, 'upcoming')
  }

  // Test live matches sync
  console.log('\n' + '='.repeat(50))
  console.log('TEST 2: Live Matches Sync')
  console.log('='.repeat(50))
  
  const liveResponse = await testEndpoint('live')
  if (liveResponse) {
    await verifyExpectedResponse(liveResponse, 'live')
  }

  // Test completed matches sync
  console.log('\n' + '='.repeat(50))
  console.log('TEST 3: Completed Matches Sync')
  console.log('='.repeat(50))
  
  const completedResponse = await testEndpoint('completed')
  if (completedResponse) {
    await verifyExpectedResponse(completedResponse, 'completed')
  }

  // Check database
  await checkDatabase()

  console.log('\n' + '='.repeat(50))
  console.log('✅ Verification Complete!')
  console.log('='.repeat(50))
  
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

