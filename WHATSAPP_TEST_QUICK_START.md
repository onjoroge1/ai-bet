# 📱 WhatsApp Test - Quick Start Guide

## 🚨 SSL Connection Error Fix

If you're seeing `SSL_ERROR_SYSCALL` when using curl, this is a **network/SSL issue**, not a code problem.

## ✅ **BEST SOLUTION: Use the Browser Test Page**

The browser handles SSL certificates automatically and is more reliable than curl.

### Steps:

1. **Open your browser** and navigate to:
   ```
   https://snapbet.bet/whatsapp/test
   ```

2. **Enter your phone number** (e.g., `6783929144`)

3. **Select "Today's Picks"** radio button

4. **Click "Send Today's Picks"**

5. **Check your WhatsApp** for the message

---

## 🔧 Alternative: Test Locally (if server is running)

If you have the dev server running locally:

```bash
# In Git Bash or terminal
curl -X POST http://localhost:3000/api/whatsapp/send-test \
  -H "Content-Type: application/json" \
  -d '{"to": "6783929144", "type": "picks"}'
```

**Note:** This requires:
- `npm run dev` to be running
- Local server on port 3000
- WhatsApp env vars configured in `.env.local`

---

## 🌐 Check if Endpoint is Deployed

Visit in browser:
```
https://snapbet.bet/api/whatsapp/send-test
```

**Expected Response (if deployed):**
```json
{"error":"Missing required field: 'to'"}
```

**If you get 404 or connection error:**
- The endpoint might not be deployed yet
- Deploy the latest code to production

---

## 📋 What the Test Does

When you send `type: "picks"`, the endpoint:

1. ✅ Fetches matches from `/api/market?status=upcoming&limit=50`
2. ✅ Uses the same `getTodaysPicks()` function as the webhook
3. ✅ Formats using `formatPicksList()` (same as when user types "1")
4. ✅ Sends via WhatsApp API

This is **exactly** what happens when a user types "1" in WhatsApp.

---

## 🐛 Troubleshooting

### Issue: "No response" or timeout
- **Check:** Is the endpoint deployed?
- **Solution:** Deploy latest code to production

### Issue: SSL error in curl
- **Solution:** Use the browser test page instead
- **Why:** Browser handles SSL certificates automatically

### Issue: "Failed to fetch picks"
- **Check:** Is `/api/market?status=upcoming` working?
- **Check:** Are environment variables set (BACKEND_API_URL, etc.)?
- **Check:** Server logs for detailed error messages

### Issue: WhatsApp message not received
- **Check:** Is `WHATSAPP_ACCESS_TOKEN` valid?
- **Check:** Is phone number in correct format?
- **Check:** Server logs for WhatsApp API errors

---

## 📞 Next Steps

1. **Use the test page:** `https://snapbet.bet/whatsapp/test`
2. **If it works:** The endpoint is working correctly
3. **If it doesn't:** Check server logs and verify deployment



