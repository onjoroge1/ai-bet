const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugPaymentFailure() {
  try {
    console.log('🔍 Debugging Payment Failure...\n');

    // 1. Get user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      include: { country: true }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`👤 User: ${user.email}`);
    console.log(`🌍 Country: ${user.country?.name} (${user.countryId})\n`);

    // 2. Check what the frontend pricing API returns
    console.log('📊 Frontend Pricing API Analysis:');
    
    // Simulate what the pricing API returns
    const packageCountryPrices = await prisma.packageCountryPrice.findMany({
      where: { countryId: user.countryId },
      include: { country: true }
    });

    console.log('Package IDs that frontend would send:');
    packageCountryPrices.forEach(pkg => {
      const packageId = `${pkg.countryId}_${pkg.packageType}`;
      console.log(`   - ${pkg.packageType}: "${packageId}"`);
    });

    // 3. Check what the payment intent metadata shows
    console.log('\n🔍 Payment Intent Analysis:');
    console.log('From your payment intent data:');
    console.log('   - Description: "Purchase: weekend_pass Package"');
    console.log('   - This suggests itemId might be "weekend_pass" (not the full countryId_weekend_pass)');
    
    // 4. Test what happens with different itemId formats
    console.log('\n🧪 Testing Different itemId Formats:');
    
    // Test 1: Just package type (what might be happening)
    const testItemId1 = 'weekend_pass';
    console.log(`\nTest 1: itemId = "${testItemId1}"`);
    
    if (testItemId1.includes('_')) {
      const parts = testItemId1.split('_');
      console.log(`   - Has underscore: YES`);
      console.log(`   - Parts: ${JSON.stringify(parts)}`);
      console.log(`   - Would be parsed as: countryId="${parts[0]}", packageType="${parts[1]}"`);
      console.log(`   - ❌ This would fail because "weekend" is not a valid countryId`);
    } else {
      console.log(`   - Has underscore: NO`);
      console.log(`   - Would be treated as PackageOffer ID`);
      console.log(`   - Would look for PackageOffer with ID: "${testItemId1}"`);
    }

    // Test 2: Full format (what should happen)
    const testItemId2 = `${user.countryId}_weekend_pass`;
    console.log(`\nTest 2: itemId = "${testItemId2}"`);
    
    if (testItemId2.includes('_')) {
      const parts = testItemId2.split('_');
      console.log(`   - Has underscore: YES`);
      console.log(`   - Parts: ${JSON.stringify(parts)}`);
      console.log(`   - Would be parsed as: countryId="${parts[0]}", packageType="${parts[1]}"`);
      console.log(`   - ✅ This would work correctly`);
    }

    // 5. Check if PackageOffer exists with weekend_pass ID
    console.log('\n📦 PackageOffer Check:');
    const packageOffer = await prisma.packageOffer.findFirst({
      where: { packageType: 'weekend_pass' }
    });

    if (packageOffer) {
      console.log(`   - Found PackageOffer with packageType 'weekend_pass': ${packageOffer.id}`);
      console.log(`   - Name: ${packageOffer.name}`);
    } else {
      console.log(`   - ❌ No PackageOffer found with packageType 'weekend_pass'`);
    }

    // 6. Check PackageCountryPrice for weekend_pass
    console.log('\n💰 PackageCountryPrice Check:');
    const countryPrice = await prisma.packageCountryPrice.findFirst({
      where: {
        countryId: user.countryId,
        packageType: 'weekend_pass'
      }
    });

    if (countryPrice) {
      console.log(`   - ✅ Found PackageCountryPrice for weekend_pass`);
      console.log(`   - Price: $${countryPrice.price}`);
    } else {
      console.log(`   - ❌ No PackageCountryPrice found for weekend_pass`);
    }

    // 7. Conclusion
    console.log('\n💡 CONCLUSION:');
    console.log('The issue is likely that the frontend is sending:');
    console.log('   itemId: "weekend_pass"');
    console.log('Instead of:');
    console.log(`   itemId: "${user.countryId}_weekend_pass"`);
    console.log('\nThis would cause the payment intent creation to fail because:');
    console.log('1. The API expects either a PackageOffer ID or countryId_packageType format');
    console.log('2. "weekend_pass" is neither a valid PackageOffer ID nor a valid countryId_packageType');
    console.log('3. The API would return a 400 error: "Invalid package ID format"');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPaymentFailure(); 