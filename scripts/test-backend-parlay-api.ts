/**
 * Test Backend Parlay API Response
 * 
 * This script tests the backend parlay API to verify:
 * 1. Response structure
 * 2. Leg data format
 * 3. MatchId format
 * 4. Data consistency
 */

import { logger } from '../lib/logger'

const backendUrl = process.env.BACKEND_URL || 'https://bet-genius-ai-onjoroge1.replit.app'
const apiKey = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

interface BackendParlay {
  parlay_id: string
  leg_count: number
  legs: Array<{
    edge: number
    outcome: string
    match_id: number | string
    away_team: string
    home_team: string
    model_prob: number
    decimal_odds: number
  }>
  combined_prob: number
  correlation_penalty: number
  adjusted_prob: number
  implied_odds: number
  edge_pct: number
  confidence_tier: string
  parlay_type: string
  league_group?: string
  earliest_kickoff: string
  latest_kickoff: string
  kickoff_window: string
  status: string
  created_at: string
}

interface BackendParlaysResponse {
  count: number
  status_filter: string
  parlays: BackendParlay[]
}

async function testBackendAPI(version: 'v1' | 'v2') {
  console.log(`🔍 Testing Backend ${version.toUpperCase()} Parlay API...\n`)
  console.log(`Backend URL: ${backendUrl}`)
  console.log(`API Endpoint: /api/${version}/parlays`)
  console.log('─'.repeat(50))
  console.log('')

  try {
    const url = `${backendUrl}/api/${version}/parlays`
    console.log(`Fetching from: ${url}\n`)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API Error: ${response.status} ${response.statusText}`)
      console.error(`Response: ${errorText}`)
      return
    }

    const data: BackendParlaysResponse = await response.json()

    console.log(`✅ API Response Received`)
    console.log(`   Total Parlays: ${data.count}`)
    console.log(`   Status Filter: ${data.status_filter}`)
    console.log(`   Actual Parlays in Response: ${data.parlays.length}`)
    console.log('')

    if (data.parlays.length === 0) {
      console.log('⚠️  No parlays in response!')
      return
    }

    // Test 1: Check first parlay structure
    console.log('📊 Test 1: Parlay Structure')
    console.log('─'.repeat(50))
    const firstParlay = data.parlays[0]
    console.log(`Sample Parlay ID: ${firstParlay.parlay_id}`)
    console.log(`Leg Count: ${firstParlay.leg_count}`)
    console.log(`Actual Legs in Response: ${firstParlay.legs?.length || 0}`)
    console.log(`Status: ${firstParlay.status}`)
    console.log(`Confidence Tier: ${firstParlay.confidence_tier}`)
    console.log(`Parlay Type: ${firstParlay.parlay_type}`)
    console.log(`Edge %: ${firstParlay.edge_pct}`)
    console.log(`API Version: ${version}`)
    console.log('')

    // Test 2: Check leg structure
    console.log('📊 Test 2: Leg Structure')
    console.log('─'.repeat(50))
    
    if (!firstParlay.legs || firstParlay.legs.length === 0) {
      console.log('⚠️  No legs in parlay response!')
    } else {
      const firstLeg = firstParlay.legs[0]
      console.log(`Sample Leg Data:`)
      console.log(`  match_id: ${firstLeg.match_id} (type: ${typeof firstLeg.match_id})`)
      console.log(`  outcome: ${firstLeg.outcome} (type: ${typeof firstLeg.outcome})`)
      console.log(`  home_team: ${firstLeg.home_team}`)
      console.log(`  away_team: ${firstLeg.away_team}`)
      console.log(`  model_prob: ${firstLeg.model_prob} (type: ${typeof firstLeg.model_prob})`)
      console.log(`  decimal_odds: ${firstLeg.decimal_odds} (type: ${typeof firstLeg.decimal_odds})`)
      console.log(`  edge: ${firstLeg.edge} (type: ${typeof firstLeg.edge})`)
      console.log('')

      // Validate leg data
      const issues: string[] = []
      
      if (!firstLeg.match_id && firstLeg.match_id !== 0) {
        issues.push('Missing match_id')
      } else {
        const matchIdStr = String(firstLeg.match_id)
        if (matchIdStr === 'undefined' || matchIdStr === 'null' || matchIdStr.trim() === '') {
          issues.push(`Invalid match_id: ${firstLeg.match_id}`)
        }
      }

      if (!firstLeg.outcome || !['H', 'D', 'A'].includes(firstLeg.outcome)) {
        issues.push(`Invalid outcome: ${firstLeg.outcome}`)
      }

      if (firstLeg.model_prob === null || firstLeg.model_prob === undefined || isNaN(Number(firstLeg.model_prob))) {
        issues.push(`Invalid model_prob: ${firstLeg.model_prob}`)
      }

      if (firstLeg.decimal_odds === null || firstLeg.decimal_odds === undefined || isNaN(Number(firstLeg.decimal_odds))) {
        issues.push(`Invalid decimal_odds: ${firstLeg.decimal_odds}`)
      }

      if (issues.length > 0) {
        console.log('⚠️  Leg Data Issues:')
        issues.forEach(issue => console.log(`  - ${issue}`))
      } else {
        console.log('✅ Leg data structure is valid')
      }
      console.log('')
    }

    // Test 3: Check all parlays for consistency
    console.log('📊 Test 3: Data Consistency')
    console.log('─'.repeat(50))
    
    let parlaysWithLegs = 0
    let parlaysWithoutLegs = 0
    let legsWithIssues = 0
    const matchIdTypes = new Set<string>()
    const matchIdSample = new Map<string, number>()

    for (const parlay of data.parlays) {
      if (!parlay.legs || parlay.legs.length === 0) {
        parlaysWithoutLegs++
      } else {
        parlaysWithLegs++
        
        for (const leg of parlay.legs) {
          // Track matchId types
          matchIdTypes.add(typeof leg.match_id)
          const matchIdStr = String(leg.match_id)
          matchIdSample.set(matchIdStr, (matchIdSample.get(matchIdStr) || 0) + 1)

          // Check for issues
          if (!leg.match_id && leg.match_id !== 0) {
            legsWithIssues++
          } else if (String(leg.match_id).trim() === 'undefined' || String(leg.match_id).trim() === 'null') {
            legsWithIssues++
          }

          if (!leg.outcome || !['H', 'D', 'A'].includes(leg.outcome)) {
            legsWithIssues++
          }

          if (leg.model_prob === null || leg.model_prob === undefined || isNaN(Number(leg.model_prob))) {
            legsWithIssues++
          }

          if (leg.decimal_odds === null || leg.decimal_odds === undefined || isNaN(Number(leg.decimal_odds))) {
            legsWithIssues++
          }
        }
      }
    }

    console.log(`Parlays with legs: ${parlaysWithLegs}`)
    console.log(`Parlays without legs: ${parlaysWithoutLegs}`)
    console.log(`Legs with issues: ${legsWithIssues}`)
    console.log(`MatchId types found: ${Array.from(matchIdTypes).join(', ')}`)
    console.log('')

    if (matchIdSample.size > 0) {
      console.log('Sample MatchIds (first 10):')
      Array.from(matchIdSample.keys()).slice(0, 10).forEach(matchId => {
        console.log(`  - ${matchId} (used in ${matchIdSample.get(matchId)} legs)`)
      })
      console.log('')
    }

    // Test 4: Check for duplicate leg combinations
    console.log('📊 Test 4: Duplicate Detection')
    console.log('─'.repeat(50))
    
    const legCombinations = new Map<string, number>()
    for (const parlay of data.parlays) {
      if (parlay.legs && parlay.legs.length > 0) {
        const legKey = parlay.legs
          .map(l => `${l.match_id}:${l.outcome}`)
          .sort()
          .join('|')
        legCombinations.set(legKey, (legCombinations.get(legKey) || 0) + 1)
      }
    }

    const duplicates = Array.from(legCombinations.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])

    console.log(`Unique leg combinations: ${legCombinations.size}`)
    console.log(`Duplicate combinations: ${duplicates.length}`)
    
    if (duplicates.length > 0) {
      console.log('⚠️  Sample duplicate combinations:')
      duplicates.slice(0, 5).forEach(([combo, count]) => {
        console.log(`  - ${combo} (appears ${count} times)`)
      })
    } else {
      console.log('✅ No duplicate leg combinations found')
    }
    console.log('')

    // Summary
    console.log('📋 TEST SUMMARY')
    console.log('═'.repeat(50))
    console.log(`API Version: ${version.toUpperCase()}`)
    console.log(`Total Parlays: ${data.count}`)
    console.log(`Parlays with legs: ${parlaysWithLegs} ✅`)
    console.log(`Parlays without legs: ${parlaysWithoutLegs} ${parlaysWithoutLegs > 0 ? '⚠️' : '✅'}`)
    console.log(`Legs with issues: ${legsWithIssues} ${legsWithIssues > 0 ? '⚠️' : '✅'}`)
    console.log(`MatchId types: ${Array.from(matchIdTypes).join(', ')}`)
    console.log(`Duplicate combinations: ${duplicates.length} ${duplicates.length > 0 ? '⚠️' : '✅'}`)
    console.log('═'.repeat(50))
    console.log('')

    // Recommendations
    if (parlaysWithoutLegs > 0) {
      console.log('🔴 CRITICAL ISSUE: Some parlays have no legs!')
      console.log('   → These parlays cannot be stored correctly.')
      console.log('')
    }

    if (legsWithIssues > 0) {
      console.log('🔴 CRITICAL ISSUE: Some legs have invalid data!')
      console.log('   → These legs cannot be created in the database.')
      console.log('')
    }

    if (matchIdTypes.size > 1) {
      console.log('⚠️  WARNING: Multiple matchId types found!')
      console.log('   → Ensure consistent normalization in sync code.')
      console.log('')
    }

    if (duplicates.length > 0) {
      console.log('⚠️  WARNING: Duplicate leg combinations found!')
      console.log('   → Deduplication logic should handle these.')
      console.log('')
    }

    if (parlaysWithoutLegs === 0 && legsWithIssues === 0 && duplicates.length === 0) {
      console.log('✅ All tests passed! API response structure looks good.')
    }

  } catch (error) {
    console.error('❌ Error testing backend API:', error)
    logger.error('Error testing backend parlay API', {
      tags: ['test', 'backend', 'parlays'],
      data: { 
        version, 
        url: `${backendUrl}/api/${version}/parlays`,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    })
    throw error
  }
}

// Test both V1 and V2
async function runTests() {
  console.log('🧪 Backend Parlay API Testing')
  console.log('═'.repeat(50))
  console.log('')

  for (const version of ['v1', 'v2'] as const) {
    await testBackendAPI(version)
    console.log('')
  }

  console.log('✅ Testing complete!')
}

runTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Testing failed:', error)
    process.exit(1)
  })

