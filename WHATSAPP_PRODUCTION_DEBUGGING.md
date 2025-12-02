# 🔍 WhatsApp Production Debugging Guide

## ✅ **Yes, `/whatsapp/test` uses the same code as production**

Both endpoints use:
- `getTodaysPicks()` - Same function
- `formatPicksList()` - Same function
- `sendWhatsAppText()` - Same function

The only differences are:
- **Test endpoint**: `/api/whatsapp/test-command` - No webhook signature verification, no rate limiting
- **Production webhook**: `/api/whatsapp/webhook` - Has signature verification, rate limiting, and webhook processing

---

## 🐛 **Why "1" might not work in production**

### **1. Webhook Signature Verification Failing**
If `WHATSAPP_APP_SECRET` is set in production, the webhook will verify signatures. If verification fails, the request is rejected with 401.

**Check logs for:**
```
WhatsApp webhook signature verification failed
```

**Solution:**
- If you don't have the App Secret yet, **don't set** `WHATSAPP_APP_SECRET` in production
- Or get the real App Secret from Meta and set it correctly

### **2. Rate Limiting Blocking Requests**
New rate limiting (10 messages/minute) might be blocking if you're testing quickly.

**Check logs for:**
```
Rate limit exceeded
```

**Solution:**
- Wait 1 minute between test messages
- Or temporarily increase limits in `lib/whatsapp-rate-limit.ts`

### **3. Empty Picks Array**
If `getTodaysPicks()` returns an empty array, you'll get "No picks available" message.

**Check logs for:**
```
No picks available for WhatsApp user
Fetched picks for WhatsApp (picksCount: 0)
```

**Solution:**
- Check if Market API is returning matches
- Check if Redis cache is working
- Verify `/api/market?status=upcoming` returns data

### **4. Message Sending Failure**
WhatsApp API might be failing to send the message.

**Check logs for:**
```
Failed to send picks
WhatsApp API error
```

**Common causes:**
- Expired access token
- Invalid phone number format
- Message too long (>4096 chars)
- API quota exceeded

### **5. Webhook Not Receiving Messages**
Meta might not be sending webhooks to your endpoint.

**Check:**
- Webhook URL is correct in Meta dashboard
- Webhook is subscribed to `messages` field
- Webhook verification (GET) is working

---

## 🔧 **Debugging Steps**

### **Step 1: Check Webhook is Receiving Messages**

Look for this log when you send "1":
```
Received WhatsApp message
```

If you don't see this, the webhook isn't receiving messages from Meta.

### **Step 2: Check Command Processing**

Look for this log:
```
Processing command
User requested today's picks
```

If you see this, the command is being recognized.

### **Step 3: Check Picks Fetching**

Look for these logs:
```
Fetching today's picks for WhatsApp user
Fetched picks for WhatsApp (picksCount: X)
```

If `picksCount: 0`, there are no picks available.

### **Step 4: Check Message Sending**

Look for:
```
Successfully sent picks to WhatsApp user
```

Or errors:
```
Failed to send picks
```

---

## 📋 **Quick Checklist**

- [ ] Webhook URL is correct in Meta dashboard
- [ ] Webhook is subscribed to `messages` field
- [ ] `WHATSAPP_APP_SECRET` is either:
  - Not set (verification skipped)
  - Set correctly with real App Secret from Meta
- [ ] `WHATSAPP_ACCESS_TOKEN` is valid and not expired
- [ ] `WHATSAPP_PHONE_NUMBER_ID` is correct
- [ ] Rate limiting isn't blocking (wait 1 minute between tests)
- [ ] Market API is returning matches (`/api/market?status=upcoming`)
- [ ] Redis cache is working (if using)

---

## 🧪 **Test Production Webhook Directly**

You can test the production webhook by sending a POST request:

```bash
curl -X POST https://your-domain.com/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "messages": [{
            "from": "YOUR_PHONE_NUMBER",
            "id": "test123",
            "timestamp": "1234567890",
            "text": {
              "body": "1"
            }
          }]
        }
      }]
    }]
  }'
```

**Note:** This will fail signature verification if `WHATSAPP_APP_SECRET` is set, but you'll see the error in logs.

---

## 📊 **Enhanced Logging Added**

I've added enhanced logging to help debug:

1. **Message received logging:**
   - Logs when webhook receives a message
   - Logs text preview and length

2. **Command processing logging:**
   - Logs when "1" command is recognized
   - Logs sanitized text

3. **Picks fetching logging:**
   - Logs when fetching picks
   - Logs pick count
   - Logs message length

4. **Error logging:**
   - Logs all errors with full context
   - Sends fallback error messages to users

---

## 🎯 **Next Steps**

1. **Check your production logs** for the patterns above
2. **Verify webhook is receiving messages** (look for "Received WhatsApp message")
3. **Check if rate limiting is blocking** (look for "Rate limit exceeded")
4. **Verify signature verification** (if `WHATSAPP_APP_SECRET` is set)
5. **Test with `/whatsapp/test` page** to confirm picks are available

If you share your production logs, I can help identify the exact issue!

