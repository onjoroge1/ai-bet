const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixQuickPurchasePrices() {
  console.log('🔧 Fixing QuickPurchase Prices...\n');

  try {
    // 1. Get all QuickPurchase items
    console.log('1. Getting all QuickPurchase items...');
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: { isActive: true },
      include: {
        country: true
      }
    });

    console.log(`Found ${quickPurchases.length} QuickPurchase items to update\n`);

    // 2. Update each item with correct pricing
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of quickPurchases) {
      try {
        // Get the correct pricing from PackageCountryPrice
        const packageType = item.type === 'tip' ? 'prediction' : item.type;
        const countryPricing = await prisma.packageCountryPrice.findUnique({
          where: {
            countryId_packageType: {
              countryId: item.countryId,
              packageType: packageType
            }
          }
        });

        if (countryPricing) {
          const correctPrice = Number(countryPricing.price);
          const currentPrice = Number(item.price);

          if (Math.abs(correctPrice - currentPrice) > 0.01) { // Check if prices are different (accounting for floating point)
            console.log(`📦 ${item.name}`);
            console.log(`   - Current Price: ${item.country?.currencySymbol || '$'}${currentPrice}`);
            console.log(`   - Correct Price: ${item.country?.currencySymbol || '$'}${correctPrice}`);
            
            // Update the QuickPurchase item
            await prisma.quickPurchase.update({
              where: { id: item.id },
              data: { 
                price: correctPrice,
                originalPrice: countryPricing.originalPrice ? Number(countryPricing.originalPrice) : correctPrice
              }
            });
            
            console.log(`   ✅ Updated to ${item.country?.currencySymbol || '$'}${correctPrice}\n`);
            updatedCount++;
          } else {
            console.log(`✅ ${item.name}: Already has correct price (${item.country?.currencySymbol || '$'}${currentPrice})\n`);
            skippedCount++;
          }
        } else {
          console.log(`❌ ${item.name}: No pricing found for ${packageType} in country ${item.country?.name}\n`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating ${item.name}:`, error.message);
        skippedCount++;
      }
    }

    console.log('🎉 Price fix completed!');
    console.log(`- Updated: ${updatedCount} items`);
    console.log(`- Skipped: ${skippedCount} items`);

    // 3. Verify the changes
    console.log('\n3. Verifying changes...');
    const updatedItems = await prisma.quickPurchase.findMany({
      where: { isActive: true },
      include: {
        country: true
      },
      orderBy: { displayOrder: 'asc' }
    });

    console.log('\nUpdated QuickPurchase items:');
    for (const item of updatedItems) {
      console.log(`📦 ${item.name}: ${item.country?.currencySymbol || '$'}${item.price}`);
    }

  } catch (error) {
    console.error('❌ Error fixing prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixQuickPurchasePrices(); 