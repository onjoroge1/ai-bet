const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Checking Database Contents...\n');
    
    // Check countries
    const countries = await prisma.country.count();
    console.log(`✅ Countries: ${countries}`);
    
    // Check package pricing
    const packagePrices = await prisma.packageCountryPrice.count();
    console.log(`✅ PackageCountryPrice records: ${packagePrices}`);
    
    // Check users
    const users = await prisma.user.count();
    console.log(`✅ Users: ${users}`);
    
    // Check PackageOffer records
    const packageOffers = await prisma.packageOffer.count();
    console.log(`✅ PackageOffer records: ${packageOffers}`);
    
    // Check PackageOfferCountryPrice records
    const packageOfferPrices = await prisma.packageOfferCountryPrice.count();
    console.log(`✅ PackageOfferCountryPrice records: ${packageOfferPrices}`);
    
    // Check QuickPurchase records
    const quickPurchases = await prisma.quickPurchase.count();
    console.log(`✅ QuickPurchase records: ${quickPurchases}`);
    
    // Show some sample data
    console.log('\n📊 Sample Data:');
    
    const sampleCountry = await prisma.country.findFirst();
    if (sampleCountry) {
      console.log(`   Sample Country: ${sampleCountry.name} (${sampleCountry.code})`);
    }
    
    const samplePackagePrice = await prisma.packageCountryPrice.findFirst({
      include: { country: true }
    });
    if (samplePackagePrice) {
      console.log(`   Sample Package Price: ${samplePackagePrice.country.currencySymbol}${samplePackagePrice.price} for ${samplePackagePrice.packageType}`);
    }
    
    const sampleUser = await prisma.user.findFirst();
    if (sampleUser) {
      console.log(`   Sample User: ${sampleUser.email}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase(); 