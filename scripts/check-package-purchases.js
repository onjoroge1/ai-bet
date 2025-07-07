const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPackagePurchases() {
  try {
    console.log('🔍 Checking PackagePurchase records...\n');
    
    const count = await prisma.packagePurchase.count();
    console.log(`📊 Total PackagePurchase records: ${count}`);
    
    if (count > 0) {
      const purchases = await prisma.packagePurchase.findMany({
        take: 5,
        include: {
          user: {
            select: { email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('\n📋 Recent PackagePurchase records:');
      purchases.forEach((purchase, index) => {
        console.log(`${index + 1}. ${purchase.user.email}`);
        console.log(`   - Amount: $${purchase.amount}`);
        console.log(`   - Package Type: ${purchase.packageType}`);
        console.log(`   - Status: ${purchase.status}`);
        console.log(`   - Created: ${purchase.createdAt.toLocaleDateString()}`);
        console.log('');
      });
    } else {
      console.log('📝 No PackagePurchase records found yet.');
      console.log('   This is normal - the table is ready for package purchases!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPackagePurchases(); 