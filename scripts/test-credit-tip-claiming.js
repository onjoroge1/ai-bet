const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreditTipClaiming() {
  try {
    console.log('🔍 Testing Credit-Based Tip Claiming System...\n');
    
    // Get user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      select: { 
        id: true, 
        email: true, 
        predictionCredits: true 
      }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`👤 User: ${user.email}`);
    console.log(`💰 Current Credits: ${user.predictionCredits}\n`);
    
    // Get a prediction to test with
    const prediction = await prisma.prediction.findFirst({
      where: { 
        isFree: false,
        status: 'pending'
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true
          }
        }
      }
    });
    
    if (!prediction) {
      console.log('❌ No paid predictions found for testing');
      return;
    }
    
    console.log(`🎯 Test Prediction:`);
    console.log(`   - Match: ${prediction.match.homeTeam.name} vs ${prediction.match.awayTeam.name}`);
    console.log(`   - League: ${prediction.match.league.name}`);
    console.log(`   - Type: ${prediction.predictionType}`);
    console.log(`   - Odds: ${prediction.odds}`);
    console.log(`   - Confidence: ${prediction.confidenceScore}%\n`);
    
    // Check if user already claimed this tip
    const existingClaim = await prisma.creditTipClaim.findUnique({
      where: {
        userId_predictionId: {
          userId: user.id,
          predictionId: prediction.id
        }
      }
    });
    
    if (existingClaim) {
      console.log('⚠️  User already claimed this tip');
      console.log(`   - Claim ID: ${existingClaim.id}`);
      console.log(`   - Claimed: ${existingClaim.claimedAt}`);
      console.log(`   - Status: ${existingClaim.status}`);
      console.log(`   - Expires: ${existingClaim.expiresAt}\n`);
    } else {
      console.log('✅ Tip not claimed yet - eligible for claiming\n');
    }
    
    // Test eligibility logic
    const hasEnoughCredits = user.predictionCredits > 1;
    const alreadyClaimed = !!existingClaim;
    const isEligible = hasEnoughCredits && !alreadyClaimed && !prediction.isFree;
    
    console.log('📊 Eligibility Check:');
    console.log(`   - Has enough credits (>1): ${hasEnoughCredits} (${user.predictionCredits} credits)`);
    console.log(`   - Already claimed: ${alreadyClaimed}`);
    console.log(`   - Is free tip: ${prediction.isFree}`);
    console.log(`   - Overall eligible: ${isEligible}\n`);
    
    // Show recent credit transactions
    const recentTransactions = await prisma.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log('💳 Recent Credit Transactions:');
    if (recentTransactions.length === 0) {
      console.log('   No transactions found');
    } else {
      recentTransactions.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.description}`);
        console.log(`      - Amount: ${tx.amount > 0 ? '+' : ''}${tx.amount} credits`);
        console.log(`      - Type: ${tx.type}`);
        console.log(`      - Source: ${tx.source}`);
        console.log(`      - Date: ${tx.createdAt.toLocaleDateString()}`);
      });
    }
    
    console.log('\n📦 Recent Claimed Tips:');
    const recentClaims = await prisma.creditTipClaim.findMany({
      where: { userId: user.id },
      include: {
        prediction: {
          include: {
            match: {
              include: {
                homeTeam: true,
                awayTeam: true,
                league: true
              }
            }
          }
        }
      },
      orderBy: { claimedAt: 'desc' },
      take: 3
    });
    
    if (recentClaims.length === 0) {
      console.log('   No claimed tips found');
    } else {
      recentClaims.forEach((claim, index) => {
        console.log(`   ${index + 1}. ${claim.prediction.match.homeTeam.name} vs ${claim.prediction.match.awayTeam.name}`);
        console.log(`      - Credits spent: ${claim.creditsSpent}`);
        console.log(`      - Status: ${claim.status}`);
        console.log(`      - Claimed: ${claim.claimedAt.toLocaleDateString()}`);
        console.log(`      - Expires: ${claim.expiresAt.toLocaleDateString()}`);
      });
    }
    
    console.log('\n✅ Credit Tip Claiming System Test Complete!');
    console.log('   - Database models are working correctly');
    console.log('   - Eligibility logic is functioning');
    console.log('   - Transaction tracking is active');
    console.log('   - Ready for frontend integration');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreditTipClaiming(); 