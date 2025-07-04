#!/usr/bin/env node

/**
 * Webhook Endpoint Test Script
 * 
 * This script tests the Stripe webhook endpoint to ensure it's working correctly.
 */

const http = require('http');
const crypto = require('crypto');

console.log('🧪 Testing Stripe Webhook Endpoint');
console.log('==================================\n');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  console.log('❌ STRIPE_WEBHOOK_SECRET is not set in .env.local');
  console.log('   Please add it to your environment variables');
  process.exit(1);
}

console.log('✅ Webhook secret is configured');

// Test webhook endpoint
const testWebhook = () => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
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
    });

    // Create signature
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${postData}`;
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    
    const stripeSignature = `t=${timestamp},v1=${signature}`;

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/payments/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Stripe-Signature': stripeSignature
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📡 Response Status: ${res.statusCode}`);
        console.log(`📄 Response Body: ${data}`);
        
        if (res.statusCode === 200) {
          console.log('✅ Webhook endpoint is working correctly!');
          resolve(true);
        } else {
          console.log('❌ Webhook endpoint returned an error');
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Error connecting to webhook endpoint:');
      console.log(`   ${err.message}`);
      console.log('\n💡 Make sure your development server is running:');
      console.log('   npm run dev');
      reject(err);
    });

    req.write(postData);
    req.end();
  });
};

// Test health endpoint first
const testHealth = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Health endpoint is accessible');
        resolve(true);
      } else {
        console.log(`❌ Health endpoint returned ${res.statusCode}`);
        reject(new Error(`Health endpoint returned ${res.statusCode}`));
      }
    });

    req.on('error', (err) => {
      console.log('❌ Cannot connect to development server');
      console.log('   Make sure it\'s running on port 3000');
      reject(err);
    });

    req.end();
  });
};

// Run tests
async function runTests() {
  try {
    console.log('🔍 Testing development server...');
    await testHealth();
    
    console.log('\n🔍 Testing webhook endpoint...');
    await testWebhook();
    
    console.log('\n🎉 All tests passed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Your webhook endpoint is ready at: http://localhost:3000/api/payments/webhook');
    console.log('   2. For production, use: https://yourdomain.com/api/payments/webhook');
    console.log('   3. Add this URL to your Stripe Dashboard webhooks');
    console.log('   4. Copy the webhook secret and add it to your environment variables');
    
  } catch (error) {
    console.log('\n❌ Tests failed:');
    console.log(`   ${error.message}`);
    process.exit(1);
  }
}

runTests(); 