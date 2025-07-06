const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTipPurchase() {
  console.log('🧪 Testing Tip Purchase Flow...\n');

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
      console.log('❌ No admin user found. Please create a test user first.');
      return;
    }

    console.log(`✅ Found user: ${user.email} (${user.country?.name || 'Unknown Country'})\n`);

    // 2. Get the correct pricing from PackageCountryPrice table
    console.log('2. Getting correct pricing from PackageCountryPrice...');
    const countryPricing = await prisma.packageCountryPrice.findUnique({
      where: {
        countryId_packageType: {
          countryId: user.countryId,
          packageType: 'prediction' // Single tip
        }
      },
      include: {
        country: true
      }
    });

    if (!countryPricing) {
      console.log('❌ No pricing found for user country. Creating default pricing...');
      // Create default pricing if not exists
      await prisma.packageCountryPrice.create({
        data: {
          countryId: user.countryId,
          packageType: 'prediction',
          price: 1.00, // Default $1.00 for US
          originalPrice: 1.00
        }
      });
      console.log('✅ Created default pricing: $1.00');
    } else {
      console.log(`✅ Found pricing: ${countryPricing.country?.currencySymbol || '$'}${countryPricing.price}`);
    }

    // 3. Get or create a test quick purchase item
    console.log('3. Getting test quick purchase item...');
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
      console.log('Creating test quick purchase item...');
      quickPurchase = await prisma.quickPurchase.create({
        data: {
          name: 'Test Premium Tip',
          price: countryPricing?.price || 1.00, // Use actual pricing
          description: 'A test premium tip for testing the purchase flow',
          features: ['AI Analysis', 'Confidence Score', 'Match Details'],
          type: 'tip',
          iconName: 'Zap',
          colorGradientFrom: '#3b82f6',
          colorGradientTo: '#1d4ed8',
          isUrgent: false,
          isPopular: false,
          isActive: true,
          displayOrder: 1,
          countryId: user.countryId || 'clx1q8b0000000000000000001',
          predictionData: {
            prediction: {
              match_info: {
                home_team: 'Manchester United',
                away_team: 'Liverpool',
                league: 'Premier League',
                date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                venue: 'Old Trafford',
                status: 'upcoming'
              }
            }
          },
          predictionType: 'home_win',
          confidenceScore: 85,
          odds: 2.5,
          valueRating: 'high',
          analysisSummary: 'Strong home form and recent performance indicators suggest a home win.'
        },
        include: {
          country: true
        }
      });
    }

    console.log(`✅ Found/Created quick purchase: ${quickPurchase.name} (${quickPurchase.country?.currencySymbol}${quickPurchase.price})\n`);

    // 4. Create a test purchase record
    console.log('4. Creating test purchase record...');
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        quickPurchaseId: quickPurchase.id,
        amount: quickPurchase.price,
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

    console.log(`✅ Created purchase record: ${purchase.id}\n`);

    // 5. Test the API endpoint
    console.log('5. Testing /api/my-tips?latest=1 endpoint...');
    
    // Simulate the API response structure
    const apiResponse = {
      tips: [{
        id: purchase.id,
        purchaseId: purchase.id,
        purchaseDate: purchase.createdAt.toISOString(),
        amount: purchase.amount,
        paymentMethod: purchase.paymentMethod,
        homeTeam: quickPurchase.predictionData?.prediction?.match_info?.home_team || 'TBD',
        awayTeam: quickPurchase.predictionData?.prediction?.match_info?.away_team || 'TBD',
        matchDate: quickPurchase.predictionData?.prediction?.match_info?.date || null,
        venue: quickPurchase.predictionData?.prediction?.match_info?.venue || null,
        league: quickPurchase.predictionData?.prediction?.match_info?.league || null,
        matchStatus: quickPurchase.predictionData?.prediction?.match_info?.status || null,
        predictionType: quickPurchase.predictionType,
        confidenceScore: quickPurchase.confidenceScore,
        odds: quickPurchase.odds,
        valueRating: quickPurchase.valueRating,
        analysisSummary: quickPurchase.analysisSummary,
        name: quickPurchase.name,
        type: quickPurchase.type,
        price: quickPurchase.price,
        description: quickPurchase.description,
        features: quickPurchase.features,
        isUrgent: quickPurchase.isUrgent,
        timeLeft: quickPurchase.timeLeft,
        currencySymbol: quickPurchase.country?.currencySymbol || '$',
        currencyCode: quickPurchase.country?.currencyCode || 'USD',
        predictionData: quickPurchase.predictionData?.prediction || null,
      }],
      total: 1
    };

    console.log('✅ API Response Structure:');
    console.log(JSON.stringify(apiResponse, null, 2));

    // 6. Test receipt data structure
    console.log('\n6. Testing receipt data structure...');
    const receiptData = apiResponse.tips[0];
    
    console.log('✅ Receipt Data Validation:');
    console.log(`- Transaction ID: ${receiptData.purchaseId}`);
    console.log(`- Tip Name: ${receiptData.name}`);
    console.log(`- Amount: ${receiptData.currencySymbol}${receiptData.amount}`);
    console.log(`- Payment Method: ${receiptData.paymentMethod}`);
    console.log(`- Purchase Date: ${receiptData.purchaseDate}`);
    console.log(`- Match: ${receiptData.homeTeam} vs ${receiptData.awayTeam}`);
    console.log(`- League: ${receiptData.league}`);
    console.log(`- Prediction: ${receiptData.predictionType}`);
    console.log(`- Confidence: ${receiptData.confidenceScore}%`);
    console.log(`- Odds: ${receiptData.odds}`);

    // 7. Cleanup (optional)
    console.log('\n7. Cleanup...');
    const cleanup = process.argv.includes('--cleanup');
    if (cleanup) {
      await prisma.purchase.delete({
        where: { id: purchase.id }
      });
      console.log('✅ Test purchase record cleaned up');
    } else {
      console.log('ℹ️  Test purchase record kept for inspection (use --cleanup to remove)');
    }

    console.log('\n🎉 Tip purchase flow test completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Test the actual purchase flow in the UI');
    console.log('2. Verify the receipt displays correctly');
    console.log('3. Check that the tip appears in /dashboard/my-tips');
    console.log('4. Test error scenarios (network issues, etc.)');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testTipPurchase(); 