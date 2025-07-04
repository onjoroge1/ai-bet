#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Configuration
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://www.snapbet.bet';
const WEBHOOK_ENDPOINT = `${PRODUCTION_URL}/api/payments/webhook`;
const HEALTH_ENDPOINT = `${PRODUCTION_URL}/api/health`;

console.log('🔍 Production Webhook Diagnostic Tool');
console.log('=====================================\n');

// Test health endpoint
async function testHealth() {
  return new Promise((resolve, reject) => {
    const url = new URL(HEALTH_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Health endpoint is accessible');
          resolve(true);
        } else {
          console.log(`❌ Health endpoint returned status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ Health endpoint error: ${err.message}`);
      resolve(false);
    });
    
    req.setTimeout(10000, () => {
      console.log('❌ Health endpoint timeout');
      req.destroy();
      resolve(false);
    });
  });
}

// Test webhook endpoint
async function testWebhook() {
  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify({ test: true });
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📡 Webhook Response Status: ${res.statusCode}`);
        console.log(`📄 Response Body: ${data}`);
        
        if (res.statusCode === 200) {
          console.log('✅ Webhook endpoint is accessible');
          resolve(true);
        } else {
          console.log(`❌ Webhook endpoint returned status: ${res.statusCode}`);
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

// Check Stripe webhook configuration
function checkStripeWebhook() {
  console.log('\n🔗 Stripe Webhook Configuration Check:');
  console.log('=====================================');
  
  console.log(`🌐 Production URL: ${PRODUCTION_URL}`);
  console.log(`🔗 Webhook Endpoint: ${WEBHOOK_ENDPOINT}`);
  
  console.log('\n📋 Manual Verification Steps:');
  console.log('1. Go to https://dashboard.stripe.com/webhooks');
  console.log('2. Check if webhook endpoint is configured');
  console.log('3. Verify the URL matches:', WEBHOOK_ENDPOINT);
  console.log('4. Check that these events are selected:');
  console.log('   - payment_intent.succeeded');
  console.log('   - payment_intent.payment_failed');
  console.log('   - payment_intent.canceled');
  console.log('5. Copy the webhook secret (starts with whsec_)');
  console.log('6. Add it to your production environment variables');
}

// Main execution
async function runDiagnostic() {
  try {
    console.log('🔍 Testing production server...');
    const healthOk = await testHealth();
    
    if (!healthOk) {
      console.log('\n❌ Production server is not accessible');
      console.log('   Please ensure your application is deployed and running');
      return;
    }
    
    console.log('\n🔍 Testing webhook endpoint...');
    const webhookOk = await testWebhook();
    
    if (webhookOk) {
      console.log('\n✅ Webhook endpoint is working!');
      console.log('\n📋 Next Steps:');
      console.log('1. Configure webhook in Stripe Dashboard');
      console.log('2. Add webhook secret to production environment');
      console.log('3. Test complete payment flow');
    } else {
      console.log('\n❌ Webhook endpoint is not working');
      console.log('   Please check your deployment and configuration');
    }
    
    checkStripeWebhook();
    
  } catch (error) {
    console.log('\n❌ Diagnostic failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  runDiagnostic();
}

module.exports = { testHealth, testWebhook, checkStripeWebhook }; 