const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEnrichedPredictions() {
  try {
    console.log('🔍 Checking Enriched Prediction Data...\n');
    
    // Get records with predictionData
    const enrichedRecords = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: null }
      },
      select: {
        id: true,
        name: true,
        predictionType: true,
        predictionData: true,
        createdAt: true
      },
      take: 5
    });
    
    console.log(`📊 Found ${enrichedRecords.length} records with predictionData:`);
    enrichedRecords.forEach((qp, index) => {
      console.log(`\n--- Record ${index + 1} ---`);
      console.log(`ID: ${qp.id}`);
      console.log(`Name: ${qp.name}`);
      console.log(`Prediction Type: ${qp.predictionType || 'NULL'}`);
      console.log(`Created: ${qp.createdAt}`);
      
      if (qp.predictionData) {
        console.log(`PredictionData Keys: ${Object.keys(qp.predictionData)}`);
        
        if (qp.predictionData.comprehensive_analysis) {
          console.log(`Comprehensive Analysis Keys: ${Object.keys(qp.predictionData.comprehensive_analysis)}`);
          
          if (qp.predictionData.comprehensive_analysis.ai_verdict) {
            console.log(`AI Verdict Keys: ${Object.keys(qp.predictionData.comprehensive_analysis.ai_verdict)}`);
            console.log(`Recommended Outcome: ${qp.predictionData.comprehensive_analysis.ai_verdict.recommended_outcome}`);
            console.log(`Confidence Level: ${qp.predictionData.comprehensive_analysis.ai_verdict.confidence_level}`);
          }
          
          if (qp.predictionData.comprehensive_analysis.ml_prediction) {
            console.log(`ML Prediction Keys: ${Object.keys(qp.predictionData.comprehensive_analysis.ml_prediction)}`);
            console.log(`Home Win: ${qp.predictionData.comprehensive_analysis.ml_prediction.home_win}`);
            console.log(`Draw: ${qp.predictionData.comprehensive_analysis.ml_prediction.draw}`);
            console.log(`Away Win: ${qp.predictionData.comprehensive_analysis.ml_prediction.away_win}`);
            console.log(`Confidence: ${qp.predictionData.comprehensive_analysis.ml_prediction.confidence}`);
          }
        }
        
        if (qp.predictionData.prediction) {
          console.log(`Prediction Keys: ${Object.keys(qp.predictionData.prediction)}`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnrichedPredictions();
