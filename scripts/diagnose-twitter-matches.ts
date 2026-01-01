/**
 * Diagnose Twitter Match Query
 * 
 * This script helps debug why only 5 matches are showing
 */

import prisma from '../lib/db'
import { Prisma } from '@prisma/client'

async function diagnoseTwitterMatches() {
  console.log('🔍 Diagnosing Twitter Match Query Issues\n')
  console.log('='.repeat(60))
  
  const now = new Date()
  
  // 1. Total UPCOMING matches
  console.log('\n1️⃣  Total UPCOMING matches:')
  const totalUpcoming = await prisma.marketMatch.count({
    where: {
      status: 'UPCOMING',
      isActive: true,
    },
  })
  console.log(`   Total: ${totalUpcoming}`)
  
  // 2. UPCOMING matches with any QuickPurchase
  console.log('\n2️⃣  UPCOMING matches with ANY QuickPurchase:')
  const withAnyQP = await prisma.marketMatch.count({
    where: {
      status: 'UPCOMING',
      isActive: true,
      quickPurchases: {
        some: {},
      },
    },
  })
  console.log(`   Count: ${withAnyQP}`)
  
  // 3. UPCOMING matches with active QuickPurchase
  console.log('\n3️⃣  UPCOMING matches with active QuickPurchase:')
  const withActiveQP = await prisma.marketMatch.count({
    where: {
      status: 'UPCOMING',
      isActive: true,
      quickPurchases: {
        some: {
          isActive: true,
        },
      },
    },
  })
  console.log(`   Count: ${withActiveQP}`)
  
  // 4. UPCOMING matches with predictionActive QuickPurchase
  console.log('\n4️⃣  UPCOMING matches with predictionActive QuickPurchase:')
  const withPredActive = await prisma.marketMatch.count({
    where: {
      status: 'UPCOMING',
      isActive: true,
      quickPurchases: {
        some: {
          isActive: true,
          isPredictionActive: true,
        },
      },
    },
  })
  console.log(`   Count: ${withPredActive}`)
  
  // 5. UPCOMING matches with predictionData (current query)
  console.log('\n5️⃣  UPCOMING matches with predictionData (current query):')
  const withPredData = await prisma.marketMatch.count({
    where: {
      status: 'UPCOMING',
      isActive: true,
      quickPurchases: {
        some: {
          isActive: true,
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
        },
      },
    },
  })
  console.log(`   Count: ${withPredData}`)
  
  // 6. Future matches (kickoffDate > now) with predictionData
  console.log('\n6️⃣  Future matches (kickoffDate > now) with predictionData:')
  const futureWithPredData = await prisma.marketMatch.count({
    where: {
      status: 'UPCOMING',
      isActive: true,
      kickoffDate: { gt: now },
      quickPurchases: {
        some: {
          isActive: true,
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
        },
      },
    },
  })
  console.log(`   Count: ${futureWithPredData}`)
  
  // 7. Sample matches (first 10)
  console.log('\n7️⃣  Sample matches (first 10) matching criteria:')
  const sampleMatches = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      isActive: true,
      quickPurchases: {
        some: {
          isActive: true,
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
        },
      },
    },
    select: {
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
      kickoffDate: true,
      status: true,
      quickPurchases: {
        where: {
          isActive: true,
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull },
        },
        select: {
          id: true,
          confidenceScore: true,
        },
        take: 1,
      },
    },
    orderBy: { kickoffDate: 'asc' },
    take: 10,
  })
  
  console.log(`   Found ${sampleMatches.length} matches:`)
  sampleMatches.forEach((match, idx) => {
    const hoursUntil = Math.round((match.kickoffDate.getTime() - now.getTime()) / (1000 * 60 * 60))
    const isPast = match.kickoffDate < now
    console.log(`   ${idx + 1}. ${match.homeTeam} vs ${match.awayTeam} (${match.league})`)
    console.log(`      Kickoff: ${match.kickoffDate.toISOString()} ${isPast ? '⚠️ PAST' : ''} (${hoursUntil > 0 ? `+${hoursUntil}h` : `${hoursUntil}h`})`)
    console.log(`      QuickPurchase: ${match.quickPurchases.length > 0 ? `Yes (${match.quickPurchases[0]?.confidenceScore || 'N/A'}% confidence)` : 'No'}`)
  })
  
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Total UPCOMING: ${totalUpcoming}`)
  console.log(`   With QuickPurchase: ${withAnyQP}`)
  console.log(`   With active QuickPurchase: ${withActiveQP}`)
  console.log(`   With predictionActive: ${withPredActive}`)
  console.log(`   With predictionData: ${withPredData} ✅ (this is what shows in UI)`)
  console.log(`   Future with predictionData: ${futureWithPredData} ⭐ (recommended filter)`)
  
  if (futureWithPredData < withPredData) {
    console.log(`\n   ⚠️  ${withPredData - futureWithPredData} matches have passed kickoff time but status is still UPCOMING`)
  }
  
  console.log('\n')
}

diagnoseTwitterMatches()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

