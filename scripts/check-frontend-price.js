const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFrontendPrice() {
  try {
    console.log('🔍 Checking Frontend vs Database Pricing...\n');
    
    // Get user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      include: { country: true }
    });
    
    console.log(`User: ${user?.email}`);
    console.log(`Country: ${user?.country?.name} (${user?.countryId})\n`);
    
    // Check PackageCountryPrice (what the API uses)
    const packageCountryPrice = await prisma.packageCountryPrice.findFirst({
      where: {
        countryId: user?.countryId,
        packageType: 'weekly_pass'
      }
    });
    
    console.log('📊 PackageCountryPrice (API/Backend):');
    if (packageCountryPrice) {
      console.log(`   - Price: $${packageCountryPrice.price}`);
      console.log(`   - Original Price: $${packageCountryPrice.originalPrice || 'N/A'}`);
      console.log(`   - Package Type: ${packageCountryPrice.packageType}`);
    } else {
      console.log('   ❌ Not found');
    }
    
    // Check PackageOffer (what the frontend might be using)
    const packageOffers = await prisma.packageOffer.findMany({
      where: { packageType: 'weekly' },
      include: {
        countryPrices: {
          where: { countryId: user?.countryId }
        }
      }
    });
    
    console.log('\n📊 PackageOffer (Frontend):');
    if (packageOffers.length > 0) {
      const offer = packageOffers[0];
      console.log(`   - Name: ${offer.name}`);
      console.log(`   - Package Type: ${offer.packageType}`);
      console.log(`   - Country Prices: ${offer.countryPrices.length}`);
      
      if (offer.countryPrices.length > 0) {
        const countryPrice = offer.countryPrices[0];
        console.log(`   - Price: $${countryPrice.price}`);
        console.log(`   - Original Price: $${countryPrice.originalPrice || 'N/A'}`);
        console.log(`   - Currency: ${countryPrice.currencyCode}`);
      }
    } else {
      console.log('   ❌ No weekly package offers found');
    }
    
    // Check what the frontend API returns
    console.log('\n🌐 Frontend API (/api/homepage/pricing):');
    try {
      const response = await fetch(`http://localhost:3000/api/homepage/pricing?country=${user?.country?.code}`);
      if (response.ok) {
        const data = await response.json();
        const weeklyPackage = data.plans.find((plan) => 
          plan.packageType === 'weekly_pass' || plan.name?.includes('Weekly')
        );
        
        if (weeklyPackage) {
          console.log(`   - Name: ${weeklyPackage.name}`);
          console.log(`   - Price: ${weeklyPackage.countryPrices?.[0]?.price || 'N/A'}`);
          console.log(`   - Original Price: ${weeklyPackage.countryPrices?.[0]?.originalPrice || 'N/A'}`);
        } else {
          console.log('   ❌ Weekly package not found in API response');
        }
      } else {
        console.log(`   ❌ API error: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ API error: ${error.message}`);
    }
    
    console.log('\n💡 Summary:');
    if (packageCountryPrice && packageOffers.length > 0) {
      const apiPrice = packageCountryPrice.price;
      const frontendPrice = packageOffers[0].countryPrices[0]?.price;
      
      if (apiPrice === frontendPrice) {
        console.log('   ✅ Frontend and API prices match');
      } else {
        console.log('   ❌ Frontend and API prices do NOT match!');
        console.log(`      API: $${apiPrice}`);
        console.log(`      Frontend: $${frontendPrice}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFrontendPrice(); 