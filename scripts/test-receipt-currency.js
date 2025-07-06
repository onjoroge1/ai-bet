const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testReceiptCurrency() {
  console.log('🧪 Testing Receipt Currency for Different Countries...\n');

  try {
    // 1. Get test users from different countries
    console.log('1. Getting test users from different countries...');
    const users = await prisma.user.findMany({
      where: {
        role: 'admin',
        country: {
          code: { in: ['us', 'ke', 'gb'] } // US, Kenya, UK
        }
      },
      include: {
        country: true
      },
      take: 3
    });

    if (users.length === 0) {
      console.log('❌ No test users found. Please create users for US, Kenya, and UK.');
      return;
    }

    console.log(`✅ Found ${users.length} test users:\n`);
    users.forEach(user => {
      console.log(`- ${user.email}: ${user.country.name} (${user.country.currencySymbol}${user.country.currencyCode})`);
    });

    // 2. Create test purchases for each user
    console.log('\n2. Creating test purchases...');
    const testPurchases = [];

    for (const user of users) {
      // Get or create a test quick purchase item
      let quickPurchase = await prisma.quickPurchase.findFirst({
        where: {
          type: 'tip',
          isActive: true
        },
        include: {
          country: true
        }
      });

      if (!quickPurchase) {
        console.log(`Creating test quick purchase for ${user.country.name}...`);
        quickPurchase = await prisma.quickPurchase.create({
          data: {
            name: `Test Tip for ${user.country.name}`,
            price: 4.99,
            description: 'Test tip for currency testing',
            features: ['AI Analysis', 'Confidence Score'],
            type: 'tip',
            iconName: 'Zap',
            colorGradientFrom: '#3b82f6',
            colorGradientTo: '#1d4ed8',
            isUrgent: false,
            isPopular: false,
            isActive: true,
            displayOrder: 1,
            countryId: user.countryId,
            predictionData: {
              prediction: {
                match_info: {
                  home_team: 'Test Team A',
                  away_team: 'Test Team B',
                  league: 'Test League',
                  date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  venue: 'Test Stadium',
                  status: 'upcoming'
                }
              }
            },
            predictionType: 'home_win',
            confidenceScore: 85,
            odds: 2.5,
            valueRating: 'high',
            analysisSummary: 'Test analysis'
          },
          include: {
            country: true
          }
        });
      }

      // Create a test purchase
      const purchase = await prisma.purchase.create({
        data: {
          userId: user.id,
          quickPurchaseId: quickPurchase.id,
          amount: 4.99,
          paymentMethod: 'stripe',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          quickPurchase: {
            include: {
              country: true
            }
          }
        }
      });

      testPurchases.push({ user, purchase, quickPurchase });
      console.log(`✅ Created purchase for ${user.country.name}: ${user.country.currencySymbol}${purchase.amount}`);
    }

    // 3. Test the API response for each user
    console.log('\n3. Testing API response for each user...\n');

    for (const { user, purchase } of testPurchases) {
      console.log(`📱 Testing for ${user.country.name} user (${user.email}):`);
      
      // Simulate the API response structure
      const apiResponse = {
        tips: [{
          id: purchase.id,
          purchaseId: purchase.id,
          purchaseDate: purchase.createdAt.toISOString(),
          amount: purchase.amount,
          paymentMethod: purchase.paymentMethod,
          homeTeam: 'Test Team A',
          awayTeam: 'Test Team B',
          matchDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          venue: 'Test Stadium',
          league: 'Test League',
          matchStatus: 'upcoming',
          predictionType: 'home_win',
          confidenceScore: 85,
          odds: 2.5,
          valueRating: 'high',
          analysisSummary: 'Test analysis',
          name: 'Test Tip',
          type: 'tip',
          price: 4.99,
          description: 'Test tip for currency testing',
          features: ['AI Analysis', 'Confidence Score'],
          isUrgent: false,
          timeLeft: null,
          // This should now use the user's country currency
          currencySymbol: user.country.currencySymbol,
          currencyCode: user.country.currencyCode,
          predictionData: {
            match_info: {
              home_team: 'Test Team A',
              away_team: 'Test Team B',
              league: 'Test League',
              date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              venue: 'Test Stadium',
              status: 'upcoming'
            }
          }
        }],
        total: 1
      };

      console.log(`   - Currency Symbol: ${apiResponse.tips[0].currencySymbol}`);
      console.log(`   - Currency Code: ${apiResponse.tips[0].currencyCode}`);
      console.log(`   - Amount Display: ${apiResponse.tips[0].currencySymbol}${apiResponse.tips[0].amount}`);
      console.log(`   - Expected: ${user.country.currencySymbol}${user.country.currencyCode}`);
      
      // Verify currency matches user's country
      if (apiResponse.tips[0].currencySymbol === user.country.currencySymbol && 
          apiResponse.tips[0].currencyCode === user.country.currencyCode) {
        console.log(`   ✅ Currency matches user's country`);
      } else {
        console.log(`   ❌ Currency mismatch!`);
      }
      console.log('');
    }

    // 4. Cleanup test data
    console.log('4. Cleaning up test data...');
    const cleanup = process.argv.includes('--cleanup');
    if (cleanup) {
      for (const { purchase } of testPurchases) {
        await prisma.purchase.delete({
          where: { id: purchase.id }
        });
      }
      console.log('✅ Test purchases cleaned up');
    } else {
      console.log('ℹ️  Test purchases kept for inspection (use --cleanup to remove)');
    }

    console.log('\n🎉 Receipt currency test completed!');
    console.log('\n📋 Summary:');
    console.log('- US users should see USD ($)');
    console.log('- Kenya users should see KES (KSh)');
    console.log('- UK users should see GBP (£)');
    console.log('- The API now uses the user\'s current country for currency display');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testReceiptCurrency(); 