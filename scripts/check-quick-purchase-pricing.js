const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkQuickPurchasePricing() {
  console.log('🔍 Checking QuickPurchase Pricing...\n');

  try {
    // 1. Get all QuickPurchase items
    console.log('1. Getting all QuickPurchase items...');
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: { isActive: true },
      include: {
        country: true
      },
      orderBy: { displayOrder: 'asc' }
    });

    console.log(`Found ${quickPurchases.length} active QuickPurchase items:\n`);

    // 2. Check pricing for each item
    for (const item of quickPurchases) {
      console.log(`📦 ${item.name}`);
      console.log(`   - Type: ${item.type}`);
      console.log(`   - Stored Price: ${item.country?.currencySymbol || '$'}${item.price}`);
      console.log(`   - Country: ${item.country?.name || 'Unknown'}`);
      console.log(`   - Display Order: ${item.displayOrder}`);
      console.log(`   - Is Urgent: ${item.isUrgent}`);
      console.log(`   - Is Popular: ${item.isPopular}`);
      console.log('');
    }

    // 3. Check PackageCountryPrice for US
    console.log('2. Checking PackageCountryPrice for US...');
    const usCountry = await prisma.country.findUnique({
      where: { code: 'us' }
    });

    if (usCountry) {
      const usPricing = await prisma.packageCountryPrice.findMany({
        where: { countryId: usCountry.id },
        include: { country: true }
      });

      console.log(`Found ${usPricing.length} pricing entries for US:\n`);
      
      for (const pricing of usPricing) {
        console.log(`💰 ${pricing.packageType.toUpperCase()}`);
        console.log(`   - Price: ${pricing.country?.currencySymbol || '$'}${pricing.price}`);
        console.log(`   - Original Price: ${pricing.country?.currencySymbol || '$'}${pricing.originalPrice || pricing.price}`);
        console.log('');
      }
    }

    // 4. Test the QuickPurchase API pricing
    console.log('3. Testing QuickPurchase API pricing...');
    
    // Get a test user
    const user = await prisma.user.findFirst({
      where: { role: 'admin' },
      include: { country: true }
    });

    if (user) {
      console.log(`Using test user: ${user.email} (${user.country?.name})`);
      
      // Simulate what the API would return
      for (const item of quickPurchases) {
        try {
          const packageType = item.type === 'tip' ? 'prediction' : item.type;
          const countryPricing = await prisma.packageCountryPrice.findUnique({
            where: {
              countryId_packageType: {
                countryId: user.countryId,
                packageType: packageType
              }
            }
          });

          if (countryPricing) {
            console.log(`✅ ${item.name}: ${user.country?.currencySymbol || '$'}${countryPricing.price} (API price)`);
          } else {
            console.log(`❌ ${item.name}: No pricing found for ${packageType}`);
          }
        } catch (error) {
          console.log(`❌ ${item.name}: Error getting pricing - ${error.message}`);
        }
      }
    }

    console.log('\n🎉 Pricing check completed!');

  } catch (error) {
    console.error('❌ Error checking pricing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkQuickPurchasePricing(); 