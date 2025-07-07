const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCurrentPricing() {
  try {
    console.log('🔍 Checking Current Pricing for US User...\n');
    
    // Get user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      include: { country: true }
    });
    
    console.log(`User: ${user?.email}`);
    console.log(`Country: ${user?.country?.name} (${user?.country?.code})\n`);
    
    // Check PackageCountryPrice records for this user's country
    const prices = await prisma.packageCountryPrice.findMany({
      where: { countryId: user?.countryId },
      include: { country: true }
    });
    
    console.log('📊 PackageCountryPrice records for US:');
    prices.forEach(p => {
      console.log(`   - ${p.packageType}: ${p.country.currencySymbol}${p.price}`);
    });
    
    // Check PackageOffer records
    const offers = await prisma.packageOffer.findMany({
      include: {
        countryPrices: {
          where: { countryId: user?.countryId }
        }
      }
    });
    
    console.log('\n📦 PackageOffer records for US:');
    offers.forEach(offer => {
      if (offer.countryPrices.length > 0) {
        const price = offer.countryPrices[0];
        console.log(`   - ${offer.name} (${offer.packageType}): ${price.currencySymbol}${price.price}`);
      }
    });
    
    console.log('\n💡 Summary:');
    console.log('   - PackageCountryPrice uses: weekend_pass, weekly_pass, monthly_sub');
    console.log('   - PackageOffer uses: weekend, weekly, monthly');
    console.log('   - Frontend API uses: PackageCountryPrice (correct)');
    console.log('   - Frontend components should use: /api/homepage/pricing endpoint');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentPricing(); 