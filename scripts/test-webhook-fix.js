require('dotenv').config({ path: '.env.local' });

console.log('🔐 Testing Webhook Secret Fix...\n');

// 1. Check if webhook secret is loaded
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.log('❌ STRIPE_WEBHOOK_SECRET not found');
  console.log('   Please check your .env.local file');
  process.exit(1);
}

console.log(`✅ Webhook Secret found: ${webhookSecret.substring(0, 10)}...`);
console.log(`Secret Length: ${webhookSecret.length} characters\n`);

// 2. Instructions for fixing the issue
console.log('🔧 To fix the webhook signature verification issue:');
console.log('==================================================');
console.log('');
console.log('1. Go to Stripe Dashboard: https://dashboard.stripe.com/webhooks');
console.log('2. Click on your webhook endpoint');
console.log('3. Copy the webhook signing secret (starts with whsec_)');
console.log('4. Compare it with your current secret:');
console.log(`   Current: ${webhookSecret.substring(0, 10)}...`);
console.log('');
console.log('5. If they are different, update your .env.local file:');
console.log('   STRIPE_WEBHOOK_SECRET="whsec_your_actual_secret"');
console.log('');
console.log('6. Restart your development server:');
console.log('   npm run dev');
console.log('');
console.log('7. Test the premium package purchase again');
console.log('');
console.log('💡 This should fix the 400 error and allow webhook processing!'); 