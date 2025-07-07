const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPaymentStatus() {
  try {
    console.log('🧪 Testing Payment Status API...\n');

    // 1. Get test user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' }
    });

    if (!user) {
      console.log('❌ Test user not found');
      return;
    }

    console.log(`👤 User: ${user.email}`);
    console.log(`🆔 User ID: ${user.id}\n`);

    // 2. Check recent purchases (last 5 minutes)
    console.log('📦 Checking recent purchases...');
    const recentPurchases = await prisma.purchase.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      include: {
        quickPurchase: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${recentPurchases.length} recent purchases:`);
    recentPurchases.forEach(purchase => {
      console.log(`  - ID: ${purchase.id}`);
      console.log(`    Amount: $${purchase.amount}`);
      console.log(`    Status: ${purchase.status}`);
      console.log(`    Created: ${purchase.createdAt}`);
      console.log(`    Item: ${purchase.quickPurchase?.name || 'N/A'}`);
    });

    // 3. Check recent user packages (last 5 minutes)
    console.log('\n📦 Checking recent user packages...');
    const recentUserPackages = await prisma.userPackage.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      include: {
        packageOffer: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${recentUserPackages.length} recent user packages:`);
    recentUserPackages.forEach(userPackage => {
      console.log(`  - ID: ${userPackage.id}`);
      console.log(`    Package: ${userPackage.packageOffer?.name || 'N/A'}`);
      console.log(`    Tips Remaining: ${userPackage.tipsRemaining}`);
      console.log(`    Created: ${userPackage.createdAt}`);
    });

    // 4. Check recent package purchases (last 5 minutes)
    console.log('\n📦 Checking recent package purchases...');
    const recentPackagePurchases = await prisma.packagePurchase.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${recentPackagePurchases.length} recent package purchases:`);
    recentPackagePurchases.forEach(purchase => {
      console.log(`  - ID: ${purchase.id}`);
      console.log(`    Amount: $${purchase.amount}`);
      console.log(`    Status: ${purchase.status}`);
      console.log(`    Package Type: ${purchase.packageType}`);
      console.log(`    Created: ${purchase.createdAt}`);
    });

    // 5. Check user's current credits
    console.log('\n💰 Checking user credits...');
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { predictionCredits: true }
    });

    console.log(`Current credits: ${currentUser?.predictionCredits || 0}`);

    // 6. Simulate what the payment status API would return
    console.log('\n🔍 Simulating Payment Status API Response:');
    
    if (recentPurchases.length > 0 || recentUserPackages.length > 0 || recentPackagePurchases.length > 0) {
      console.log('✅ Status: succeeded');
      console.log('   - Recent activity found in database');
    } else {
      console.log('⏳ Status: processing');
      console.log('   - No recent activity found in database');
      console.log('   - This is why the UI shows "failed" - no database records created');
    }

    console.log('\n💡 Analysis:');
    console.log('The payment status API checks for recent database records.');
    console.log('If no records are found (because webhook failed), it returns "processing".');
    console.log('The frontend polls this endpoint and eventually times out, showing "failed".');
    console.log('The actual payment succeeded in Stripe, but the backend processing failed.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentStatus(); 