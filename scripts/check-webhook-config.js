const crypto = require('crypto');

async function checkWebhookConfig() {
  console.log('🔐 Checking Webhook Configuration...\n');

  try {
    // 1. Check if webhook secret exists
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.log('❌ STRIPE_WEBHOOK_SECRET not found in environment variables');
      console.log('Please check your .env file or environment variables');
      return;
    }

    console.log(`✅ Webhook Secret found: ${webhookSecret.substring(0, 10)}...`);
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

    // 4. Test webhook endpoint
    console.log('4. Testing webhook endpoint...');
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
        console.log(`✅ Webhook endpoint responded successfully!`);
        console.log(`Response: ${responseData}`);
      } else {
        console.log(`❌ Webhook endpoint error: ${response.status} ${response.statusText}`);
        const errorData = await response.text();
        console.log(`Error details: ${errorData}`);
      }
    } catch (error) {
      console.log(`❌ Webhook endpoint error: ${error.message}`);
    }

    // 5. Check webhook endpoint without signature (should fail)
    console.log('\n5. Testing webhook endpoint without signature (should fail)...');
    try {
      const response = await fetch('https://www.snapbet.bet/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true })
      });

      console.log(`Response Status: ${response.status}`);
      if (response.status === 400) {
        console.log(`✅ Webhook endpoint correctly rejected request without signature`);
      } else {
        console.log(`⚠️ Unexpected response: ${response.status}`);
      }
    } catch (error) {
      console.log(`Webhook endpoint error: ${error.message}`);
    }

    console.log('\n✅ Webhook configuration check complete!');

  } catch (error) {
    console.error('❌ Check error:', error);
  }
}

// Run the check
checkWebhookConfig(); 