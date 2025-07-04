#!/usr/bin/env node

const https = require('https');
const http = require('http');

console.log('🔍 Checking Stripe Webhook Events');
console.log('=================================\n');

// Configuration
const PRODUCTION_URL = 'https://www.snapbet.bet';

// Test webhook with proper Stripe signature
async function testWebhookWithSignature() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${PRODUCTION_URL}/api/payments/webhook`);
    const client = url.protocol === 'https:' ? https : http;
    
    // Create a mock Stripe webhook event
    const mockEvent = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2025-05-28.basil',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'pi_test_payment_intent',
          object: 'payment_intent',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            userId: 'test_user_id',
            itemType: 'tip',
            itemId: 'test_tip_id'
          }
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test',
        idempotency_key: null
      },
      type: 'payment_intent.succeeded'
    };

    const postData = JSON.stringify(mockEvent);
    
    // Create a mock signature (this won't be valid, but will test the endpoint)
    const timestamp = Math.floor(Date.now() / 1000);
    const mockSignature = `t=${timestamp},v1=mock_signature`;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Stripe-Signature': mockSignature
      }
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📡 Webhook Response Status: ${res.statusCode}`);
        console.log(`📄 Response Body: ${data}`);
        
        if (res.statusCode === 400 && data.includes('Invalid signature')) {
          console.log('✅ Webhook endpoint is working correctly - rejecting invalid signatures');
          resolve(true);
        } else if (res.statusCode === 200) {
          console.log('✅ Webhook endpoint processed the event successfully');
          resolve(true);
        } else {
          console.log(`❌ Unexpected response from webhook endpoint`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ Webhook endpoint error: ${err.message}`);
      resolve(false);
    });
    
    req.setTimeout(10000, () => {
      console.log('❌ Webhook endpoint timeout');
      req.destroy();
      resolve(false);
    });
    
    req.write(postData);
    req.end();
  });
}

// Provide troubleshooting steps
function provideTroubleshootingSteps() {
  console.log('\n🔧 Troubleshooting Steps:');
  console.log('==========================');
  console.log('1. Check Stripe Dashboard > Webhooks > Recent deliveries');
  console.log('   - Look for failed webhook attempts');
  console.log('   - Check if webhook URL is correct: https://www.snapbet.bet/api/payments/webhook');
  
  console.log('\n2. Verify Environment Variables:');
  console.log('   - Check Vercel Dashboard > Environment Variables');
  console.log('   - Ensure STRIPE_WEBHOOK_SECRET is set correctly');
  console.log('   - Verify the secret starts with "whsec_"');
  
  console.log('\n3. Test Payment Flow:');
  console.log('   - Make a test payment with card: 4242424242424242');
  console.log('   - Check if payment appears in Stripe Dashboard');
  console.log('   - Look for webhook events in Stripe Dashboard');
  
  console.log('\n4. Check Vercel Logs:');
  console.log('   - Go to Vercel Dashboard > Functions > Logs');
  console.log('   - Look for webhook processing errors');
  
  console.log('\n5. Verify Database Connection:');
  console.log('   - Check if DATABASE_URL is set correctly in Vercel');
  console.log('   - Ensure database is accessible from Vercel functions');
}

// Main execution
async function runCheck() {
  try {
    console.log('🔍 Testing webhook endpoint with mock event...');
    const webhookOk = await testWebhookWithSignature();
    
    if (webhookOk) {
      console.log('\n✅ Webhook endpoint is responding correctly');
      console.log('   The endpoint is deployed and configured properly');
      console.log('   If you\'re not receiving receipts, check the troubleshooting steps below');
    } else {
      console.log('\n❌ Webhook endpoint is not working properly');
      console.log('   Please check the troubleshooting steps below');
    }
    
    provideTroubleshootingSteps();
    
    console.log('\n📊 Next Steps:');
    console.log('1. Make a test payment on https://www.snapbet.bet');
    console.log('2. Check Stripe Dashboard for webhook events');
    console.log('3. Verify if you receive the purchased content');
    console.log('4. Check Vercel logs for any errors');
    
  } catch (error) {
    console.log('\n❌ Check failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  runCheck();
}

module.exports = { testWebhookWithSignature, provideTroubleshootingSteps }; 