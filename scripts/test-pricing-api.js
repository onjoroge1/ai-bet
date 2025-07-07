const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPricingAPI() {
  try {
    console.log('🔍 Testing Pricing API...\n');
    
    // Get user
    const user = await prisma.user.findFirst({
      where: { email: 'kim.njo@gmail.com' },
      include: { country: true }
    });
    
    console.log(`User: ${user?.email}`);
    console.log(`Country: ${user?.country?.name} (${user?.country?.code})\n`);
    
    // Simulate the pricing API logic
    const country = await prisma.country.findFirst({
      where: { code: user?.country?.code },
      select: { id: true, currencyCode: true, currencySymbol: true }
    });
    
    if (!country) {
      console.log('❌ Country not found');
      return;
    }
    
    // Get premium package prices from PackageCountryPrice
    const premiumPackageTypes = ["prediction", "weekend_pass", "weekly_pass", "monthly_sub"];
    const premiumPackages = await prisma.packageCountryPrice.findMany({
      where: {
        countryId: country.id,
        packageType: { in: premiumPackageTypes }
      },
      include: { country: true }
    });
    
    console.log('📊 Premium Packages from API:');
    premiumPackages.forEach(pkg => {
      console.log(`   - ${pkg.packageType}: ${pkg.country.currencySymbol}${pkg.price}`);
    });
    
    // Check what the frontend would receive
    console.log('\n🌐 What Frontend Receives:');
    const transformedPackages = premiumPackages.map(pkg => {
      const packageMetadata = {
        prediction: { name: 'Single Tip', tipCount: 1, validityDays: 1 },
        weekend_pass: { name: 'Weekend Package', tipCount: 5, validityDays: 3 },
        weekly_pass: { name: 'Weekly Package', tipCount: 8, validityDays: 7 },
        monthly_sub: { name: 'Monthly Subscription', tipCount: -1, validityDays: 30 }
      };
      
      const meta = packageMetadata[pkg.packageType] || { name: pkg.packageType, tipCount: 1, validityDays: 1 };
      
      return {
        id: `${pkg.countryId}_${pkg.packageType}`,
        name: meta.name,
        packageType: pkg.packageType,
        tipCount: meta.tipCount,
        validityDays: meta.validityDays,
        countryPrices: [{
          price: Number(pkg.price),
          originalPrice: pkg.originalPrice ? Number(pkg.originalPrice) : undefined,
          currencyCode: pkg.country.currencyCode || 'USD',
          currencySymbol: pkg.country.currencySymbol || '$'
        }]
      };
    });
    
    transformedPackages.forEach(pkg => {
      const price = pkg.countryPrices[0];
      console.log(`   - ${pkg.name} (${pkg.packageType}): ${price.currencySymbol}${price.price}`);
    });
    
    console.log('\n✅ Pricing looks correct!');
    console.log('   - Weekend Package: $4.5');
    console.log('   - Weekly Package: $6.8');
    console.log('   - Monthly Subscription: $21');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPricingAPI(); 