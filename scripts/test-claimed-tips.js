const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testClaimedTips() {
  try {
    console.log('🧪 Testing Claimed Tips API...\n');

    // Get a test user
    const user = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true
      }
    });

    if (!user) {
      console.log('❌ No admin user found');
      return;
    }

    console.log(`👤 Testing with user: ${user.email}\n`);

    // Check if user has any claimed tips
    const claimedTips = await prisma.purchase.findMany({
      where: {
        userId: user.id,
        paymentMethod: 'credits',
        status: 'completed'
      },
      include: {
        quickPurchase: {
          include: {
            country: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    console.log(`📊 Found ${claimedTips.length} claimed tips\n`);

    if (claimedTips.length > 0) {
      console.log('📋 Sample claimed tip:');
      const tip = claimedTips[0];
      console.log(`   ID: ${tip.id}`);
      console.log(`   Created: ${tip.createdAt}`);
      console.log(`   Status: ${tip.status}`);
      console.log(`   Payment Method: ${tip.paymentMethod}`);
      
      if (tip.quickPurchase) {
        const matchData = tip.quickPurchase.matchData;
        console.log(`   Match: ${matchData?.home_team || 'Unknown'} vs ${matchData?.away_team || 'Unknown'}`);
        console.log(`   League: ${matchData?.league || 'Unknown'}`);
        console.log(`   Prediction Type: ${tip.quickPurchase.predictionType || 'Unknown'}`);
        console.log(`   Odds: ${tip.quickPurchase.odds || 'Unknown'}`);
        console.log(`   Confidence: ${tip.quickPurchase.confidenceScore || 'Unknown'}%`);
      }
    }

    // Test the filtering logic
    console.log('\n🔍 Testing filtering logic...');
    
    const now = new Date();
    const activeTips = claimedTips.filter(tip => {
      const isExpired = new Date(tip.createdAt.getTime() + 24 * 60 * 60 * 1000) < now;
      const matchDate = new Date(tip.quickPurchase?.matchData?.date || tip.createdAt);
      const isMatchPlayed = matchDate < now;
      return tip.status === 'completed' && !isExpired && !isMatchPlayed;
    });

    const usedTips = claimedTips.filter(tip => {
      const matchDate = new Date(tip.quickPurchase?.matchData?.date || tip.createdAt);
      const isMatchPlayed = matchDate < now;
      return tip.status === 'completed' && isMatchPlayed;
    });

    const expiredTips = claimedTips.filter(tip => {
      const isExpired = new Date(tip.createdAt.getTime() + 24 * 60 * 60 * 1000) < now;
      const matchDate = new Date(tip.quickPurchase?.matchData?.date || tip.createdAt);
      const isMatchPlayed = matchDate < now;
      return tip.status === 'completed' && isExpired && !isMatchPlayed;
    });

    console.log(`   Active tips: ${activeTips.length}`);
    console.log(`   Used tips: ${usedTips.length}`);
    console.log(`   Expired tips: ${expiredTips.length}`);

  } catch (error) {
    console.error('❌ Error testing claimed tips:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testClaimedTips(); 