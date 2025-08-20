const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEnrichedStructure() {
  try {
    console.log('🔍 Checking Enriched Record Structure...\n');
    
    // Check the one record that has predictionData
    const enrichedRecord = await prisma.quickPurchase.findFirst({
      where: {
        id: 'cmej57wih00cfjm04kgscfn0k' // Estac Troyes vs Montpellier
      },
      select: {
        id: true,
        name: true,
        predictionData: true
      }
    });
    
    if (enrichedRecord && enrichedRecord.predictionData) {
      console.log(`📊 Enriched Record: ${enrichedRecord.name}`);
      console.log(`ID: ${enrichedRecord.id}`);
      console.log('\n📋 Full PredictionData Structure:');
      console.log(JSON.stringify(enrichedRecord.predictionData, null, 2));
      
      console.log('\n🔍 Key Paths Analysis:');
      
      // Check the prediction path
      if (enrichedRecord.predictionData.prediction) {
        console.log('\n✅ prediction.prediction exists');
        console.log(`Keys: ${Object.keys(enrichedRecord.predictionData.prediction)}`);
        
        if (enrichedRecord.predictionData.prediction.predictions) {
          console.log('\n✅ prediction.prediction.predictions exists');
          console.log(`Type: ${typeof enrichedRecord.predictionData.prediction.predictions}`);
          console.log(`Content: ${JSON.stringify(enrichedRecord.predictionData.prediction.predictions, null, 2)}`);
        }
        
        if (enrichedRecord.predictionData.prediction.analysis) {
          console.log('\n✅ prediction.prediction.analysis exists');
          console.log(`Keys: ${Object.keys(enrichedRecord.predictionData.prediction.analysis)}`);
        }
      }
      
      // Check the source path
      if (enrichedRecord.predictionData.source) {
        console.log('\n✅ source exists');
        console.log(`Type: ${typeof enrichedRecord.predictionData.source}`);
        console.log(`Content: ${JSON.stringify(enrichedRecord.predictionData.source, null, 2)}`);
      }
      
    } else {
      console.log('❌ No enriched record found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnrichedStructure();
