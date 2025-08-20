const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSpecificRecords() {
  try {
    console.log('🔍 Checking Specific Live-Ticker Records...\n');
    
    // Check the specific records from the live-ticker
    const recordIds = [
      'cmej57wj400cnjm047iwl8o3o',
      'cmej57wih00cfjm04kgscfn0k',
      'cmej57zyy00evjm04216qnoh4',
      'cmej57zy900enjm04qv30hwzl',
      'cmej586pc00j3jm04ck8l15hr',
      'cmej57wmb00drjm04rhvd99qk',
      'cmej57wlp00djjm04hllavr5i',
      'cmej57wl400dbjm0442ntd5m0'
    ];
    
    const records = await prisma.quickPurchase.findMany({
      where: {
        id: { in: recordIds }
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
      }
    });
    
    console.log(`📊 Found ${records.length} records:`);
    records.forEach((qp, index) => {
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
        console.log(`✅ Has PredictionData: ${Object.keys(qp.predictionData).length} keys`);
        console.log(`PredictionData Keys: ${Object.keys(qp.predictionData)}`);
        
        if (qp.predictionData.prediction) {
          console.log(`Prediction Keys: ${Object.keys(qp.predictionData.prediction)}`);
          if (qp.predictionData.prediction.comprehensive_analysis) {
            console.log(`Comprehensive Analysis Keys: ${Object.keys(qp.predictionData.prediction.comprehensive_analysis)}`);
          }
        }
      } else {
        console.log(`❌ No PredictionData`);
      }
      
      if (qp.matchData) {
        console.log(`✅ Has MatchData: ${Object.keys(qp.matchData).length} keys`);
        console.log(`MatchData: ${JSON.stringify(qp.matchData, null, 2)}`);
      } else {
        console.log(`❌ No MatchData`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificRecords();
