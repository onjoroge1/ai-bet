const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBothFlows() {
  try {
    console.log('🧪 Testing Both Purchase Flows...\n');
    
    // 1. Get a test user
    const user = await prisma.user.findFirst({
      where: { role: 'admin' },
      include: { country: true }
    });
    
    if (!user) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log(`✅ Found user: ${user.email}`);
    console.log(`   - Country: ${user.country?.name} (${user.country?.code})`);
    console.log(`   - Country ID: ${user.countryId}\n`);
    
    // 2. Test TOP PREDICTIONS flow (working)
    console.log('🔍 TESTING TOP PREDICTIONS FLOW (working):');
    console.log('==========================================');
    
    const quickPurchase = await prisma.quickPurchase.findFirst({
      where: { 
        isActive: true,
        type: 'tip'
      },
      include: {
        country: true
      }
    });
    
    if (quickPurchase) {
      console.log('✅ QuickPurchase found:');
      console.log(`   - ID: ${quickPurchase.id}`);
      console.log(`   - Name: ${quickPurchase.name}`);
      console.log(`   - Price: ${quickPurchase.price}`);
      console.log(`   - Country: ${quickPurchase.country?.name}`);
      console.log(`   - Type: ${quickPurchase.type}`);
      
      // Simulate the API request
      const tipRequest = {
        itemId: quickPurchase.id,
        itemType: 'tip',
        paymentMethod: 'card'
      };
      console.log('   - API Request:', tipRequest);
    } else {
      console.log('❌ No QuickPurchase found for tips');
    }
    
    // 3. Test PREMIUM PACKAGES flow (failing)
    console.log('\n🔍 TESTING PREMIUM PACKAGES FLOW (failing):');
    console.log('==========================================');
    
    const packageOffer = await prisma.packageOffer.findFirst({
      where: { 
        isActive: true,
        packageType: 'weekend'
      },
      include: {
        countryPrices: {
          where: {
            countryId: user.countryId,
            isActive: true
          }
        }
      }
    });
    
    if (packageOffer) {
      console.log('✅ PackageOffer found:');
      console.log(`   - ID: ${packageOffer.id}`);
      console.log(`   - Name: ${packageOffer.name}`);
      console.log(`   - Package Type: ${packageOffer.packageType}`);
      console.log(`   - Country Prices: ${packageOffer.countryPrices.length}`);
      
      if (packageOffer.countryPrices.length > 0) {
        const price = packageOffer.countryPrices[0];
        console.log(`   - Price: ${price.price}`);
        console.log(`   - Currency: ${price.currencyCode}`);
      } else {
        console.log('❌ No country prices found for user country!');
        console.log(`   User countryId: ${user.countryId}`);
        
        // Check what country prices exist for this package
        const allCountryPrices = await prisma.packageCountryPrice.findMany({
          where: {
            packageType: packageOffer.packageType,
            isActive: true
          },
          include: {
            country: true
          }
        });
        
        console.log('   Available country prices:');
        allCountryPrices.forEach(cp => {
          console.log(`     - ${cp.country.name} (${cp.countryId}): ${cp.price} ${cp.currencyCode}`);
        });
      }
      
      // Simulate the API request
      const packageRequest = {
        itemId: packageOffer.id,
        itemType: 'package',
        paymentMethod: 'card'
      };
      console.log('   - API Request:', packageRequest);
    } else {
      console.log('❌ No PackageOffer found for weekend packages');
    }
    
    // 4. Summary
    console.log('\n📊 SUMMARY:');
    console.log('===========');
    console.log('Top Predictions (working):');
    console.log('  - Uses QuickPurchase items');
    console.log('  - itemType: "tip"');
    console.log('  - Direct price lookup from QuickPurchase.country');
    
    console.log('\nPremium Packages (failing):');
    console.log('  - Uses PackageOffer items');
    console.log('  - itemType: "package"');
    console.log('  - Price lookup from PackageOffer.countryPrices');
    console.log('  - Requires countryPrices to match user.countryId');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBothFlows(); 