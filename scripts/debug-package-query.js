const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPackageQuery() {
  try {
    console.log('🔍 Debugging PackageOffer Query...\n');
    
    // 1. Get a test user
    const user = await prisma.user.findFirst({
      where: { role: 'admin' },
      include: { country: true }
    });
    
    if (!user) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log(`✅ Found user: ${user.email}`);
    console.log(`   - Country: ${user.country?.name} (${user.country?.code})`);
    console.log(`   - Country ID: ${user.countryId}\n`);
    
    // 2. Test the exact query from the API
    const packageOfferId = 'cmckmif810007vbdg9espy8c6'; // Weekend Package ID
    
    console.log(`🔍 Testing PackageOffer query for ID: ${packageOfferId}`);
    
    // First, try without country prices filter
    const packageOfferBasic = await prisma.packageOffer.findUnique({
      where: { id: packageOfferId }
    });
    
    if (packageOfferBasic) {
      console.log('✅ PackageOffer found (basic query)');
      console.log(`   - Name: ${packageOfferBasic.name}`);
      console.log(`   - Package Type: ${packageOfferBasic.packageType}`);
      console.log(`   - Is Active: ${packageOfferBasic.isActive}`);
    } else {
      console.log('❌ PackageOffer NOT found (basic query)');
      return;
    }
    
    // Now test the exact query from the API
    console.log('\n🔍 Testing exact API query...');
    const packageOffer = await prisma.packageOffer.findUnique({
      where: { id: packageOfferId },
      include: {
        countryPrices: {
          where: {
            countryId: user.countryId,
            isActive: true
          }
        }
      }
    });
    
    if (packageOffer) {
      console.log('✅ PackageOffer found (API query)');
      console.log(`   - Name: ${packageOffer.name}`);
      console.log(`   - Package Type: ${packageOffer.packageType}`);
      console.log(`   - Country Prices: ${packageOffer.countryPrices.length}`);
      
      if (packageOffer.countryPrices.length > 0) {
        const price = packageOffer.countryPrices[0];
        console.log(`   - Price: ${price.currencySymbol}${price.price}`);
        console.log(`   - Currency: ${price.currencyCode}`);
      } else {
        console.log('❌ No country prices found!');
      }
    } else {
      console.log('❌ PackageOffer NOT found (API query)');
    }
    
    // 3. Check if the issue is with the country prices filter
    console.log('\n🔍 Checking country prices separately...');
    const countryPrices = await prisma.packageCountryPrice.findMany({
      where: {
        countryId: user.countryId,
        isActive: true
      }
    });
    
    console.log(`Found ${countryPrices.length} country prices for user's country:`);
    countryPrices.forEach(price => {
      console.log(`   - ${price.packageType}: ${price.currencySymbol}${price.price}`);
    });
    
    // 4. Check if there's a specific country price for this package
    console.log('\n🔍 Checking for specific package country price...');
    const specificPrice = await prisma.packageCountryPrice.findFirst({
      where: {
        countryId: user.countryId,
        packageType: packageOfferBasic?.packageType,
        isActive: true
      }
    });
    
    if (specificPrice) {
      console.log('✅ Found specific country price:');
      console.log(`   - Package Type: ${specificPrice.packageType}`);
      console.log(`   - Price: ${specificPrice.currencySymbol}${specificPrice.price}`);
    } else {
      console.log('❌ No specific country price found!');
      console.log(`   Looking for: countryId=${user.countryId}, packageType=${packageOfferBasic?.packageType}`);
    }
    
    // 5. Simulate the API logic
    console.log('\n🔍 Simulating API Logic:');
    
    if (packageOffer) {
      console.log('1. ✅ PackageOffer found by ID');
      
      if (packageOffer.countryPrices.length === 0) {
        console.log('❌ ERROR: No country prices found - this causes the fallback logic!');
        console.log('   The API will try to parse the ID as countryId_packageType format');
        console.log('   Since the ID has no underscores, it will return "Invalid package ID format"');
      } else {
        console.log('✅ Country prices found - payment intent should work');
      }
    } else {
      console.log('❌ PackageOffer not found by ID');
      console.log('   API will try to parse as countryId_packageType format');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPackageQuery(); 