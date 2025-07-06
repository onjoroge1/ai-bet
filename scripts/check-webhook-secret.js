const crypto = require('crypto');

function checkWebhookSecret() {
  console.log('🔐 Checking Webhook Secret Configuration...\n');

  // 1. Check if webhook secret exists
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log('❌ STRIPE_WEBHOOK_SECRET not found in environment variables');
    console.log('\n🔧 To fix this:');
    console.log('1. Go to https://dashboard.stripe.com/webhooks');
    console.log('2. Click "Add endpoint"');
    console.log('3. Enter URL: https://www.snapbet.bet/api/payments/webhook');
    console.log('4. Select events: payment_intent.succeeded, payment_intent.payment_failed');
    console.log('5. Copy the webhook signing secret (starts with whsec_)');
    console.log('6. Add to your .env.local file: STRIPE_WEBHOOK_SECRET="whsec_your_secret"');
    console.log('7. Restart your development server');
    console.log('\n💡 This is why premium package purchases are not working!');
    return false;
  }

  console.log(`✅ Webhook Secret found: ${webhookSecret.substring(0, 10)}...`);
  console.log(`Secret Length: ${webhookSecret.length} characters`);
  
  if (webhookSecret.startsWith('whsec_')) {
    console.log('✅ Webhook secret format is correct');
    console.log('\n🎉 Your webhook secret is configured correctly!');
    console.log('   Premium package purchases should now work properly.');
    return true;
  } else {
    console.log('❌ Webhook secret format is incorrect');
    console.log('   It should start with "whsec_"');
    return false;
  }
}

// Run the check
checkWebhookSecret(); 