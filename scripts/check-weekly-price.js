const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWeeklyPrice() {
  try {
    console.log('🔍 Checking weekly_pass package price...\n');
    
    // Get user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      include: { country: true }
    });
    
    console.log(`User: ${user?.email}`);
    console.log(`Country: ${user?.country?.name} (${user?.countryId})\n`);
    
    // Check weekly_pass price
    const weeklyPrice = await prisma.packageCountryPrice.findFirst({
      where: {
        countryId: user?.countryId,
        packageType: 'weekly_pass'
      }
    });
    
    if (weeklyPrice) {
      console.log('✅ Weekly pass price found:');
      console.log(`   - Price: $${weeklyPrice.price}`);
      console.log(`   - Original Price: $${weeklyPrice.originalPrice || 'N/A'}`);
      console.log(`   - Package Type: ${weeklyPrice.packageType}`);
      console.log(`   - Country: ${user?.country?.name}\n`);
      
      if (weeklyPrice.price !== 24.99) {
        console.log('❌ Price is NOT $24.99!');
        console.log('   Expected: $24.99');
        console.log(`   Actual: $${weeklyPrice.price}\n`);
        
        console.log('🔧 To fix this, update the price in the database:');
        console.log('   UPDATE "PackageCountryPrice" SET price = 24.99 WHERE packageType = \'weekly_pass\' AND countryId = \'' + user?.countryId + '\';');
      } else {
        console.log('✅ Price is correct: $24.99');
      }
    } else {
      console.log('❌ Weekly pass price not found for this country');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWeeklyPrice(); 