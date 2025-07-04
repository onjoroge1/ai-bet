#!/usr/bin/env node

const https = require('https');
const http = require('http');

console.log('🔍 Webhook Event Debug Tool');
console.log('============================\n');

// Configuration
const PRODUCTION_URL = 'https://www.snapbet.bet';
const WEBHOOK_ENDPOINT = `${PRODUCTION_URL}/api/payments/webhook`;

console.log(`🌐 Testing webhook endpoint: ${WEBHOOK_ENDPOINT}\n`);

// Test 1: Check if webhook endpoint is accessible
async function testWebhookEndpoint() {
  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;
    
    const testPayload = JSON.stringify({
      test: true,
      message: 'This is a test webhook call'
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testPayload),
        'User-Agent': 'Webhook-Debug-Tool/1.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ Webhook endpoint is accessible (Status: ${res.statusCode})`);
        console.log(`📝 Response: ${data}\n`);
        resolve(true);
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Webhook endpoint error: ${error.message}\n`);
      reject(error);
    });

    req.write(testPayload);
    req.end();
  });
}

// Test 2: Check Stripe Dashboard for actual events
function checkStripeDashboard() {
  console.log('📊 Stripe Dashboard Check Instructions:');
  console.log('=====================================');
  console.log('1. Go to: https://dashboard.stripe.com/webhooks');
  console.log('2. Click on your webhook endpoint: we_1RhBTxPIROxmSIgQ3HCqbeW8');
  console.log('3. Click on "Events" tab');
  console.log('4. Look for recent payment_intent.succeeded events');
  console.log('5. If no events, the webhook is not receiving events from Stripe\n');
}

// Test 3: Check if payment was actually created in Stripe
function checkStripePayments() {
  console.log('💳 Stripe Payments Check Instructions:');
  console.log('=====================================');
  console.log('1. Go to: https://dashboard.stripe.com/payments');
  console.log('2. Look for your test payment');
  console.log('3. Check if the payment status is "Succeeded"');
  console.log('4. If payment succeeded but no webhook, there\'s a webhook delivery issue\n');
}

// Test 4: Check your database for purchase records
function checkDatabaseInstructions() {
  console.log('🗄️ Database Check Instructions:');
  console.log('===============================');
  console.log('1. Check your database for recent Purchase records');
  console.log('2. Check for recent UserPackage records');
  console.log('3. Check for recent UserPrediction records');
  console.log('4. If no records, the webhook is not processing events\n');
}

// Main execution
async function runDebug() {
  try {
    console.log('🔍 Starting webhook debug...\n');
    
    // Test webhook endpoint accessibility
    await testWebhookEndpoint();
    
    // Provide manual check instructions
    checkStripeDashboard();
    checkStripePayments();
    checkDatabaseInstructions();
    
    console.log('🎯 Next Steps:');
    console.log('==============');
    console.log('1. Make another test payment');
    console.log('2. Check Stripe Dashboard for webhook events');
    console.log('3. Check your database for purchase records');
    console.log('4. If webhook events exist but no database records, check webhook processing');
    console.log('5. If no webhook events, check webhook configuration\n');
    
  } catch (error) {
    console.log('❌ Debug failed:', error.message);
  }
}

runDebug(); 