const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPaymentIntent() {
  console.log('🔍 Debugging Payment Intent Creation...\\n');

  try {
    // 1. Get a test user
    console.log('1. Getting test user...');
    const user = await prisma.user.findFirst({
      where: { role: 'admin' },
      include: {
        country: true
      }
    });

    if (!user) {
      console.log('❌ No admin user found.');
      return;
    }

    console.log(`✅ Found user: ${user.email}`);
    console.log(`   - Country: ${user.country?.name || 'Unknown'} (${user.country?.code || 'N/A'})`);
    console.log(`   - Currency: ${user.country?.currencyCode || 'N/A'}\\n`);

    // 2. Check what package offers exist
    console.log('2. Checking package offers...');
    const packageOffers = await prisma.packageOffer.findMany({
      where: { isActive: true },
      include: {
        countryPrices: {
          where: {
            countryId: user.countryId,
            isActive: true
          }
        }
      }
    });

    console.log(`Found ${packageOffers.length} package offers:`);
    packageOffers.forEach(offer => {
      console.log(`   - ${offer.name} (${offer.packageType})`);
      console.log(`     * ID: ${offer.id}`);
      console.log(`     * Country Prices: ${offer.countryPrices.length}`);
      if (offer.countryPrices.length > 0) {
        const price = offer.countryPrices[0];
        console.log(`     * Price: ${price.currencySymbol}${price.price}`);
      }
    });

    // 3. Check PackageCountryPrice for weekend_pass
    console.log('\\n3. Checking PackageCountryPrice for weekend_pass...');
    const weekendPrice = await prisma.packageCountryPrice.findFirst({
      where: {
        countryId: user.countryId,
        packageType: 'weekend_pass'
      },
      include: {
        country: true
      }
    });

    if (weekendPrice) {
      console.log(`✅ Found weekend_pass pricing:`);
      console.log(`   - Price: ${weekendPrice.currencySymbol}${weekendPrice.price}`);
      console.log(`   - Country: ${weekendPrice.country.name}`);
      console.log(`   - Package Type: ${weekendPrice.packageType}`);
    } else {
      console.log('❌ No weekend_pass pricing found for this country');
    }

    // 4. Test the request payload that would be sent
    console.log('\\n4. Testing request payload...');
    
    // Test with PackageOffer ID
    if (packageOffers.length > 0) {
      const testOffer = packageOffers[0];
      console.log(`\\nTesting with PackageOffer ID: ${testOffer.id}`);
      console.log('Request payload would be:');
      console.log(JSON.stringify({
        itemId: testOffer.id,
        itemType: 'package',
        paymentMethod: 'card'
      }, null, 2));
    }

    // Test with PackageCountryPrice format
    if (weekendPrice) {
      const packageId = `${user.countryId}_weekend_pass`;
      console.log(`\\nTesting with PackageCountryPrice format: ${packageId}`);
      console.log('Request payload would be:');
      console.log(JSON.stringify({
        itemId: packageId,
        itemType: 'package',
        paymentMethod: 'card'
      }, null, 2));
    }

    // 5. Check if user has countryId set
    console.log('\\n5. User country validation:');
    console.log(`   - User countryId: ${user.countryId || 'NOT SET'}`);
    console.log(`   - User country: ${user.country ? 'SET' : 'NOT SET'}`);
    
    if (!user.countryId) {
      console.log('❌ User countryId is not set - this will cause 400 error!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPaymentIntent(); 