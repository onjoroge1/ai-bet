const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkQuickPurchases() {
  try {
    console.log('🔍 Checking QuickPurchase Records...\n');
    
    // Check all QuickPurchase records
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true
      },
      select: {
        id: true,
        name: true,
        predictionType: true,
        confidenceScore: true,
        odds: true,
        valueRating: true,
        predictionData: true,
        matchData: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    console.log(`📊 QuickPurchase records (${quickPurchases.length}):`);
    quickPurchases.forEach((qp, index) => {
      console.log(`\n--- Record ${index + 1} ---`);
      console.log(`ID: ${qp.id}`);
      console.log(`Name: ${qp.name}`);
      console.log(`Prediction Type: ${qp.predictionType || 'NULL'}`);
      console.log(`Confidence Score: ${qp.confidenceScore || 'NULL'}`);
      console.log(`Odds: ${qp.odds || 'NULL'}`);
      console.log(`Value Rating: ${qp.valueRating || 'NULL'}`);
      console.log(`Created: ${qp.createdAt}`);
      console.log(`Updated: ${qp.updatedAt}`);
      
      if (qp.predictionData) {
        console.log(`Prediction Data Keys: ${Object.keys(qp.predictionData)}`);
        if (qp.predictionData.prediction) {
          console.log(`Prediction Keys: ${Object.keys(qp.predictionData.prediction)}`);
          if (qp.predictionData.prediction.match_info) {
            console.log(`Match Info: ${JSON.stringify(qp.predictionData.prediction.match_info, null, 2)}`);
          }
        }
      } else {
        console.log(`Prediction Data: NULL`);
      }
      
      if (qp.matchData) {
        console.log(`Match Data Keys: ${Object.keys(qp.matchData)}`);
      } else {
        console.log(`Match Data: NULL`);
      }
    });
    
    // Check prediction type distribution
    const predictionTypes = await prisma.quickPurchase.groupBy({
      by: ['predictionType'],
      where: {
        isActive: true,
        isPredictionActive: true,
        predictionType: { not: null }
      },
      _count: {
        predictionType: true
      }
    });
    
    console.log(`\n📈 Prediction Type Distribution:`);
    predictionTypes.forEach(pt => {
      console.log(`   - ${pt.predictionType}: ${pt._count.predictionType}`);
    });
    
    // Check records with NULL predictionType
    const nullPredictionTypes = await prisma.quickPurchase.count({
      where: {
        isActive: true,
        isPredictionActive: true,
        predictionType: null
      }
    });
    
    console.log(`\n❓ Records with NULL predictionType: ${nullPredictionTypes}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkQuickPurchases();
