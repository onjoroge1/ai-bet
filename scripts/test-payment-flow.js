const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
});

const prisma = new PrismaClient();

async function testPaymentFlow() {
  console.log('🧪 Testing Payment Flow...\n');

  try {
    // 1. Get a test user
    console.log('1. Getting test user...');
    const user = await prisma.user.findFirst({
      where: { role: 'admin' },
      include: {
        country: {
          select: {
            code: true,
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    });

    if (!user) {
      console.log('❌ No test user found');
      return;
    }

    console.log(`User: ${user.email}`);
    console.log(`Country: ${user.country?.code}`);
    console.log(`Currency: ${user.country?.currencyCode}\n`);

    // 2. Get available packages
    console.log('2. Getting available packages...');
    const packages = await prisma.packageCountryPrice.findMany({
      where: {
        countryId: user.countryId,
        isActive: true
      },
      include: {
        country: true
      },
      take: 1
    });

    if (packages.length === 0) {
      console.log('❌ No packages available for user country');
      return;
    }

    const testPackage = packages[0];
    console.log(`Package: ${testPackage.packageType}`);
    console.log(`Price: ${testPackage.price} ${testPackage.country.currencyCode}\n`);

    // 3. Simulate payment intent creation
    console.log('3. Creating payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(testPackage.price * 100), // Convert to cents
      currency: testPackage.country.currencyCode.toLowerCase(),
      description: `Test Purchase: ${testPackage.packageType} Package`,
      metadata: {
        userId: user.id,
        itemType: 'package',
        itemId: `${user.countryId}_${testPackage.packageType}`,
        userCountry: user.country.code,
        packageName: testPackage.packageType,
        packageType: testPackage.packageType,
        tipCount: 1,
        validityDays: 1
      },
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email,
    });

    console.log(`Payment Intent ID: ${paymentIntent.id}`);
    console.log(`Status: ${paymentIntent.status}`);
    console.log(`Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}\n`);

    // 4. Simulate successful payment
    console.log('4. Simulating successful payment...');
    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: 'pm_card_visa',
    });

    console.log(`Confirmed Status: ${confirmedPaymentIntent.status}\n`);

    // 5. Check if webhook would be triggered
    console.log('5. Checking webhook simulation...');
    const webhookEvent = {
      id: 'evt_test_webhook',
      type: 'payment_intent.succeeded',
      data: {
        object: confirmedPaymentIntent
      }
    };

    console.log(`Webhook Event Type: ${webhookEvent.type}`);
    console.log(`Payment Intent ID: ${webhookEvent.data.object.id}`);
    console.log(`Amount: ${webhookEvent.data.object.amount / 100} ${webhookEvent.data.object.currency}\n`);

    // 6. Simulate webhook processing
    console.log('6. Simulating webhook processing...');
    
    // Check for existing purchase (idempotency)
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId: user.id,
        quickPurchaseId: `${user.countryId}_${testPackage.packageType}`,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
    });

    if (existingPurchase) {
      console.log(`Purchase already exists: ${existingPurchase.id}`);
    } else {
      // Create purchase record
      const purchase = await prisma.purchase.create({
        data: {
          userId: user.id,
          quickPurchaseId: `${user.countryId}_${testPackage.packageType}`,
          amount: testPackage.price,
          paymentMethod: 'stripe',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`Created purchase: ${purchase.id}`);

      // Create user package
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1); // 1 day validity

      const userPackage = await prisma.userPackage.create({
        data: {
          userId: user.id,
          packageOfferId: `${user.countryId}_${testPackage.packageType}`,
          expiresAt,
          tipsRemaining: 1,
          totalTips: 1,
          pricePaid: testPackage.price,
          currencyCode: testPackage.country.currencyCode,
          currencySymbol: testPackage.country.currencySymbol,
          status: 'active'
        }
      });
      console.log(`Created user package: ${userPackage.id}`);
    }

    // 7. Test payment status endpoint
    console.log('\n7. Testing payment status endpoint...');
    const statusResponse = await fetch(`https://www.snapbet.bet/api/payments/status?payment_intent=${paymentIntent.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user.id}`, // This won't work, but let's see the response
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status endpoint response: ${statusResponse.status}`);
    if (statusResponse.status !== 401) { // 401 is expected due to auth
      const statusData = await statusResponse.text();
      console.log(`Response: ${statusData}`);
    }

    console.log('\n✅ Payment flow test complete!');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPaymentFlow(); 