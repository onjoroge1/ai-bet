const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPackagePurchaseTable() {
  try {
    console.log('🔍 Checking PackagePurchase table...\n');
    
    // Try to query the PackagePurchase table
    const result = await prisma.packagePurchase.findMany({ 
      take: 1,
      include: {
        user: {
          select: { email: true }
        }
      }
    });
    
    console.log('✅ PackagePurchase table exists and is accessible');
    console.log(`Found ${result.length} records`);
    
    if (result.length > 0) {
      const purchase = result[0];
      console.log('\n📊 Sample PackagePurchase record:');
      console.log(`   - ID: ${purchase.id}`);
      console.log(`   - User: ${purchase.user.email}`);
      console.log(`   - Amount: $${purchase.amount}`);
      console.log(`   - Status: ${purchase.status}`);
      console.log(`   - Package Type: ${purchase.packageType}`);
      console.log(`   - Created: ${purchase.createdAt}`);
    }
    
    // Check the table structure
    console.log('\n📋 PackagePurchase table structure:');
    console.log('   - id: String (UUID)');
    console.log('   - userId: String');
    console.log('   - amount: Decimal');
    console.log('   - paymentMethod: String');
    console.log('   - status: String');
    console.log('   - packageOfferId: String? (optional)');
    console.log('   - packageType: String');
    console.log('   - countryId: String? (optional)');
    console.log('   - createdAt: DateTime');
    console.log('   - updatedAt: DateTime');
    
  } catch (error) {
    console.error('❌ PackagePurchase table error:', error.message);
    console.log('\n💡 This might mean:');
    console.log('   1. The table doesn\'t exist');
    console.log('   2. The migration hasn\'t been applied');
    console.log('   3. There\'s a schema mismatch');
  } finally {
    await prisma.$disconnect();
  }
}

checkPackagePurchaseTable(); 