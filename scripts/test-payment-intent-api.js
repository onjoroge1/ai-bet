const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPaymentIntentAPI() {
  try {
    console.log('🧪 Testing Payment Intent API...\n');
    
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
    
    // 2. Get a PackageOffer
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
    
    if (!packageOffer) {
      console.log('❌ No PackageOffer found');
      return;
    }
    
    console.log(`✅ Found PackageOffer: ${packageOffer.name} (${packageOffer.id})`);
    
    // 3. Test the API call
    console.log('\n📡 Testing API call...');
    
    const testRequest = {
      itemId: packageOffer.id,
      itemType: 'package',
      paymentMethod: 'card'
    };
    
    console.log('Request payload:');
    console.log(JSON.stringify(testRequest, null, 2));
    
    // Note: We can't actually call the API from this script because we need authentication
    // But we can simulate what should happen
    
    console.log('\n🔍 Expected API Flow:');
    console.log('1. ✅ Validate itemId and itemType');
    console.log('2. ✅ Get user country');
    console.log('3. ✅ Find PackageOffer by ID');
    console.log('4. ✅ Check country prices');
    console.log('5. ✅ Create Stripe payment intent');
    
    // 4. Check what could go wrong
    console.log('\n🔍 Potential Issues:');
    
    // Check if user has countryId
    if (!user.countryId) {
      console.log('❌ User countryId is not set');
    } else {
      console.log('✅ User countryId is set');
    }
    
    // Check if PackageOffer has country prices
    if (packageOffer.countryPrices.length === 0) {
      console.log('❌ PackageOffer has no country prices');
    } else {
      console.log('✅ PackageOffer has country prices');
    }
    
    // Check if the price is valid
    const price = packageOffer.countryPrices[0];
    if (price && (isNaN(price.price) || price.price <= 0)) {
      console.log('❌ Invalid price');
    } else {
      console.log('✅ Price is valid');
    }
    
    // 5. Simulate the exact error conditions from the API
    console.log('\n🔍 API Error Conditions:');
    
    if (!testRequest.itemId || !testRequest.itemType) {
      console.log('❌ Missing itemId or itemType');
    } else {
      console.log('✅ itemId and itemType provided');
    }
    
    if (!user?.country) {
      console.log('❌ User country not set');
    } else {
      console.log('✅ User country is set');
    }
    
    if (!packageOffer) {
      console.log('❌ PackageOffer not found');
    } else {
      console.log('✅ PackageOffer found');
    }
    
    if (packageOffer && packageOffer.countryPrices.length === 0) {
      console.log('❌ Package not available in user country');
    } else {
      console.log('✅ Package available in user country');
    }
    
    console.log('\n💡 Conclusion:');
    console.log('Based on this analysis, the payment intent should work.');
    console.log('The 400 error might be due to:');
    console.log('1. Authentication issues');
    console.log('2. Network/request format issues');
    console.log('3. Environment variable issues (Stripe keys)');
    console.log('4. Middleware blocking the request');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentIntentAPI(); 