const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test data from QuickPurchase records...\n');
    
    // Find test records (Team A, Team B, etc.)
    const testRecords = await prisma.quickPurchase.findMany({
      where: {
        OR: [
          { name: { contains: 'Team A' } },
          { name: { contains: 'Team B' } },
          { name: { contains: 'Team C' } },
          { name: { contains: 'Team D' } },
          { name: { contains: 'Team E' } },
          { name: { contains: 'Team F' } },
          { name: { contains: 'Team G' } },
          { name: { contains: 'Team H' } },
          { name: { contains: 'Test League' } }
        ]
      },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });
    
    console.log(`📊 Found ${testRecords.length} test records:`);
    testRecords.forEach(record => {
      console.log(`   - ${record.name} (${record.id}) - Created: ${record.createdAt}`);
    });
    
    if (testRecords.length > 0) {
      console.log('\n🗑️  Deleting test records...');
      
      const deleteResult = await prisma.quickPurchase.deleteMany({
        where: {
          OR: [
            { name: { contains: 'Team A' } },
            { name: { contains: 'Team B' } },
            { name: { contains: 'Team C' } },
            { name: { contains: 'Team D' } },
            { name: { contains: 'Team E' } },
            { name: { contains: 'Team F' } },
            { name: { contains: 'Team G' } },
            { name: { contains: 'Team H' } },
            { name: { contains: 'Test League' } }
          ]
        }
      });
      
      console.log(`✅ Deleted ${deleteResult.count} test records`);
    } else {
      console.log('✅ No test records found to clean up');
    }
    
    // Check remaining records
    const remainingRecords = await prisma.quickPurchase.count({
      where: {
        isActive: true,
        isPredictionActive: true
      }
    });
    
    console.log(`\n📊 Remaining active QuickPurchase records: ${remainingRecords}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestData();
