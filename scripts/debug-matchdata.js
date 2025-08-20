const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugMatchData() {
  try {
    console.log('🔍 Debugging MatchData Structure...\n');
    
    // Get a few QuickPurchase records with matchData
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        matchData: { not: null }
      },
      select: {
        id: true,
        name: true,
        matchData: true,
        predictionData: true,
        createdAt: true
      },
      take: 3
    });
    
    console.log(`📊 Found ${quickPurchases.length} records with matchData:`);
    quickPurchases.forEach((qp, index) => {
      console.log(`\n--- Record ${index + 1} ---`);
      console.log(`ID: ${qp.id}`);
      console.log(`Name: ${qp.name}`);
      console.log(`Created: ${qp.createdAt}`);
      
      if (qp.matchData) {
        console.log(`MatchData Keys: ${Object.keys(qp.matchData)}`);
        console.log(`MatchData Structure:`);
        console.log(JSON.stringify(qp.matchData, null, 2));
      }
      
      if (qp.predictionData) {
        console.log(`PredictionData Keys: ${Object.keys(qp.predictionData)}`);
        if (qp.predictionData.comprehensive_analysis) {
          console.log(`Comprehensive Analysis Keys: ${Object.keys(qp.predictionData.comprehensive_analysis)}`);
          if (qp.predictionData.comprehensive_analysis.ai_verdict) {
            console.log(`AI Verdict: ${JSON.stringify(qp.predictionData.comprehensive_analysis.ai_verdict, null, 2)}`);
          }
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMatchData();
