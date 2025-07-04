# 🔗 Stripe Webhook Setup Guide

## 📋 **Your Webhook Endpoint URL**

### **For Local Development (using ngrok):**
```
https://your-ngrok-url.ngrok.io/api/payments/webhook
```

### **For Production:**
```
https://yourdomain.com/api/payments/webhook
```

### **For Vercel Deployment:**
```
https://your-app-name.vercel.app/api/payments/webhook
```

---

## 🚀 **Step-by-Step Setup Instructions**

### **Step 1: Get Your Webhook Secret**

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Enter your webhook URL (see above)
4. Select the events you want to listen to (see Step 2)
5. Click **"Add endpoint"**
6. **Copy the webhook signing secret** (starts with `whsec_`)

### **Step 2: Configure Environment Variable**

Add the webhook secret to your `.env.local` file:

```bash
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"
```

### **Step 3: Select Webhook Events**

In your Stripe Dashboard, select these events for your webhook:

#### **Required Events:**
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `payment_intent.canceled`

#### **Optional Events (for better monitoring):**
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`

---

## 🧪 **Testing Your Webhook**

### **Option 1: Use Stripe CLI (Recommended)**

1. **Install Stripe CLI:**
   ```bash
   # Windows (using scoop)
   scoop install stripe

   # Or download from: https://github.com/stripe/stripe-cli/releases
   ```

2. **Login to Stripe:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server:**
   ```bash
   stripe listen --forward-to localhost:3000/api/payments/webhook
   ```

4. **Test with a webhook event:**
   ```bash
   stripe trigger payment_intent.succeeded
   ```

### **Option 2: Use ngrok for Local Testing**

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start your development server:**
   ```bash
   npm run dev
   ```

3. **Expose your local server:**
   ```bash
   ngrok http 3000
   ```

4. **Use the ngrok URL in Stripe Dashboard:**
   ```
   https://abc123.ngrok.io/api/payments/webhook
   ```

---

## 🔍 **Webhook Event Handling**

Your webhook endpoint (`/api/payments/webhook`) handles these events:

### **Payment Success (`payment_intent.succeeded`)**
- Creates user packages or processes tip purchases
- Updates user account with purchased content
- Sends confirmation emails

### **Payment Failure (`payment_intent.payment_failed`)**
- Logs the failure for monitoring
- Could send notification emails to users

### **Payment Canceled (`payment_intent.canceled`)**
- Handles payment cancellations
- Updates order status

---

## 📊 **Monitoring Webhook Events**

### **Check Webhook Logs in Stripe Dashboard:**
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click on your webhook endpoint
3. View the "Events" tab to see delivery status

### **Check Your Application Logs:**
Monitor your server logs for webhook processing:

```bash
# In your development terminal
npm run dev
```

Look for logs like:
```
[INFO] Webhook processed: payment_intent.succeeded
[INFO] Created user package: pkg_123 for user: usr_456
```

---

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **Webhook Signature Verification Failed**
   - Ensure `STRIPE_WEBHOOK_SECRET` is set correctly
   - Check that the secret starts with `whsec_`

2. **Webhook Not Receiving Events**
   - Verify the webhook URL is accessible
   - Check that your server is running
   - Ensure the endpoint returns 200 status

3. **Events Not Being Processed**
   - Check your application logs for errors
   - Verify the event types are selected in Stripe Dashboard
   - Ensure your database is accessible

### **Testing Commands:**

```bash
# Test webhook endpoint directly
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test" \
  -d '{"type":"test","data":{"object":{}}}'

# Check webhook secret is loaded
node -e "console.log('Webhook secret:', process.env.STRIPE_WEBHOOK_SECRET ? 'SET' : 'MISSING')"
```

---

## 🔒 **Security Best Practices**

1. **Always verify webhook signatures** (already implemented)
2. **Use HTTPS in production**
3. **Keep webhook secrets secure**
4. **Monitor webhook delivery failures**
5. **Implement idempotency for webhook processing**

---

## 📞 **Need Help?**

- **Stripe Webhook Documentation:** https://stripe.com/docs/webhooks
- **Stripe CLI Documentation:** https://stripe.com/docs/stripe-cli
- **Check your application logs for detailed error messages**

---

## 🎯 **Quick Setup Checklist**

- [ ] Add webhook URL to Stripe Dashboard
- [ ] Select required events (`payment_intent.succeeded`, `payment_intent.payment_failed`)
- [ ] Copy webhook signing secret
- [ ] Add `STRIPE_WEBHOOK_SECRET` to `.env.local`
- [ ] Restart your development server
- [ ] Test with Stripe CLI or ngrok
- [ ] Verify events are being processed

**Your webhook endpoint is ready at: `/api/payments/webhook`** 