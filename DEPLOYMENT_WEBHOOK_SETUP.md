# 🚀 **CRITICAL: Production Deployment & Webhook Setup Guide**

## 🚨 **Current Issue**
Your payment system is **90% complete** but users are not receiving purchased tips/packages because the webhook is not working in production.

## 📋 **Status Check**

### ✅ **What's Working**
- ✅ Local development environment is properly configured
- ✅ Local webhook endpoint is working correctly
- ✅ Payment UI and Stripe integration are complete
- ✅ Payment processing works (charges are successful in Stripe)

### ❌ **What's Broken**
- ❌ Production webhook not receiving events from Stripe
- ❌ Users don't receive purchased tips/packages
- ❌ No payment confirmations or database updates
- ❌ Payment success notifications not working

---

## 🎯 **Solution: Deploy Code & Configure Webhook**

### **Step 1: Deploy Your Code to Production**

#### **Option A: Vercel Deployment (Recommended)**

1. **Connect to Vercel** (if not already connected):
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   ```

2. **Deploy to Production**:
   ```bash
   # Deploy to production
   vercel --prod
   ```

3. **Set Environment Variables in Vercel Dashboard**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Select your project
   - Go to Settings → Environment Variables
   - Add these variables:
   ```bash
   DATABASE_URL="your_production_database_url"
   JWT_SECRET="your_jwt_secret"
   NEXTAUTH_URL="https://yourdomain.com"
   NEXTAUTH_SECRET="your_nextauth_secret"
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_your_stripe_publishable_key"
   STRIPE_SECRET_KEY="sk_live_your_stripe_secret_key"
   STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
   ```

#### **Option B: Manual Deployment**
```bash
# Build the application
npm run build

# Start production server
npm run start
```

### **Step 2: Configure Stripe Webhook**

1. **Go to Stripe Dashboard**:
   - Visit [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)

2. **Add Webhook Endpoint**:
   - Click **"Add endpoint"**
   - Enter your production webhook URL:
     ```
     https://yourdomain.com/api/payments/webhook
     ```
   - Or if using Vercel:
     ```
     https://your-app-name.vercel.app/api/payments/webhook
     ```

3. **Select Events**:
   - ✅ `payment_intent.succeeded` (REQUIRED)
   - ✅ `payment_intent.payment_failed` (REQUIRED)
   - ✅ `payment_intent.canceled` (OPTIONAL)

4. **Copy Webhook Secret**:
   - After creating the webhook, copy the signing secret (starts with `whsec_`)
   - Add it to your production environment variables as `STRIPE_WEBHOOK_SECRET`

### **Step 3: Test Production Webhook**

1. **Test Webhook Endpoint**:
   ```bash
   # Test if webhook endpoint is accessible
   curl -X POST https://yourdomain.com/api/payments/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

2. **Monitor Webhook Events**:
   - Go to Stripe Dashboard > Webhooks
   - Click on your webhook endpoint
   - Check the "Events" tab for delivery status

3. **Test Complete Payment Flow**:
   - Make a test payment in production
   - Check Stripe Dashboard for webhook delivery
   - Verify user receives purchased content

---

## 🔧 **Troubleshooting**

### **Webhook Not Receiving Events**

1. **Check Webhook URL**:
   - Ensure the URL is correct and accessible
   - Test with curl or browser

2. **Verify Environment Variables**:
   - Ensure `STRIPE_WEBHOOK_SECRET` is set in production
   - Check that all required variables are configured

3. **Check Server Logs**:
   - Monitor your production server logs
   - Look for webhook processing errors

4. **Verify Stripe Configuration**:
   - Ensure you're using the correct Stripe keys (live vs test)
   - Check that your Stripe account is active

### **Common Error Messages**

1. **"Webhook signature verification failed"**:
   - Check that `STRIPE_WEBHOOK_SECRET` is correct
   - Ensure the secret starts with `whsec_`

2. **"Webhook endpoint not found"**:
   - Verify the webhook URL is correct
   - Ensure your server is running and accessible

3. **"Payment intent not found"**:
   - Check that payment intents are being created correctly
   - Verify the payment flow is working

---

## 📊 **Monitoring & Verification**

### **Success Indicators**

Once properly configured, you should see:

1. ✅ **Webhook events received** in Stripe Dashboard
2. ✅ **Users receive purchased tips/packages** immediately
3. ✅ **Payment confirmation emails** sent
4. ✅ **Database updated** with purchase records
5. ✅ **In-app notifications** created
6. ✅ **Payment success notifications** displayed

### **Monitoring Tools**

1. **Stripe Dashboard**:
   - Webhooks > Recent deliveries
   - Payment intents > Status tracking

2. **Application Logs**:
   - Monitor server logs for webhook processing
   - Check for error messages

3. **Database Monitoring**:
   - Verify `UserPackage` records are created
   - Check `UserPrediction` records for tips

---

## 🚀 **Quick Fix Checklist**

- [ ] Deploy code to production (Vercel or manual)
- [ ] Set all environment variables in production
- [ ] Add webhook endpoint to Stripe Dashboard
- [ ] Copy webhook secret to production environment
- [ ] Test webhook endpoint accessibility
- [ ] Make test payment and verify webhook delivery
- [ ] Confirm user receives purchased content
- [ ] Monitor webhook events in Stripe Dashboard

---

## 📞 **Need Help?**

### **If Webhook Still Not Working**:

1. **Check Production Logs**:
   ```bash
   # If using Vercel
   vercel logs --prod
   ```

2. **Test Webhook Locally with ngrok**:
   ```bash
   # Install ngrok
   npm install -g ngrok
   
   # Expose local server
   ngrok http 3000
   
   # Use ngrok URL in Stripe Dashboard for testing
   ```

3. **Verify Database Connection**:
   - Ensure production database is accessible
   - Check database credentials and connection

### **Emergency Contact**:
- Check Stripe Dashboard for detailed error messages
- Monitor application logs for specific error details
- Verify all environment variables are correctly set

---

## 🎉 **Expected Outcome**

After completing this setup:

1. **Payments will work end-to-end**
2. **Users will receive purchased content immediately**
3. **Payment confirmations will be sent**
4. **Database will be updated correctly**
5. **Business logic will function as intended**

**Your payment system will be 100% functional!** 🚀 