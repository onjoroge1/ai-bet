const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPackageOffers() {
  try {
    console.log('🔍 Checking PackageOffer IDs...\n');
    
    const offers = await prisma.packageOffer.findMany({ 
      take: 5,
      include: {
        countryPrices: {
          take: 1
        }
      }
    });
    
    console.log(`Found ${offers.length} PackageOffer items:\n`);
    
    offers.forEach((offer, index) => {
      console.log(`${index + 1}. ${offer.name}`);
      console.log(`   - ID: ${offer.id}`);
      console.log(`   - Package Type: ${offer.packageType}`);
      console.log(`   - Has Country Prices: ${offer.countryPrices.length > 0}`);
      console.log(`   - Is Active: ${offer.isActive}`);
      console.log('');
    });
    
    // Check if any IDs contain underscores (which would cause parsing issues)
    const idsWithUnderscores = offers.filter(o => o.id.includes('_'));
    if (idsWithUnderscores.length > 0) {
      console.log('⚠️  WARNING: Found PackageOffer IDs with underscores:');
      idsWithUnderscores.forEach(o => {
        console.log(`   - ${o.name}: ${o.id}`);
      });
      console.log('\nThis will cause issues with the payment intent API parsing!');
    } else {
      console.log('✅ All PackageOffer IDs are clean (no underscores)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPackageOffers(); 