const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function inspectAdditionalMarkets() {
  try {
    console.log('Inspecting QuickPurchase records with additional_markets data...\n');
    
    // Find QuickPurchase records that have predictionData with additional_markets
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        predictionData: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        predictionData: true
      },
      take: 5 // Limit to 5 records for inspection
    });

    console.log(`Found ${quickPurchases.length} QuickPurchase records with prediction data\n`);

    quickPurchases.forEach((qp, index) => {
      console.log(`=== Record ${index + 1}: ${qp.name} (ID: ${qp.id}) ===`);
      
      const predictionData = qp.predictionData;
      if (predictionData && predictionData.prediction) {
        const additionalMarkets = predictionData.prediction.additional_markets;
        
        if (additionalMarkets) {
          console.log('Additional Markets Structure:');
          console.log(JSON.stringify(additionalMarkets, null, 2));
          
          // Check for asian_handicap specifically
          if (additionalMarkets.asian_handicap) {
            console.log('\nAsian Handicap Data:');
            console.log('Home Handicap:', additionalMarkets.asian_handicap.home_handicap);
            console.log('Away Handicap:', additionalMarkets.asian_handicap.away_handicap);
          } else {
            console.log('\nNo asian_handicap found in additional_markets');
          }
        } else {
          console.log('No additional_markets found in prediction data');
        }
      } else {
        console.log('No prediction data or prediction.prediction found');
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    });

  } catch (error) {
    console.error('Error inspecting additional markets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspectAdditionalMarkets(); 