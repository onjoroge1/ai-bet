# 📱 WhatsApp Integration - Local Testing Guide

## 🎯 Overview

This guide will help you test the WhatsApp integration locally. Since WhatsApp webhooks require a publicly accessible URL, we'll use **ngrok** to expose your local server.

---

## 🚀 Quick Start

### Step 1: Install ngrok

**Windows (using Chocolatey):**
```bash
choco install ngrok
```

**Or download from:**
- https://ngrok.com/download
- Or use: `npm install -g ngrok`

**Mac/Linux:**
```bash
brew install ngrok
# or
npm install -g ngrok
```

### Step 2: Start Your Local Server

```bash
npm run dev
```

Your server should be running on `http://localhost:3000`

### Step 3: Expose Local Server with ngrok

Open a **new terminal** and run:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123xyz.ngrok.io -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123xyz.ngrok.io`)

> ⚠️ **Note:** Free ngrok URLs change every time you restart ngrok. For consistent testing, consider:
> - Using ngrok's paid plan for static URLs
> - Or keep ngrok running and use the same URL

---

## 🔧 Configure Meta WhatsApp Webhook

### Step 1: Go to Meta for Developers

1. Visit: https://developers.facebook.com/
2. Select your app
3. Go to **WhatsApp → Configuration**

### Step 2: Configure Webhook

1. **Callback URL:** `https://your-ngrok-url.ngrok.io/api/whatsapp/webhook`
   - Replace `your-ngrok-url` with your actual ngrok URL
   - Example: `https://abc123xyz.ngrok.io/api/whatsapp/webhook`

2. **Verify Token:** `snapbet_verify`
   - This should match your `.env` file: `WHATSAPP_VERIFY_TOKEN=snapbet_verify`

3. **Subscribe to fields:**
   - ✅ `messages`
   - ✅ `message_status`
   - ✅ `message_template_status`

4. Click **"Verify and Save"**

### Step 3: Verify Webhook Connection

Meta will send a GET request to verify your webhook. You should see:

**In your Next.js terminal:**
```
[INFO] WhatsApp webhook verified successfully
```

**In ngrok terminal:**
```
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=snapbet_verify&hub.challenge=...
```

If verification fails, check:
- ✅ ngrok is running
- ✅ Your server is running on port 3000
- ✅ `WHATSAPP_VERIFY_TOKEN` in `.env` matches Meta's verify token

---

## 🧪 Testing Methods

### Method 1: Test Sending Messages (No Webhook Needed)

You can test sending WhatsApp messages without setting up the webhook:

**Using the test endpoint:**

```bash
curl -X POST http://localhost:3000/api/whatsapp/send-test \
  -H "Content-Type: application/json" \
  -d '{
    "to": "YOUR_PHONE_NUMBER",
    "message": "Hello from SnapBet! 🚀"
  }'
```

**Or use Postman/Thunder Client:**
- URL: `POST http://localhost:3000/api/whatsapp/send-test`
- Body (JSON):
```json
{
  "to": "16783929144",
  "message": "Test message from local dev"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "WhatsApp message sent successfully",
  "to": "16783929144"
}
```

### Method 2: Test Full Webhook Flow

#### 2.1: Send a Message from Your Phone

1. Open WhatsApp on your phone
2. Send a message to your WhatsApp Business number
3. Check your **ngrok terminal** - you should see the incoming webhook:

```
POST /api/whatsapp/webhook
```

4. Check your **Next.js terminal** - you should see:

```
[INFO] Received WhatsApp message { from: '16783929144', messageId: '...', hasText: true }
```

#### 2.2: Test Menu Commands

Send these messages from your phone to test the menu system:

| Command | Expected Response |
|---------|------------------|
| `menu` or `hi` | Main menu with options |
| `1` | Today's picks list |
| `123456` (matchId) | Payment link for that match |
| `3` or `help` | Help message |

#### 2.3: Test Purchase Flow

1. **Send `1`** to see available picks
2. **Copy a matchId** from the response
3. **Send the matchId** (e.g., `123456`)
4. You should receive a **payment link**
5. **Click the link** to open Stripe Checkout
6. **Complete test payment** (use Stripe test card: `4242 4242 4242 4242`)
7. **Check WhatsApp** - you should receive the full pick details

---

