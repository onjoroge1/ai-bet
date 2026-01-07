/**
 * Diagnostic Script for Parlay System
 * 
 * This script diagnoses issues with the parlay system:
 * 1. Checks for parlays with missing legs
 * 2. Verifies matchId format consistency
 * 3. Checks UPCOMING matches
 * 4. Identifies potential issues
 */

import prisma from '../lib/db'
import { logger } from '../lib/logger'

async function diagnoseParlays() {
  console.log('🔍 Starting Parlay System Diagnostic...\n')

  try {
    // Test 1: Check ParlayConsensus counts
    console.log('📊 Test 1: ParlayConsensus Counts')
    console.log('─'.repeat(50))
    
    const parlayCounts = await prisma.$queryRaw<Array<{
      total_parlays: bigint
      active_parlays: bigint
      sgp_parlays: bigint
      backend_parlays: bigint
      expired_parlays: bigint
      invalid_parlays: bigint
    }>>`
      SELECT 
        COUNT(*) as total_parlays,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_parlays,
        COUNT(CASE WHEN "parlayType" = 'single_game' THEN 1 END) as sgp_parlays,
        COUNT(CASE WHEN "apiVersion" IN ('v1', 'v2') THEN 1 END) as backend_parlays,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_parlays,
        COUNT(CASE WHEN status = 'invalid' THEN 1 END) as invalid_parlays
      FROM "ParlayConsensus"
    `)

    const counts = parlayCounts[0]
    console.log(`Total Parlays: ${counts.total_parlays}`)
    console.log(`Active Parlays: ${counts.active_parlays}`)
    console.log(`Single-Game Parlays: ${counts.sgp_parlays}`)
    console.log(`Backend API Parlays: ${counts.backend_parlays}`)
    console.log(`Expired Parlays: ${counts.expired_parlays}`)
    console.log(`Invalid Parlays: ${counts.invalid_parlays}`)
    console.log('')

    // Test 2: Check parlays with missing/incomplete legs
    console.log('📊 Test 2: Parlay-Leg Relationship')
    console.log('─'.repeat(50))
    
    const parlayLegIssues = await prisma.$queryRaw<Array<{
      parlay_id: string
      leg_count: number
      actual_leg_count: bigint
      status: string
      api_version: string
      parlay_type: string
      created_at: Date
    }>>`
      SELECT 
        pc.id as parlay_id,
        pc."legCount" as leg_count,
        COUNT(pl.id) as actual_leg_count,
        CASE 
          WHEN COUNT(pl.id) = 0 THEN 'NO_LEGS'
          WHEN COUNT(pl.id) < pc."legCount" THEN 'INCOMPLETE_LEGS'
          ELSE 'OK'
        END as status,
        pc."apiVersion" as api_version,
        pc."parlayType" as parlay_type,
        pc."createdAt" as created_at
      FROM "ParlayConsensus" pc
      LEFT JOIN "ParlayLeg" pl ON pl."parlayId" = pc.id
      WHERE pc.status = 'active'
      GROUP BY pc.id, pc."legCount", pc."apiVersion", pc."parlayType", pc."createdAt"
      ORDER BY pc."createdAt" DESC
      LIMIT 50
    `)

    const noLegs = parlayLegIssues.filter(p => p.status === 'NO_LEGS')
    const incompleteLegs = parlayLegIssues.filter(p => p.status === 'INCOMPLETE_LEGS')
    const okParlays = parlayLegIssues.filter(p => p.status === 'OK')

    console.log(`Parlays analyzed: ${parlayLegIssues.length}`)
    console.log(`Parlays with NO legs: ${noLegs.length}`)
    console.log(`Parlays with INCOMPLETE legs: ${incompleteLegs.length}`)
    console.log(`Parlays with OK legs: ${okParlays.length}`)
    console.log('')

    if (noLegs.length > 0) {
      console.log('⚠️  Sample Parlays with NO legs:')
      noLegs.slice(0, 5).forEach(p => {
        console.log(`  - Parlay ID: ${p.parlay_id}`)
        console.log(`    Expected: ${p.leg_count} legs, Actual: 0 legs`)
        console.log(`    API Version: ${p.api_version}, Type: ${p.parlay_type}`)
        console.log(`    Created: ${p.created_at}`)
      })
      console.log('')
    }

    if (incompleteLegs.length > 0) {
      console.log('⚠️  Sample Parlays with INCOMPLETE legs:')
      incompleteLegs.slice(0, 5).forEach(p => {
        console.log(`  - Parlay ID: ${p.parlay_id}`)
        console.log(`    Expected: ${p.leg_count} legs, Actual: ${p.actual_leg_count}`)
        console.log(`    API Version: ${p.api_version}, Type: ${p.parlay_type}`)
      })
      console.log('')
    }

    // Test 3: Check matchId matching with MarketMatch
    console.log('📊 Test 3: MatchId Matching')
    console.log('─'.repeat(50))
    
    // First check if there are any ParlayLegs at all
    const totalLegs = await prisma.parlayLeg.count()
    let noMatch: Array<{ leg_match_id: string; market_match_id: string | null; market_status: string | null; match_count: bigint; status: string }> = []
    let notUpcoming: Array<{ leg_match_id: string; market_match_id: string | null; market_status: string | null; match_count: bigint; status: string }> = []
    let okMatches: Array<{ leg_match_id: string; market_match_id: string | null; market_status: string | null; match_count: bigint; status: string }> = []
    
    if (totalLegs === 0) {
      console.log('⚠️  No ParlayLeg records found in database!')
      console.log('   → This means either:')
      console.log('     1. No parlays have been synced yet')
      console.log('     2. All leg creation attempts failed')
      console.log('     3. Backend APIs returned 0 parlays (confirmed above)')
      console.log('')
    } else {
      const matchIdIssues = await prisma.$queryRaw<Array<{
        leg_match_id: string
        market_match_id: string | null
        market_status: string | null
        match_count: bigint
        status: string
      }>>`
        SELECT DISTINCT
          pl."matchId" as leg_match_id,
          mm."matchId" as market_match_id,
          mm.status as market_status,
          COUNT(*) as match_count,
          CASE 
            WHEN mm."matchId" IS NULL THEN 'NO_MATCH'
            WHEN mm.status != 'UPCOMING' THEN 'NOT_UPCOMING'
            ELSE 'OK'
          END as status
        FROM "ParlayLeg" pl
        LEFT JOIN "MarketMatch" mm ON mm."matchId" = pl."matchId"
        WHERE pl."parlayId" IN (
          SELECT id FROM "ParlayConsensus" WHERE status = 'active'
        )
        GROUP BY pl."matchId", mm."matchId", mm.status
        ORDER BY match_count DESC
        LIMIT 50
      `)
      
      noMatch = matchIdIssues.filter(m => m.status === 'NO_MATCH')
      notUpcoming = matchIdIssues.filter(m => m.status === 'NOT_UPCOMING')
      okMatches = matchIdIssues.filter(m => m.status === 'OK')

      console.log(`Total ParlayLegs in database: ${totalLegs}`)
      console.log(`Legs analyzed: ${matchIdIssues.length}`)
      console.log(`Legs with NO matching MarketMatch: ${noMatch.length}`)
      console.log(`Legs with NON-UPCOMING matches: ${notUpcoming.length}`)
      console.log(`Legs with OK UPCOMING matches: ${okMatches.length}`)
      console.log('')

      if (noMatch.length > 0) {
        console.log('⚠️  Sample Legs with NO matching MarketMatch:')
        noMatch.slice(0, 5).forEach(m => {
          console.log(`  - Leg matchId: ${m.leg_match_id} (used in ${m.match_count} legs)`)
          console.log(`    MarketMatch matchId: ${m.market_match_id || 'NULL'}`)
        })
        console.log('')
      }

      if (notUpcoming.length > 0) {
        console.log('⚠️  Sample Legs with NON-UPCOMING matches:')
        notUpcoming.slice(0, 5).forEach(m => {
          console.log(`  - Leg matchId: ${m.leg_match_id}`)
          console.log(`    MarketMatch status: ${m.market_status} (should be UPCOMING)`)
        })
        console.log('')
      }
    }


    // Test 4: Check UPCOMING matches
    console.log('📊 Test 4: UPCOMING Matches')
    console.log('─'.repeat(50))
    
    const now = new Date()
    const upcomingMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: { gt: now },
        isActive: true,
      },
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        status: true,
      },
      take: 10,
    })

    const upcomingMatchIds = new Set(upcomingMatches.map(m => m.matchId))
    
    console.log(`UPCOMING matches found: ${upcomingMatches.length}`)
    console.log('')
    
    if (upcomingMatches.length > 0) {
      console.log('✅ Sample UPCOMING matches:')
      upcomingMatches.slice(0, 5).forEach(m => {
        console.log(`  - ${m.homeTeam} vs ${m.awayTeam} (${m.league})`)
        console.log(`    MatchId: ${m.matchId}, Kickoff: ${m.kickoffDate.toISOString()}`)
      })
      console.log('')
    } else {
      console.log('⚠️  NO UPCOMING matches found! This would filter out ALL parlays.')
      console.log('')
    }

    // Test 5: Check active parlays that would display
    console.log('📊 Test 5: Displayable Parlays')
    console.log('─'.repeat(50))
    
    const activeParlaysWithLegs = await prisma.parlayConsensus.findMany({
      where: {
        status: 'active',
      },
      include: {
        legs: {
          orderBy: { legOrder: 'asc' },
        },
      },
      take: 20,
    })

    // Filter like the GET endpoint does
    const displayableParlays = activeParlaysWithLegs.filter(parlay => {
      if (!parlay.legs || parlay.legs.length === 0) return false
      return parlay.legs.every(leg => upcomingMatchIds.has(leg.matchId))
    })

    console.log(`Active parlays in database: ${activeParlaysWithLegs.length}`)
    console.log(`Parlays that would DISPLAY (all legs UPCOMING): ${displayableParlays.length}`)
    console.log(`Parlays filtered OUT: ${activeParlaysWithLegs.length - displayableParlays.length}`)
    console.log('')

    if (displayableParlays.length === 0 && activeParlaysWithLegs.length > 0) {
      console.log('⚠️  ISSUE: Active parlays exist but NONE would display!')
      console.log('   Reasons could be:')
      console.log('   1. Parlays have no legs')
      console.log('   2. Leg matchIds don\'t match UPCOMING matches')
      console.log('   3. MatchIds format mismatch')
      console.log('')
    }

    // Summary
    console.log('📋 DIAGNOSTIC SUMMARY')
    console.log('═'.repeat(50))
    console.log(`Total Parlays: ${counts.total_parlays}`)
    console.log(`Active Parlays: ${counts.active_parlays}`)
    console.log(`Parlays with NO legs: ${noLegs.length} ${noLegs.length > 0 ? '⚠️' : '✅'}`)
    console.log(`Parlays with INCOMPLETE legs: ${incompleteLegs.length} ${incompleteLegs.length > 0 ? '⚠️' : '✅'}`)
    console.log(`Legs with NO matching MarketMatch: ${totalLegs > 0 ? noMatch.length : 'N/A (no legs)'} ${totalLegs > 0 ? (noMatch.length > 0 ? '⚠️' : '✅') : '⚠️'}`)
    console.log(`Legs with NON-UPCOMING matches: ${totalLegs > 0 ? notUpcoming.length : 'N/A (no legs)'} ${totalLegs > 0 ? (notUpcoming.length > 0 ? '⚠️' : '✅') : '⚠️'}`)
    console.log(`UPCOMING matches available: ${upcomingMatches.length} ${upcomingMatches.length > 0 ? '✅' : '⚠️'}`)
    console.log(`Parlays that would DISPLAY: ${displayableParlays.length} ${displayableParlays.length > 0 ? '✅' : '⚠️'}`)
    console.log('═'.repeat(50))
    console.log('')

    // Critical Issues
    console.log('🔍 CRITICAL ISSUES IDENTIFIED:')
    console.log('─'.repeat(50))
    
    if (totalLegs === 0) {
      console.log('🔴 CRITICAL ISSUE: No ParlayLeg records in database!')
      console.log('   → This means no parlays have been successfully synced.')
      console.log('   → Root cause: Backend APIs returning 0 parlays (confirmed above)')
      console.log('   → Solution: Use local SGP generation instead')
      console.log('     1. POST /api/admin/parlays/generate (generates SGPs)')
      console.log('     2. POST /api/admin/parlays/sync-generated (stores SGPs)')
      console.log('     3. Or wait for cron job (runs every 30 min)')
      console.log('')
    } else if (noLegs.length > 0 || incompleteLegs.length > 0) {
      console.log('🔴 CRITICAL ISSUE: Parlays with missing/incomplete legs!')
      console.log('   → This is likely the root cause of no parlays displaying.')
      console.log('   → Fix: Investigate leg creation failures in sync code.')
      console.log('')
    }

    if (totalLegs > 0 && noMatch.length > 0) {
      console.log('🔴 CRITICAL ISSUE: Leg matchIds don\'t match MarketMatch!')
      console.log('   → This prevents filtering from working correctly.')
      console.log('   → Fix: Verify matchId format consistency.')
      console.log('')
    }

    if (upcomingMatches.length === 0) {
      console.log('🔴 CRITICAL ISSUE: No UPCOMING matches found!')
      console.log('   → This would filter out ALL parlays.')
      console.log('   → Fix: Check MarketMatch sync, verify UPCOMING matches exist.')
      console.log('')
    }

    if (displayableParlays.length === 0 && activeParlaysWithLegs.length > 0) {
      console.log('🔴 CRITICAL ISSUE: Active parlays exist but NONE would display!')
      console.log('   → Review issues above to identify root cause.')
      console.log('')
    } else if (displayableParlays.length === 0 && counts.active_parlays === 0) {
      console.log('🔴 CRITICAL ISSUE: No active parlays in database!')
      console.log('   → Root cause: Backend APIs returning 0 parlays')
      console.log('   → Solution: Use local SGP generation instead')
      console.log('     1. POST /api/admin/parlays/generate (generates SGPs)')
      console.log('     2. POST /api/admin/parlays/sync-generated (stores SGPs)')
      console.log('     3. Or wait for cron job (runs every 30 min)')
      console.log('')
    }

    if (displayableParlays.length > 0) {
      console.log('✅ GOOD: Some parlays would display correctly!')
    }

  } catch (error) {
    console.error('❌ Error running diagnostic:', error)
    logger.error('Error running parlay diagnostic', {
      tags: ['diagnostic', 'parlays'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run diagnostic
diagnoseParlays()
  .then(() => {
    console.log('✅ Diagnostic complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Diagnostic failed:', error)
    process.exit(1)
  })

