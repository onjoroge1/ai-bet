const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCreditBalance() {
  try {
    console.log('🧪 Testing Credit Balance API...\n');

    // Get a test user
    const user = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true,
        predictionCredits: true
      }
    });

    if (!user) {
      console.log('❌ No admin user found');
      return;
    }

    console.log(`👤 Testing with user: ${user.email}`);
    console.log(`💰 Direct prediction credits: ${user.predictionCredits}\n`);

    // Get user's quiz points
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId: user.id }
    });

    console.log(`🎯 Quiz points: ${userPoints ? userPoints.points : 0}`);
    console.log(`🎯 Quiz credits: ${userPoints ? Math.floor(userPoints.points / 50) : 0}\n`);

    // Get user's active packages
    const userPackages = await prisma.userPackage.findMany({
      where: {
        userId: user.id,
        status: "active",
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        packageOffer: true
      }
    });

    console.log(`📦 Active packages: ${userPackages.length}`);
    
    let packageCreditsCount = 0;
    let hasUnlimited = false;

    for (const userPackage of userPackages) {
      console.log(`   - ${userPackage.packageOffer.name}: ${userPackage.tipsRemaining}/${userPackage.totalTips} tips`);
      
      if (userPackage.packageOffer.tipCount === -1) {
        hasUnlimited = true;
      } else {
        packageCreditsCount += userPackage.tipsRemaining;
      }
    }

    const quizCreditsCount = userPoints ? Math.floor(userPoints.points / 50) : 0;
    const totalUnifiedCredits = hasUnlimited ? "∞" : (packageCreditsCount + quizCreditsCount);

    console.log(`\n📊 Credit Summary:`);
    console.log(`   - Package credits: ${packageCreditsCount}`);
    console.log(`   - Quiz credits: ${quizCreditsCount}`);
    console.log(`   - Total unified credits: ${totalUnifiedCredits}`);
    console.log(`   - Has unlimited: ${hasUnlimited}`);

    console.log('\n✅ Credit balance calculation test completed!');
    console.log('\n🌐 You can now test the API at: GET /api/credits/balance');

  } catch (error) {
    console.error('❌ Error testing credit balance:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreditBalance(); 