## 🔍 Debugging Tips

### Check ngrok Traffic

ngrok provides a web interface to see all requests:

1. Open: http://localhost:4040 (or the URL shown in ngrok output)
2. You'll see all incoming requests in real-time
3. Click on any request to see headers, body, and response

### Check Application Logs

**In your Next.js terminal, look for:**
```
[INFO] WhatsApp webhook received
[INFO] Received WhatsApp message { from: '...', text: '...' }
[INFO] Sending WhatsApp message to: ...
```

**If you see errors:**
- Check `.env` file has all required variables
- Verify WhatsApp Access Token is valid
- Check database connection

### Test Webhook Verification Manually

```bash
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=snapbet_verify&hub.challenge=test123"
```

**Expected Response:** `test123` (the challenge value)

### Test Webhook POST Manually

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "16783929144",
            "id": "test123",
            "timestamp": "1234567890",
            "text": {
              "body": "menu"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

**Expected Response:**
```json
{ "status": "ok" }
```

---

## 📋 Environment Variables Checklist

Make sure your `.env` file has:

```env
# WhatsApp Configuration
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WABA_ID=your_waba_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=snapbet_verify

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (for Stripe webhooks)
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://...
```

---

## 🎯 Testing Checklist

### Basic Functionality
- [ ] ngrok is running and exposing port 3000
- [ ] Next.js server is running
- [ ] Webhook verification succeeds in Meta dashboard
- [ ] Can send test message via `/api/whatsapp/send-test`

### Menu System
- [ ] Sending `menu` shows main menu
- [ ] Sending `1` shows today's picks
- [ ] Sending `3` shows help message
- [ ] Sending invalid command shows menu

### Purchase Flow
- [ ] Sending matchId creates payment session
- [ ] Payment link opens in WhatsApp webview
- [ ] Stripe Checkout loads correctly
- [ ] Test payment completes successfully
- [ ] Full pick details are sent via WhatsApp after payment

### Error Handling
- [ ] Invalid matchId shows error message
- [ ] Already purchased pick shows appropriate message
- [ ] Network errors are handled gracefully

---

## 🐛 Common Issues

### Issue: "Webhook verification failed"

**Solution:**
- Check `WHATSAPP_VERIFY_TOKEN` in `.env` matches Meta dashboard
- Ensure ngrok is running
- Verify the webhook URL in Meta dashboard uses HTTPS (not HTTP)

### Issue: "WhatsApp API error 401 Unauthorized"

**Solution:**
- Check `WHATSAPP_ACCESS_TOKEN` is valid
- Token might be expired - generate a new one in Meta dashboard
- Ensure token has WhatsApp permissions

### Issue: "No response from webhook"

**Solution:**
- Check ngrok is still running (URL might have changed)
- Update webhook URL in Meta dashboard if ngrok restarted
- Check Next.js server is running
- Look at ngrok web interface (http://localhost:4040) to see if requests are arriving

### Issue: "Payment webhook not working"

**Solution:**
- Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/payments/webhook`
- Or configure Stripe webhook in dashboard to use ngrok URL: `https://your-ngrok-url.ngrok.io/api/payments/webhook`
- Ensure `STRIPE_WEBHOOK_SECRET` is set in `.env`

---

## 🚀 Production Deployment

When deploying to production:

1. **Update webhook URL in Meta dashboard:**
   - Change from ngrok URL to: `https://yourdomain.com/api/whatsapp/webhook`

2. **Update Stripe webhook:**
   - Change to: `https://yourdomain.com/api/payments/webhook`

3. **Update environment variables:**
   - Set `NEXTAUTH_URL` to your production URL
   - Ensure all tokens and secrets are production values

---

## 📞 Need Help?

- **Meta WhatsApp API Docs:** https://developers.facebook.com/docs/whatsapp
- **ngrok Docs:** https://ngrok.com/docs
- **Check application logs** for detailed error messages
- **Check ngrok web interface** (http://localhost:4040) for request details

---

## 🎉 Success Indicators

You'll know everything is working when:

1. ✅ Meta webhook verification succeeds
2. ✅ You can send messages from your phone and receive responses
3. ✅ Menu commands work correctly
4. ✅ Purchase flow completes and sends pick details
5. ✅ All logs show successful operations

**Happy Testing! 🚀**

