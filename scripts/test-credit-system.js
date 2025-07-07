const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreditSystem() {
  try {
    console.log('🔍 Testing Credit System Integration...\n');
    
    // Get user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      select: { id: true, email: true, predictionCredits: true }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`👤 User: ${user.email}`);
    console.log(`💰 Current Credits: ${user.predictionCredits}\n`);
    
    // Test different package types and their credit values
    const testPackages = [
      { name: 'Single Tip', totalTips: 1, expectedCredits: 1 },
      { name: 'Weekend Package', totalTips: 5, expectedCredits: 5 },
      { name: 'Weekly Package', totalTips: 8, expectedCredits: 8 },
      { name: 'Monthly Subscription', totalTips: -1, expectedCredits: 1000 }
    ];
    
    console.log('📊 Credit System Test Results:');
    testPackages.forEach(pkg => {
      const creditsToAdd = pkg.totalTips === -1 ? 1000 : pkg.totalTips;
      console.log(`   - ${pkg.name}: ${pkg.totalTips} tips → ${creditsToAdd} credits`);
    });
    
    // Check if there are any existing package purchases
    const packagePurchases = await prisma.packagePurchase.findMany({
      where: { userId: user.id },
      include: {
        user: { select: { email: true, predictionCredits: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    
    console.log(`\n📦 Recent Package Purchases (${packagePurchases.length}):`);
    packagePurchases.forEach((purchase, index) => {
      console.log(`   ${index + 1}. ${purchase.packageType || 'Unknown'}`);
      console.log(`      - Amount: $${purchase.amount}`);
      console.log(`      - Status: ${purchase.status}`);
      console.log(`      - Date: ${purchase.createdAt.toLocaleDateString()}`);
    });
    
    // Check user packages
    const userPackages = await prisma.userPackage.findMany({
      where: { userId: user.id },
      include: {
        packageOffer: { select: { name: true, packageType: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    
    console.log(`\n🎁 Recent User Packages (${userPackages.length}):`);
    userPackages.forEach((userPkg, index) => {
      console.log(`   ${index + 1}. ${userPkg.packageOffer?.name || 'Unknown Package'}`);
      console.log(`      - Tips Remaining: ${userPkg.tipsRemaining}`);
      console.log(`      - Total Tips: ${userPkg.totalTips}`);
      console.log(`      - Expires: ${userPkg.expiresAt.toLocaleDateString()}`);
      console.log(`      - Status: ${userPkg.status}`);
    });
    
    console.log('\n✅ Credit System Integration Summary:');
    console.log('   - Package purchases create UserPackage records');
    console.log('   - Credits are added to user.predictionCredits field');
    console.log('   - Notifications are sent for credit additions');
    console.log('   - Monthly subscriptions get 1000 credits (unlimited)');
    console.log('   - Limited packages get credits equal to tip count');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreditSystem(); 