const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseState() {
  try {
    console.log('🔍 Checking Database State...\n');
    
    // Check PackageCountryPrice records
    const packagePrices = await prisma.packageCountryPrice.findMany({
      include: { country: true }
    });
    
    console.log(`📊 PackageCountryPrice records (${packagePrices.length}):`);
    packagePrices.forEach(p => {
      console.log(`   - ${p.packageType}: $${p.price} (${p.country.name})`);
    });
    
    // Check PackageOffer records
    const packageOffers = await prisma.packageOffer.findMany({
      include: { countryPrices: true }
    });
    
    console.log(`\n📦 PackageOffer records (${packageOffers.length}):`);
    packageOffers.forEach(p => {
      console.log(`   - ${p.name} (${p.packageType}): ${p.countryPrices.length} country prices`);
    });
    
    // Check PackageOfferCountryPrice records
    const offerPrices = await prisma.packageOfferCountryPrice.findMany({
      include: { country: true, packageOffer: true }
    });
    
    console.log(`\n💰 PackageOfferCountryPrice records (${offerPrices.length}):`);
    offerPrices.forEach(p => {
      console.log(`   - ${p.packageOffer.name}: $${p.price} (${p.country.name})`);
    });
    
    // Check countries
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      take: 5
    });
    
    console.log(`\n🌍 Active Countries (${countries.length}):`);
    countries.forEach(c => {
      console.log(`   - ${c.name} (${c.code}): ${c.currencySymbol}${c.currencyCode}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseState(); 