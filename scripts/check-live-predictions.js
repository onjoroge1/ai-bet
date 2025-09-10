const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkLivePredictions() {
  try {
    console.log('🔍 Checking Live Predictions Data...')
    
    // Check total QuickPurchase records
    const totalCount = await prisma.quickPurchase.count()
    console.log(`📊 Total QuickPurchase records: ${totalCount}`)
    
    // Check active records
    const activeCount = await prisma.quickPurchase.count({
      where: {
        isActive: true,
        isPredictionActive: true
      }
    })
    console.log(`✅ Active QuickPurchase records: ${activeCount}`)
    
    // Check records with prediction data
    const withPredictionData = await prisma.quickPurchase.count({
      where: {
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: null }
      }
    })
    console.log(`🎯 Records with prediction data: ${withPredictionData}`)
    
    // Check recent records (last 48 hours)
    const cutoffDate = new Date(Date.now() - (48 * 60 * 60 * 1000))
    const recentCount = await prisma.quickPurchase.count({
      where: {
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: null },
        createdAt: {
          gte: cutoffDate
        }
      }
    })
    console.log(`⏰ Recent records (48h): ${recentCount}`)
    
    // Get sample records
    const sampleRecords = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: null }
      },
      take: 2,
      select: {
        id: true,
        isActive: true,
        isPredictionActive: true,
        predictionData: true,
        matchData: true,
        createdAt: true
      }
    })
    
    console.log('\n📋 Sample Records:')
    sampleRecords.forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`)
      console.log(`  ID: ${record.id}`)
      console.log(`  Active: ${record.isActive}`)
      console.log(`  Prediction Active: ${record.isPredictionActive}`)
      console.log(`  Created: ${record.createdAt}`)
      console.log(`  Has Prediction Data: ${!!record.predictionData}`)
      console.log(`  Has Match Data: ${!!record.matchData}`)
      
      if (record.matchData) {
        const matchData = record.matchData
        console.log(`  Match Data Keys: ${Object.keys(matchData).join(', ')}`)
        if (matchData.date) {
          console.log(`  Match Date: ${matchData.date}`)
        }
      }
      
      if (record.predictionData) {
        const predictionData = record.predictionData
        console.log(`  Prediction Data Keys: ${Object.keys(predictionData).join(', ')}`)
      }
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLivePredictions()
