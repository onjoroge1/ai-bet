#!/usr/bin/env node

/**
 * Stripe Configuration Diagnostic Tool
 * 
 * This script helps identify and fix Stripe integration issues in the AI Sports Tipster application.
 * Run this script to diagnose payment flow problems.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Stripe Configuration Diagnostic Tool');
console.log('=====================================\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const envExists = fs.existsSync(envPath);

console.log('📁 Environment File Check:');
console.log(`   .env.local exists: ${envExists ? '✅' : '❌'}`);

if (!envExists) {
  console.log('\n❌ CRITICAL: .env.local file is missing!');
  console.log('   This is the root cause of your Stripe issues.');
  console.log('\n📋 Solution:');
  console.log('   1. Copy env.example to .env.local:');
  console.log('      cp env.example .env.local');
  console.log('   2. Edit .env.local and add your actual Stripe keys');
  console.log('   3. Restart your development server');
  console.log('\n🔑 Required Stripe Keys:');
  console.log('   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (starts with pk_test_)');
  console.log('   - STRIPE_SECRET_KEY (starts with sk_test_)');
  console.log('   - STRIPE_WEBHOOK_SECRET (starts with whsec_)');
  console.log('\n🌐 Get your keys from: https://dashboard.stripe.com/apikeys');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

console.log('\n🔑 Stripe Configuration Check:');
const stripeVars = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY', 
  'STRIPE_WEBHOOK_SECRET'
];

let stripeConfigComplete = true;
stripeVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const displayValue = value ? `${value.substring(0, 15)}...` : 'MISSING';
  console.log(`   ${status} ${varName}: ${displayValue}`);
  if (!value) stripeConfigComplete = false;
});

console.log('\n🔐 Authentication Configuration:');
const authVars = [
  'JWT_SECRET',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET'
];

let authConfigComplete = true;
authVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  console.log(`   ${status} ${varName}: ${value ? 'SET' : 'MISSING'}`);
  if (!value) authConfigComplete = false;
});

console.log('\n🗄️ Database Configuration:');
const dbVars = ['DATABASE_URL'];
dbVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  console.log(`   ${status} ${varName}: ${value ? 'SET' : 'MISSING'}`);
});

// Test Stripe client initialization
console.log('\n🧪 Stripe Client Test:');
try {
  const { loadStripe } = require('@stripe/stripe-js');
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    console.log('   ❌ Cannot test Stripe client - publishable key missing');
  } else if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
    console.log('   ❌ Invalid publishable key format');
  } else {
    const stripePromise = loadStripe(publishableKey);
    console.log('   ✅ Stripe client can be initialized');
  }
} catch (error) {
  console.log(`   ❌ Error testing Stripe client: ${error.message}`);
}

// Test Stripe server initialization
console.log('\n🧪 Stripe Server Test:');
try {
  const Stripe = require('stripe');
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    console.log('   ❌ Cannot test Stripe server - secret key missing');
  } else if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    console.log('   ❌ Invalid secret key format');
  } else {
    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-05-28.basil',
    });
    console.log('   ✅ Stripe server can be initialized');
  }
} catch (error) {
  console.log(`   ❌ Error testing Stripe server: ${error.message}`);
}

// Check if development server is running
console.log('\n🌐 Development Server Check:');
try {
  const http = require('http');
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
  }, (res) => {
    console.log(`   ✅ Development server is running (status: ${res.statusCode})`);
  });
  
  req.on('error', (err) => {
    console.log('   ❌ Development server is not running');
    console.log('      Start it with: npm run dev');
  });
  
  req.on('timeout', () => {
    console.log('   ⚠️  Development server timeout - may not be running');
  });
  
  req.end();
} catch (error) {
  console.log(`   ❌ Error checking development server: ${error.message}`);
}

// Summary and recommendations
console.log('\n📊 Summary:');
if (!stripeConfigComplete) {
  console.log('   ❌ Stripe configuration is incomplete');
  console.log('   🔧 This is causing the PaymentElement not to show inputs');
} else {
  console.log('   ✅ Stripe configuration appears complete');
}

if (!authConfigComplete) {
  console.log('   ❌ Authentication configuration is incomplete');
  console.log('   🔧 This is causing the 401 Unauthorized errors');
} else {
  console.log('   ✅ Authentication configuration appears complete');
}

console.log('\n🔧 Common Issues & Solutions:');
console.log('\n1. PaymentElement not showing inputs:');
console.log('   - Ensure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set');
console.log('   - Check that your Stripe account has the required payment methods enabled');
console.log('   - Verify your domain is added to Stripe Dashboard for Apple Pay/Google Pay');

console.log('\n2. 401 Unauthorized errors:');
console.log('   - Ensure JWT_SECRET, NEXTAUTH_URL, and NEXTAUTH_SECRET are set');
console.log('   - Check that DATABASE_URL is correct and database is accessible');
console.log('   - Verify user authentication is working');

console.log('\n3. Payment intent creation fails:');
console.log('   - Ensure STRIPE_SECRET_KEY is set correctly');
console.log('   - Check that your Stripe account is active and not in test mode (if using live keys)');
console.log('   - Verify the payment method types are enabled in your Stripe account');

console.log('\n4. Webhook issues:');
console.log('   - Ensure STRIPE_WEBHOOK_SECRET is set');
console.log('   - Configure webhook endpoint in Stripe Dashboard');
console.log('   - Use ngrok or similar for local webhook testing');

console.log('\n🚀 Next Steps:');
if (!stripeConfigComplete || !authConfigComplete) {
  console.log('   1. Fix the missing environment variables above');
  console.log('   2. Restart your development server');
  console.log('   3. Test the payment flow again');
} else {
  console.log('   1. Test the payment flow in your browser');
  console.log('   2. Check browser console for any JavaScript errors');
  console.log('   3. Verify Stripe Dashboard for payment method settings');
}

console.log('\n📞 Need Help?');
console.log('   - Stripe Documentation: https://stripe.com/docs');
console.log('   - Stripe Dashboard: https://dashboard.stripe.com');
console.log('   - Check browser console for detailed error messages'); 