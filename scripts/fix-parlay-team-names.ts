/**
 * Fix Parlay Team Names Script
 * 
 * Updates ParlayLeg records that have "TBD" or missing team names
 * by enriching them from MarketMatch table
 * 
 * Run with: npx tsx scripts/fix-parlay-team-names.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixParlayTeamNames() {
  console.log('🔧 Fixing parlay team names...\n')
  
  try {
    // Find all legs with TBD team names
    const legsWithTBD = await prisma.parlayLeg.findMany({
      where: {
        OR: [
          { homeTeam: 'TBD' },
          { awayTeam: 'TBD' }
        ]
      },
      select: {
        id: true,
        matchId: true,
        homeTeam: true,
        awayTeam: true
      }
    })
    
    console.log(`📊 Found ${legsWithTBD.length} legs with missing or TBD team names\n`)
    
    if (legsWithTBD.length === 0) {
      console.log('✅ No legs need fixing!\n')
      return
    }
    
    // Get unique matchIds
    const matchIds = [...new Set(legsWithTBD.map(l => l.matchId))]
    console.log(`📊 Unique match IDs to lookup: ${matchIds.length}\n`)
    
    // Fetch MarketMatch data
    const marketMatches = await prisma.marketMatch.findMany({
      where: {
        matchId: { in: matchIds }
      },
      select: {
        matchId: true,
        homeTeam: true,
        awayTeam: true
      }
    })
    
    const matchMap = new Map(marketMatches.map(m => [m.matchId, m]))
    console.log(`✅ Found ${marketMatches.length} matches in MarketMatch table\n`)
    
    let updated = 0
    let skipped = 0
    let errors = 0
    
    for (const leg of legsWithTBD) {
      try {
        const matchData = matchMap.get(leg.matchId)
        
        if (!matchData) {
          console.log(`⚠️  Match ID ${leg.matchId} not found in MarketMatch - skipping`)
          skipped++
          continue
        }
        
        if (!matchData.homeTeam || !matchData.awayTeam || 
            matchData.homeTeam === 'TBD' || matchData.awayTeam === 'TBD') {
          console.log(`⚠️  Match ID ${leg.matchId} has invalid team names in MarketMatch - skipping`)
          skipped++
          continue
        }
        
        // Update leg with correct team names
        await prisma.parlayLeg.update({
          where: { id: leg.id },
          data: {
            homeTeam: matchData.homeTeam,
            awayTeam: matchData.awayTeam
          }
        })
        
        updated++
        console.log(`✅ Updated leg ${leg.id}: ${matchData.homeTeam} vs ${matchData.awayTeam}`)
      } catch (error) {
        errors++
        console.error(`❌ Error updating leg ${leg.id}:`, error instanceof Error ? error.message : 'Unknown error')
      }
    }
    
    console.log('\n' + '═'.repeat(80))
    console.log('📊 SUMMARY:')
    console.log(`   Total legs with TBD: ${legsWithTBD.length}`)
    console.log(`   ✅ Updated: ${updated}`)
    console.log(`   ⚠️  Skipped: ${skipped}`)
    console.log(`   ❌ Errors: ${errors}`)
    console.log('═'.repeat(80))
    console.log('✅ Fix complete!\n')
    
  } catch (error) {
    console.error('❌ Error during fix:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixParlayTeamNames()
  .catch(console.error)
  .finally(() => {
    console.log('🔌 Database connection closed')
    process.exit(0)
  })

