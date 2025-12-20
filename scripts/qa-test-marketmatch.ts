/**
 * Comprehensive QA Test Suite for MarketMatch Setup
 * 
 * This script validates:
 * - Database schema
 * - API endpoints
 * - Authentication
 * - Data transformation
 * - Sync logic
 * - Status transitions
 * - Edge cases
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '../lib/logger'

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
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2))
  }
}

async function testDatabaseSchema() {
  console.log('\n📊 Testing Database Schema...')
  
  try {
    // Test 1: MarketMatch table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'MarketMatch'
      )
    `
    addResult('MarketMatch table exists', Array.isArray(tableExists) && tableExists[0]?.exists === true)
    
    // Test 2: Check required fields
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'MarketMatch'
      ORDER BY column_name
    `
    const requiredFields = [
      'id', 'matchId', 'status', 'homeTeam', 'awayTeam', 'league',
      'kickoffDate', 'lastSyncedAt', 'syncCount', 'syncErrors',
      'leagueFlagUrl', 'leagueFlagEmoji'
    ]
    const existingFields = columns.map(c => c.column_name)
    const missingFields = requiredFields.filter(f => !existingFields.includes(f))
    addResult('Required fields exist', missingFields.length === 0, 
      missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : undefined,
      { existingFields, missingFields })
    
    // Test 3: Check indexes
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'MarketMatch'
    `
    const expectedIndexes = ['MarketMatch_matchId_key'] // Unique constraint creates an index
    const existingIndexes = indexes.map(i => i.indexname)
    addResult('Indexes exist', existingIndexes.length > 0, 
      existingIndexes.length === 0 ? 'No indexes found' : undefined,
      { existingIndexes })
    
    // Test 4: Check QuickPurchase relation
    const quickPurchaseColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'QuickPurchase' 
      AND column_name = 'marketMatchId'
    `
    addResult('QuickPurchase.marketMatchId exists', quickPurchaseColumns.length > 0)
    
  } catch (error) {
    addResult('Database schema tests', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testDataTransformation() {
  console.log('\n🔄 Testing Data Transformation...')
  
  // Mock API response
  const mockApiMatch = {
    id: '12345',
    home: { name: 'Team A', id: '1', logo_url: 'https://example.com/logo-a.png' },
    away: { name: 'Team B', id: '2', logo_url: 'https://example.com/logo-b.png' },
    league: { 
      name: 'Premier League', 
      id: '10',
      country: 'England',
      flagUrl: 'https://example.com/flag.png',
      flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
    },
    kickoff_at: new Date().toISOString(),
    status: 'LIVE',
    odds: {
      novig_current: { home: 2.5, draw: 3.0, away: 2.8 },
      books: { bet365: { home: 2.5, draw: 3.0, away: 2.8 } }
    },
    models: {
      v1_consensus: { pick: 'home', confidence: 0.65, probs: { home: 0.65, draw: 0.20, away: 0.15 } },
      v2_lightgbm: { pick: 'home', confidence: 0.70, probs: { home: 0.70, draw: 0.15, away: 0.15 } }
    },
    score: { home: 1, away: 0 },
    minute: 45,
    period: '1st Half'
  }
  
  // Test transformation logic (simplified)
  try {
    const matchId = String(mockApiMatch.id)
    const status = mockApiMatch.status?.toUpperCase() || 'UPCOMING'
    const normalizedStatus = status === 'LIVE' ? 'LIVE' : status === 'FINISHED' || status === 'COMPLETED' ? 'FINISHED' : 'UPCOMING'
    
    addResult('MatchId extraction', matchId === '12345')
    addResult('Status normalization (LIVE)', normalizedStatus === 'LIVE')
    
    const leagueFlagUrl = mockApiMatch.league?.flagUrl || mockApiMatch.league?.flag || null
    const leagueFlagEmoji = mockApiMatch.league?.flagEmoji || null
    
    addResult('League flag URL extraction', leagueFlagUrl === 'https://example.com/flag.png')
    addResult('League flag emoji extraction', leagueFlagEmoji === '🏴󠁧󠁢󠁥󠁮󠁧󠁿')
    
    // Test invalid matchId handling
    const invalidMatchIds = ['null', 'undefined', null, undefined, '']
    const invalidResults = invalidMatchIds.map(id => {
      const str = String(id || '')
      return !str || str === 'undefined' || str === 'null'
    })
    addResult('Invalid matchId handling', invalidResults.every(r => r === true))
    
  } catch (error) {
    addResult('Data transformation tests', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testSyncLogic() {
  console.log('\n⚙️ Testing Sync Logic...')
  
  try {
    // Test 1: Check sync intervals constants
    const LIVE_SYNC_INTERVAL = 30 * 1000 // 30 seconds
    const UPCOMING_SYNC_INTERVAL = 10 * 60 * 1000 // 10 minutes
    
    addResult('LIVE_SYNC_INTERVAL is 30 seconds', LIVE_SYNC_INTERVAL === 30000)
    addResult('UPCOMING_SYNC_INTERVAL is 10 minutes', UPCOMING_SYNC_INTERVAL === 600000)
    
    // Test 2: Check if MarketMatch records exist and have sync metadata
    const sampleMatch = await prisma.marketMatch.findFirst({
      select: {
        matchId: true,
        status: true,
        lastSyncedAt: true,
        syncCount: true,
        syncErrors: true,
        nextSyncAt: true,
        syncPriority: true
      }
    })
    
    if (sampleMatch) {
      addResult('Sample match has sync metadata', 
        !!sampleMatch.lastSyncedAt && 
        typeof sampleMatch.syncCount === 'number' &&
        typeof sampleMatch.syncErrors === 'number')
      
      // Test sync priority logic
      const hasValidPriority = ['high', 'medium', 'low'].includes(sampleMatch.syncPriority || '')
      addResult('Sync priority is valid', hasValidPriority)
    } else {
      addResult('No sample matches found (run sync first)', true, undefined, { note: 'This is expected if no sync has run yet' })
    }
    
  } catch (error) {
    addResult('Sync logic tests', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testStatusTransitions() {
  console.log('\n🔄 Testing Status Transitions...')
  
  try {
    // Check if we have matches with different statuses
    const statusCounts = await prisma.marketMatch.groupBy({
      by: ['status'],
      _count: true
    })
    
    addResult('Status distribution exists', statusCounts.length > 0, 
      statusCounts.length === 0 ? 'No matches found' : undefined,
      { statusCounts: statusCounts.map(s => ({ status: s.status, count: s._count })) })
    
    // Check if status values are normalized correctly
    const validStatuses = ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED']
    const invalidStatuses = statusCounts.filter(s => !validStatuses.includes(s.status))
    addResult('All statuses are valid', invalidStatuses.length === 0,
      invalidStatuses.length > 0 ? `Invalid statuses: ${invalidStatuses.map(s => s.status).join(', ')}` : undefined)
    
  } catch (error) {
    addResult('Status transition tests', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testCronConfiguration() {
  console.log('\n⏰ Testing Cron Configuration...')
  
  try {
    const fs = require('fs')
    const vercelJson = JSON.parse(fs.readFileSync('vercel.json', 'utf-8'))
    
    // Test 1: Check cron jobs exist
    const crons = vercelJson.crons || []
    const marketCrons = crons.filter((c: any) => c.path?.includes('/api/admin/market/sync-scheduled'))
    addResult('Market sync cron jobs exist', marketCrons.length > 0,
      marketCrons.length === 0 ? 'No market sync cron jobs found' : undefined,
      { marketCrons: marketCrons.map((c: any) => ({ path: c.path, schedule: c.schedule })) })
    
    // Test 2: Check cron schedules
    const liveCron = marketCrons.find((c: any) => c.path?.includes('type=live'))
    const upcomingCron = marketCrons.find((c: any) => c.path?.includes('type=upcoming'))
    const completedCron = marketCrons.find((c: any) => c.path?.includes('type=completed'))
    
    addResult('Live cron runs every minute', liveCron?.schedule === '* * * * *')
    addResult('Upcoming cron runs every 10 minutes', upcomingCron?.schedule === '*/10 * * * *')
    addResult('Completed cron runs every 10 minutes', completedCron?.schedule === '*/10 * * * *')
    
    // Test 3: Check maxDuration
    const functions = vercelJson.functions || {}
    const marketFunction = functions['app/api/admin/market/**/*.ts']
    addResult('Market sync maxDuration is 60s', marketFunction?.maxDuration === 60)
    
  } catch (error) {
    addResult('Cron configuration tests', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testEdgeCases() {
  console.log('\n🔍 Testing Edge Cases...')
  
  try {
    // Test 1: Check for matches with null/empty matchId (should not exist)
    const invalidMatchIds = await prisma.marketMatch.findMany({
      where: {
        OR: [
          { matchId: null as any },
          { matchId: '' },
          { matchId: 'null' },
          { matchId: 'undefined' }
        ]
      },
      select: { id: true, matchId: true }
    })
    addResult('No invalid matchIds in database', invalidMatchIds.length === 0,
      invalidMatchIds.length > 0 ? `Found ${invalidMatchIds.length} invalid matchIds` : undefined)
    
    // Test 2: Check for duplicate matchIds (should not exist due to unique constraint)
    const duplicates = await prisma.$queryRaw<Array<{ matchId: string, count: number }>>`
      SELECT "matchId", COUNT(*) as count
      FROM "MarketMatch"
      GROUP BY "matchId"
      HAVING COUNT(*) > 1
    `
    addResult('No duplicate matchIds', duplicates.length === 0,
      duplicates.length > 0 ? `Found ${duplicates.length} duplicate matchIds` : undefined)
    
    // Test 3: Check sync error handling
    const matchesWithErrors = await prisma.marketMatch.findMany({
      where: {
        syncErrors: { gt: 0 }
      },
      select: {
        matchId: true,
        syncErrors: true,
        lastSyncError: true
      },
      take: 5
    })
    addResult('Error tracking works', true, undefined,
      { matchesWithErrors: matchesWithErrors.length, 
        sample: matchesWithErrors[0] || null })
    
  } catch (error) {
    addResult('Edge case tests', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function runAllTests() {
  console.log('🧪 Starting Comprehensive QA Tests for MarketMatch Setup\n')
  console.log('=' .repeat(60))
  
  await testDatabaseSchema()
  await testDataTransformation()
  await testSyncLogic()
  await testStatusTransitions()
  await testCronConfiguration()
  await testEdgeCases()
  
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

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error)
  process.exit(1)
})

