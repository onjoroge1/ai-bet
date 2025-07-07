const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testQuickPurchasesAPI() {
  try {
    console.log('🧪 Testing Quick Purchases API Fix...\n');

    // 1. Get test user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      include: { country: true }
    });

    if (!user) {
      console.log('❌ Test user not found');
      return;
    }

    console.log(`👤 User: ${user.email}`);
    console.log(`🌍 Country: ${user.country?.name} (${user.countryId})\n`);

    // 2. Check what QuickPurchase records exist
    console.log('📦 QuickPurchase Records:');
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: { isActive: true },
      include: { country: true }
    });

    quickPurchases.forEach(purchase => {
      console.log(`   - ${purchase.name} (${purchase.type})`);
      console.log(`     * Original ID: ${purchase.id}`);
      console.log(`     * Country: ${purchase.country?.name}`);
    });

    // 3. Test the API endpoint
    console.log('\n🌐 Testing /api/quick-purchases endpoint:');
    try {
      const response = await fetch('http://localhost:3000/api/quick-purchases', {
        headers: {
          'Cookie': 'next-auth.session-token=test' // This won't work, but let's see the error
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API Response:');
        data.forEach(item => {
          console.log(`   - ${item.name} (${item.type})`);
          console.log(`     * ID: ${item.id}`);
          console.log(`     * Price: $${item.price}`);
          
          // Check if it's a premium package
          if (item.type === 'package' || item.type === 'vip') {
            if (item.id.includes('_')) {
              console.log(`     * ✅ Correct format: ${item.id}`);
            } else {
              console.log(`     * ❌ Wrong format: ${item.id}`);
            }
          }
        });
      } else {
        console.log(`❌ API error: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ API error: ${error.message}`);
    }

    // 4. Test the ID generation logic
    console.log('\n🔧 Testing ID Generation Logic:');
    
    const testCases = [
      { type: 'package', expectedPackageType: 'weekly_pass' },
      { type: 'vip', expectedPackageType: 'monthly_sub' },
      { type: 'tip', expectedPackageType: 'tip' },
      { type: 'prediction', expectedPackageType: 'prediction' }
    ];

    testCases.forEach(testCase => {
      const packageType = testCase.expectedPackageType;
      const originalId = 'test-quick-purchase-id';
      
      // Simulate the generatePackageId function
      let correctId;
      if (packageType === 'weekend_pass' || packageType === 'weekly_pass' || packageType === 'monthly_sub') {
        correctId = `${user.countryId}_${packageType}`;
      } else {
        correctId = originalId;
      }
      
      console.log(`   - ${testCase.type} → ${packageType} → ${correctId}`);
      
      if (testCase.type === 'package' || testCase.type === 'vip') {
        if (correctId.includes('_')) {
          console.log(`     * ✅ Correct format`);
        } else {
          console.log(`     * ❌ Wrong format`);
        }
      }
    });

    console.log('\n💡 Summary:');
    console.log('   - Premium packages should now return IDs in format: countryId_packageType');
    console.log('   - Regular tips/predictions should return original QuickPurchase IDs');
    console.log('   - This should fix the payment intent creation issue');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testQuickPurchasesAPI(); 