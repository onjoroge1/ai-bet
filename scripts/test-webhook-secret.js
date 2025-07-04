const Stripe = require('stripe');
const crypto = require('crypto');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
});

async function testWebhookSecret() {
  console.log('🔐 Testing Webhook Secret...\n');

  try {
    // 1. Get the webhook secret from environment
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.log('❌ STRIPE_WEBHOOK_SECRET not found in environment variables');
      return;
    }

    console.log(`Webhook Secret: ${webhookSecret.substring(0, 10)}...`);
    console.log(`Secret Length: ${webhookSecret.length} characters\n`);

    // 2. Create a test webhook event
    const testEvent = {
      id: 'evt_test_webhook',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_3RhGJqLLisuUIvsO0MQIJJXw',
          status: 'succeeded',
          amount: 999,
          currency: 'usd',
          metadata: {
            userId: 'test-user-id',
            itemType: 'tip',
            itemId: 'test-item-id'
          }
        }
      }
    };

    // 3. Create a test signature
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify(testEvent);
    const signedPayload = `${timestamp}.${payload}`;
    
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    
    const stripeSignature = `t=${timestamp},v1=${signature}`;

    console.log('Test Event Details:');
    console.log(`  Event Type: ${testEvent.type}`);
    console.log(`  Payment Intent ID: ${testEvent.data.object.id}`);
    console.log(`  Status: ${testEvent.data.object.status}`);
    console.log(`  Amount: ${testEvent.data.object.amount / 100} ${testEvent.data.object.currency}`);
    console.log(`  Metadata:`, testEvent.data.object.metadata);
    console.log('');

    // 4. Test signature verification
    try {
      const verifiedEvent = stripe.webhooks.constructEvent(
        Buffer.from(payload),
        stripeSignature,
        webhookSecret
      );
      console.log('✅ Webhook signature verification successful!');
      console.log(`Verified Event ID: ${verifiedEvent.id}`);
      console.log(`Verified Event Type: ${verifiedEvent.type}`);
    } catch (error) {
      console.log('❌ Webhook signature verification failed!');
      console.log(`Error: ${error.message}`);
    }

    // 5. Test webhook endpoint with valid signature
    console.log('\n5. Testing webhook endpoint with valid signature...');
    try {
      const response = await fetch('https://www.snapbet.bet/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': stripeSignature
        },
        body: payload
      });

      console.log(`Response Status: ${response.status}`);
      if (response.status === 200) {
        const responseData = await response.text();
        console.log(`Response: ${responseData}`);
      } else {
        console.log(`Error Response: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`Webhook endpoint error: ${error.message}`);
    }

    console.log('\n✅ Webhook secret test complete!');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testWebhookSecret(); 