const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function debugLiveTicker() {
  try {
    console.log('🔍 Debugging Live Ticker API...')
    
    const now = new Date()
    const futureDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000))
    
    console.log('Current time:', now.toISOString())
    console.log('Future date (7 days):', futureDate.toISOString())
    
    // Get sample records
    const records = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: null }
      },
      take: 5,
      select: {
        id: true,
        matchData: true,
        createdAt: true
      }
    })
    
    console.log(`\n📊 Found ${records.length} records with prediction data`)
    
    let validCount = 0
    records.forEach((record, i) => {
      const matchData = record.matchData
      console.log(`\nRecord ${i+1}:`)
      console.log('  ID:', record.id)
      console.log('  Created:', record.createdAt)
      console.log('  Match Date:', matchData?.date)
      
      if (matchData?.date) {
        const matchDate = new Date(matchData.date)
        console.log('  Match Date Parsed:', matchDate.toISOString())
        console.log('  Is after now?', matchDate > now)
        console.log('  Is before future?', matchDate < futureDate)
        const willBeIncluded = matchDate > now && matchDate < futureDate
        console.log('  Will be included?', willBeIncluded)
        
        if (willBeIncluded) {
          validCount++
        }
      } else {
        console.log('  ❌ No match date found')
      }
    })
    
    console.log(`\n✅ Valid records that would be included: ${validCount}`)
    
    // Now let's see what the actual SQL query looks like
    console.log('\n🔍 SQL Query being executed:')
    console.log(`
SELECT "id", "predictionData", "matchData", "predictionType", "confidenceScore", "odds", "valueRating", "createdAt"
FROM "QuickPurchase" 
WHERE "isActive" = true 
  AND "isPredictionActive" = true 
  AND "predictionData" IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 20
    `)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugLiveTicker()
