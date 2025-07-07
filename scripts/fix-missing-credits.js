const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Copied from app/api/payments/webhook/route.ts for consistency
async function addCreditsToUser(userId, userPackage) {
  try {
    let creditsToAdd = 0;
    if (userPackage.totalTips === -1) {
      creditsToAdd = 150; // Unlimited credits for monthly subscription (5 tips/day * 30 days)
    } else {
      creditsToAdd = userPackage.totalTips;
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        predictionCredits: {
          increment: creditsToAdd
        }
      },
      select: {
        id: true,
        email: true,
        predictionCredits: true
      }
    });
    console.log(`Added ${creditsToAdd} credits to user ${updatedUser.email}. New total: ${updatedUser.predictionCredits}`);
    return updatedUser;
  } catch (error) {
    console.error('Error adding credits to user:', error);
    return null;
  }
}

async function fixMissingCredits() {
  try {
    console.log('🔧 Fixing Missing Credits for Existing Package Purchases...\n');
    
    // Get user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      select: { id: true, email: true, predictionCredits: true, countryId: true }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`👤 User: ${user.email}`);
    console.log(`💰 Current Credits: ${user.predictionCredits}`);
    console.log(`🌍 Country ID: ${user.countryId}\n`);
    
    // Find all successful package purchases that don't have corresponding UserPackage records
    const packagePurchases = await prisma.packagePurchase.findMany({
      where: { 
        userId: user.id,
        status: 'completed'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📦 Found ${packagePurchases.length} successful package purchases`);
    
    let processedCount = 0;
    
    for (const purchase of packagePurchases) {
      console.log(`\n🔍 Processing purchase: ${purchase.id}`);
      console.log(`   - Package Type: ${purchase.packageType}`);
      console.log(`   - Amount: $${purchase.amount}`);
      console.log(`   - Date: ${purchase.createdAt.toLocaleDateString()}`);
      
      // Check if UserPackage already exists for this purchase
      const existingUserPackage = await prisma.userPackage.findFirst({
        where: {
          userId: user.id,
          createdAt: {
            gte: new Date(purchase.createdAt.getTime() - 5 * 60 * 1000), // Within 5 minutes
            lte: new Date(purchase.createdAt.getTime() + 5 * 60 * 1000)
          }
        }
      });
      
      if (existingUserPackage) {
        console.log(`   ✅ UserPackage already exists: ${existingUserPackage.id}`);
        continue;
      }
      
      // Calculate credits based on package type
      let tipCount = 1;
      let validityDays = 1;
      let packageName = 'Unknown Package';
      
      switch (purchase.packageType) {
        case 'prediction':
          tipCount = 1;
          validityDays = 1;
          packageName = 'Single Tip';
          break;
        case 'weekend_pass':
          tipCount = 5;
          validityDays = 3;
          packageName = 'Weekend Package';
          break;
        case 'weekly_pass':
          tipCount = 8;
          validityDays = 7;
          packageName = 'Weekly Package';
          break;
        case 'monthly_sub':
          tipCount = -1; // Unlimited
          validityDays = 30;
          packageName = 'Monthly Subscription';
          break;
        default:
          tipCount = 1;
          validityDays = 1;
          packageName = purchase.packageType;
      }
      
      // Find or create a PackageOffer for this package type
      let packageOffer = await prisma.packageOffer.findFirst({
        where: { packageType: purchase.packageType }
      });
      
      if (!packageOffer) {
        // Create a PackageOffer if it doesn't exist
        packageOffer = await prisma.packageOffer.create({
          data: {
            name: packageName,
            packageType: purchase.packageType,
            description: `${packageName} - ${tipCount === -1 ? 'Unlimited' : tipCount} tips`,
            tipCount,
            validityDays,
            isActive: true,
            displayOrder: 1,
            features: [`${tipCount === -1 ? 'Unlimited' : tipCount} tips`, `${validityDays} days validity`],
            iconName: 'Gift',
            colorGradientFrom: '#8B5CF6',
            colorGradientTo: '#EC4899'
          }
        });
        console.log(`   ✅ Created PackageOffer: ${packageOffer.id}`);
      }
      
      // Create UserPackage record
      const expiresAt = new Date(purchase.createdAt);
      expiresAt.setDate(expiresAt.getDate() + validityDays);
      
      const userPackage = await prisma.userPackage.create({
        data: {
          userId: user.id,
          packageOfferId: packageOffer.id,
          tipsRemaining: tipCount === -1 ? -1 : tipCount,
          totalTips: tipCount === -1 ? -1 : tipCount,
          status: 'active',
          expiresAt,
          pricePaid: purchase.amount,
          currencyCode: 'USD', // Default, could be improved
          currencySymbol: '$',
          createdAt: purchase.createdAt,
          updatedAt: purchase.createdAt
        }
      });
      
      console.log(`   ✅ Created UserPackage: ${userPackage.id}`);
      // Use the same logic as the payment flow to add credits
      await addCreditsToUser(user.id, userPackage);
      processedCount++;
    }
    
    // Show final summary
    console.log('\n📊 Final Summary:');
    console.log(`   - Total package purchases: ${packagePurchases.length}`);
    console.log(`   - Packages processed: ${processedCount}`);
    
  } catch (error) {
    console.error('❌ Error fixing missing credits:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingCredits(); 
fixMissingCredits(); 