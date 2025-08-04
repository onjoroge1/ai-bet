# 🔗 Setting Up Stripe Webhooks for Local Development

## Problem
Payment confirmation emails are not being sent because Stripe webhooks cannot reach your local development environment (`localhost:3000`).

## Solution: Use Stripe CLI

### 1. Install Stripe CLI
```bash
# Windows (using Chocolatey)
choco install stripe-cli

# Or download from: https://github.com/stripe/stripe-cli/releases
```

### 2. Login to Stripe
```bash
stripe login
```

### 3. Forward Webhooks to Local Development
```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

This will give you a webhook signing secret like:
```
> Ready! Your webhook signing secret is whsec_1234567890abcdef...
```

### 4. Update Environment Variables
Add the webhook secret to your `.env` file:
```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

### 5. Test Webhook Delivery
Make a test purchase and you should see webhook events in the Stripe CLI output.

## Alternative: Use ngrok for Public URL

### 1. Install ngrok
```bash
npm install -g ngrok
```

### 2. Create Public Tunnel
```bash
ngrok http 3000
```

### 3. Configure Stripe Webhook
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-ngrok-url.ngrok.io/api/payments/webhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`

## Verify Webhook is Working

After setup, make a test purchase and check:
1. Stripe CLI shows webhook events
2. Application logs show webhook processing
3. Email logs show payment confirmation emails
4. Database shows payment intent IDs

## Current Status
- ✅ Email service works
- ✅ Email templates configured
- ❌ Webhooks not reaching localhost
- ❌ Payment confirmation emails not sent 