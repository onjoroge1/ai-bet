const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPackagePricing() {
  try {
    console.log('🔍 Debugging Package Pricing Issue...\n');
    
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
    
    // 2. Check PackageOffer with country prices
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
      console.log(`✅ Found PackageOffer: ${packageOffer.name}`);
      console.log(`   - ID: ${packageOffer.id}`);
      console.log(`   - Package Type: ${packageOffer.packageType}`);
      console.log(`   - Country Prices: ${packageOffer.countryPrices.length}`);
      
      if (packageOffer.countryPrices.length > 0) {
        const price = packageOffer.countryPrices[0];
        console.log(`   - Price: ${price.currencySymbol}${price.price}`);
        console.log(`   - Currency: ${price.currencyCode}`);
      } else {
        console.log('❌ No country prices found for this user!');
      }
    } else {
      console.log('❌ No PackageOffer found');
    }
    
    // 3. Test the exact request that would be sent
    console.log('\n📤 Testing Payment Intent Request:');
    const testRequest = {
      itemId: packageOffer?.id || 'test_id',
      itemType: 'package',
      paymentMethod: 'card'
    };
    console.log(JSON.stringify(testRequest, null, 2));
    
    // 4. Simulate the API logic
    console.log('\n🔍 Simulating API Logic:');
    
    if (packageOffer) {
      console.log('1. ✅ PackageOffer found by ID');
      
      if (packageOffer.countryPrices.length === 0) {
        console.log('❌ ERROR: No country prices found - this causes 400 error!');
        console.log('   The API returns: "Package not found or not available in your country"');
      } else {
        console.log('✅ Country prices found - payment intent should work');
      }
    } else {
      console.log('❌ PackageOffer not found by ID');
      console.log('   API would try to parse as countryId_packageType format');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPackagePricing(); 