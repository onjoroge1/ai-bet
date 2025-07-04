const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
});

const prisma = new PrismaClient();

async function debugPaymentIssue() {
  console.log('🔍 Debugging Payment Issue...\n');

  try {
    // 1. Check recent Stripe payment intents
    console.log('1. Checking recent Stripe payment intents...');
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 5,
      created: {
        gte: Math.floor((Date.now() - 10 * 60 * 1000) / 1000) // Last 10 minutes
      }
    });

    console.log(`Found ${paymentIntents.data.length} recent payment intents:`);
    paymentIntents.data.forEach(intent => {
      console.log(`  - ID: ${intent.id}`);
      console.log(`    Status: ${intent.status}`);
      console.log(`    Amount: ${intent.amount / 100} ${intent.currency}`);
      console.log(`    Metadata:`, intent.metadata);
      console.log(`    Created: ${new Date(intent.created * 1000).toISOString()}`);
      console.log('');
    });

    // 2. Check webhook events
    console.log('2. Checking recent webhook events...');
    const events = await stripe.events.list({
      limit: 10,
      created: {
        gte: Math.floor((Date.now() - 10 * 60 * 1000) / 1000) // Last 10 minutes
      }
    });

    console.log(`Found ${events.data.length} recent webhook events:`);
    events.data.forEach(event => {
      console.log(`  - Type: ${event.type}`);
      console.log(`    ID: ${event.id}`);
      console.log(`    Created: ${new Date(event.created * 1000).toISOString()}`);
      if (event.data.object.id) {
        console.log(`    Object ID: ${event.data.object.id}`);
      }
      console.log('');
    });

    // 3. Check database records
    console.log('3. Checking recent database records...');
    
    // Check purchases
    const recentPurchases = await prisma.purchase.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        }
      },
      include: {
        quickPurchase: true,
        user: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${recentPurchases.length} recent purchases:`);
    recentPurchases.forEach(purchase => {
      console.log(`  - ID: ${purchase.id}`);
      console.log(`    User: ${purchase.user.email}`);
      console.log(`    Amount: ${purchase.amount}`);
      console.log(`    Status: ${purchase.status}`);
      console.log(`    Item: ${purchase.quickPurchase?.name || 'N/A'}`);
      console.log(`    Created: ${purchase.createdAt.toISOString()}`);
      console.log('');
    });

    // Check user packages
    const recentUserPackages = await prisma.userPackage.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        }
      },
      include: {
        user: {
          select: { email: true }
        },
        packageOffer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${recentUserPackages.length} recent user packages:`);
    recentUserPackages.forEach(userPackage => {
      console.log(`  - ID: ${userPackage.id}`);
      console.log(`    User: ${userPackage.user.email}`);
      console.log(`    Package: ${userPackage.packageOffer?.name || userPackage.packageOfferId}`);
      console.log(`    Tips Remaining: ${userPackage.tipsRemaining}`);
      console.log(`    Expires: ${userPackage.expiresAt.toISOString()}`);
      console.log(`    Created: ${userPackage.createdAt.toISOString()}`);
      console.log('');
    });

    // Check user predictions
    const recentUserPredictions = await prisma.userPrediction.findMany({
      where: {
        placedAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        }
      },
      include: {
        user: {
          select: { email: true }
        },
        prediction: true
      },
      orderBy: { placedAt: 'desc' }
    });

    console.log(`Found ${recentUserPredictions.length} recent user predictions:`);
    recentUserPredictions.forEach(userPrediction => {
      console.log(`  - ID: ${userPrediction.id}`);
      console.log(`    User: ${userPrediction.user.email}`);
      console.log(`    Prediction ID: ${userPrediction.predictionId}`);
      console.log(`    Status: ${userPrediction.status}`);
      console.log(`    Placed: ${userPrediction.placedAt.toISOString()}`);
      console.log('');
    });

    // 4. Check webhook endpoint accessibility
    console.log('4. Testing webhook endpoint...');
    try {
      const response = await fetch('https://www.snapbet.bet/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test-signature'
        },
        body: JSON.stringify({ test: true })
      });
      console.log(`Webhook endpoint status: ${response.status}`);
      console.log(`Webhook endpoint accessible: ${response.status !== 404}`);
    } catch (error) {
      console.log(`Webhook endpoint error: ${error.message}`);
    }

    console.log('\n✅ Debug complete!');

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug script
debugPaymentIssue(); 