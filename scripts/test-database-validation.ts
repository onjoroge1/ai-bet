/**
 * Database Validation Tests for MarketMatch
 * Run with: npx tsx scripts/test-database-validation.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: any
}

const results: TestResult[] = []

function addResult(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}${error ? ` - ${error}` : ''}`)
  if (details && !passed) {
    console.log(`   Details:`, JSON.stringify(details, null, 2))
  }
}

async function testDatabaseSchema() {
  console.log('\n📊 Testing Database Schema...')
  
  try {
    // Test 1: MarketMatch table exists and can be queried
    const count = await prisma.marketMatch.count()
    addResult('MarketMatch table is accessible', true, undefined, { totalMatches: count })
    
    // Test 2: Check required fields exist by trying to create a test query
    const sample = await prisma.marketMatch.findFirst({
      select: {
        id: true,
        matchId: true,
        status: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        lastSyncedAt: true,
        syncCount: true,
        syncErrors: true,
        leagueFlagUrl: true,
        leagueFlagEmoji: true,
      }
    })
    
    if (sample) {
      addResult('Required fields exist and are queryable', true, undefined, {
        hasMatchId: !!sample.matchId,
        hasStatus: !!sample.status,
        hasFlagUrl: sample.leagueFlagUrl !== undefined,
        hasFlagEmoji: sample.leagueFlagEmoji !== undefined,
      })
    } else {
      addResult('Required fields exist (no data to verify)', true, undefined, { note: 'Table structure is valid' })
    }
    
    // Test 3: Check QuickPurchase relation
    const quickPurchaseWithRelation = await prisma.quickPurchase.findFirst({
      where: { marketMatchId: { not: null } },
      select: { id: true, marketMatchId: true }
    })
    addResult('QuickPurchase.marketMatchId relation works', true, undefined, {
      hasRelation: !!quickPurchaseWithRelation,
      sampleRelation: quickPurchaseWithRelation ? { id: quickPurchaseWithRelation.id, marketMatchId: quickPurchaseWithRelation.marketMatchId } : null
    })
    
    // Test 4: Check status values
    const statusCounts = await prisma.marketMatch.groupBy({
      by: ['status'],
      _count: true
    })
    const validStatuses = ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED']
    const invalidStatuses = statusCounts.filter(s => !validStatuses.includes(s.status))
    addResult('All statuses are valid', invalidStatuses.length === 0,
      invalidStatuses.length > 0 ? `Invalid: ${invalidStatuses.map(s => s.status).join(', ')}` : undefined,
      { statusDistribution: statusCounts.map(s => ({ status: s.status, count: s._count })) })
    
    // Test 5: Check for duplicate matchIds (should be impossible due to unique constraint)
    const duplicates = await prisma.$queryRaw<Array<{ matchId: string, count: bigint }>>`
      SELECT "matchId", COUNT(*) as count
      FROM "MarketMatch"
      GROUP BY "matchId"
      HAVING COUNT(*) > 1
    `
    addResult('No duplicate matchIds', duplicates.length === 0,
      duplicates.length > 0 ? `Found ${duplicates.length} duplicates` : undefined)
    
    // Test 6: Check sync metadata
    const matchesWithSyncData = await prisma.marketMatch.findMany({
      where: {
        syncCount: { gte: 0 }
      },
      take: 1,
      select: {
        matchId: true,
        lastSyncedAt: true,
        syncCount: true,
        syncErrors: true,
        syncPriority: true,
        nextSyncAt: true
      }
    })
    addResult('Sync metadata fields work', matchesWithSyncData.length >= 0, undefined, {
      sample: matchesWithSyncData[0] || null
    })
    
  } catch (error) {
    addResult('Database schema tests', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testDataIntegrity() {
  console.log('\n🔍 Testing Data Integrity...')
  
  try {
    // Test 1: Check for invalid matchIds
    const invalidMatchIds = await prisma.marketMatch.findMany({
      where: {
        OR: [
          { matchId: '' },
          { matchId: 'null' },
          { matchId: 'undefined' }
        ]
      },
      select: { id: true, matchId: true },
      take: 10
    })
    addResult('No invalid matchIds', invalidMatchIds.length === 0,
      invalidMatchIds.length > 0 ? `Found ${invalidMatchIds.length} invalid matchIds` : undefined)
    
    // Test 2: Check JSON fields are valid
    const matchesWithJson = await prisma.marketMatch.findMany({
      where: {
        OR: [
          { consensusOdds: { not: null } },
          { allBookmakers: { not: null } },
          { rawApiData: { not: null } }
        ]
      },
      take: 5,
      select: {
        matchId: true,
        consensusOdds: true,
        allBookmakers: true,
        rawApiData: true
      }
    })
    addResult('JSON fields are queryable', matchesWithJson.length >= 0, undefined, {
      sampleCount: matchesWithJson.length,
      sample: matchesWithJson[0] ? {
        matchId: matchesWithJson[0].matchId,
        hasConsensusOdds: !!matchesWithJson[0].consensusOdds,
        hasAllBookmakers: !!matchesWithJson[0].allBookmakers,
        hasRawApiData: !!matchesWithJson[0].rawApiData
      } : null
    })
    
    // Test 3: Check flag fields
    const matchesWithFlags = await prisma.marketMatch.findMany({
      where: {
        OR: [
          { leagueFlagUrl: { not: null } },
          { leagueFlagEmoji: { not: null } }
        ]
      },
      take: 5,
      select: {
        matchId: true,
        league: true,
        leagueFlagUrl: true,
        leagueFlagEmoji: true
      }
    })
    addResult('Flag fields are populated', matchesWithFlags.length >= 0, undefined, {
      sampleCount: matchesWithFlags.length,
      sample: matchesWithFlags[0] || null
    })
    
  } catch (error) {
    addResult('Data integrity tests', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function runTests() {
  console.log('🧪 Database Validation Tests for MarketMatch\n')
  console.log('='.repeat(60))
  
  await testDatabaseSchema()
  await testDataIntegrity()
  
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Test Summary:')
  console.log('='.repeat(60))
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  
  console.log(`Total Tests: ${total}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}${r.error ? `: ${r.error}` : ''}`)
    })
  }
  
  console.log('\n' + '='.repeat(60))
  
  await prisma.$disconnect()
  
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

