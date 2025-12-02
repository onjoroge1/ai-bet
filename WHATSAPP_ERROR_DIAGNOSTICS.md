# 🔍 WhatsApp Error Diagnostics Guide

## Error: "Sorry, couldn't send picks right now. Please try again later"

This error occurs when `sendWhatsAppText` fails. Here are the most common causes and how to diagnose them:

---

## 🔴 **Common Causes**

### **1. Message Too Long (>4096 characters)**
**Error Code:** `100`  
**Error Type:** `MESSAGE_TOO_LONG`

**Symptoms:**
- Error message: `Param text['body'] must be at most 4096 characters long`
- Logs show `messageLength > 4096`

**Solution:**
- The code now automatically checks message length and sends a shorter version if needed
- If even the shortened version is too long, it sends an error message

**Check logs for:**
```
Picks message exceeds WhatsApp character limit
messageLength: XXXX
maxLength: 4096
```

---

### **2. Access Token Expired**
**Error Code:** `190`  
**Error Type:** `TOKEN_EXPIRED`

**Symptoms:**
- Error message: `Error validating access token: Session has expired...`
- Status: `401 Unauthorized`

**Solution:**
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Navigate to your WhatsApp app
3. Generate a new **long-lived access token**
4. Update `WHATSAPP_ACCESS_TOKEN` in production environment variables

**Check logs for:**
```
WhatsApp API error
status: 401
errorCode: 190
errorType: TOKEN_EXPIRED
```

---

### **3. Rate Limiting**
**Error Code:** `429` or Meta rate limit error  
**Error Type:** `RATE_LIMIT`

**Symptoms:**
- Status: `429 Too Many Requests`
- Error message mentions rate limits

**Solution:**
- Wait before sending more messages
- Check your WhatsApp Business Account tier limits
- Consider implementing message queuing for high-volume scenarios

**Check logs for:**
```
WhatsApp API error
status: 429
errorType: RATE_LIMIT
```

**WhatsApp Rate Limits:**
- **Tier 1 (Free):** 1,000 conversations/month
- **Tier 2:** 10,000 conversations/month
- **Tier 3:** 100,000 conversations/month
- **Tier 4+:** Custom limits

---

### **4. Invalid Phone Number**
**Error Code:** `131047`  
**Error Type:** `INVALID_PHONE`

**Symptoms:**
- Error message: `Invalid phone number format`
- Phone number not in E.164 format

**Solution:**
- Ensure phone numbers are in E.164 format (e.g., `16783929144`)
- The `formatPhoneNumber` function should handle this automatically

**Check logs for:**
```
WhatsApp API error
errorCode: 131047
errorType: INVALID_PHONE
```

---

### **5. Number Not Registered on WhatsApp**
**Error Code:** `131026`  
**Error Type:** `NUMBER_NOT_REGISTERED`

**Symptoms:**
- Error message: `Recipient phone number not registered on WhatsApp`

**Solution:**
- Verify the recipient has WhatsApp installed and registered
- Test with a known working WhatsApp number

**Check logs for:**
```
WhatsApp API error
errorCode: 131026
errorType: NUMBER_NOT_REGISTERED
```

---

### **6. Template Required (24-Hour Window Expired)**
**Error Code:** `131031`  
**Error Type:** `TEMPLATE_REQUIRED`

**Symptoms:**
- Error message: `Message template required for this recipient`
- Occurs when trying to send a free-form message outside the 24-hour window

**Solution:**
- Use a pre-approved message template
- Or wait for the user to message you first (starts 24-hour window)

**Check logs for:**
```
WhatsApp API error
errorCode: 131031
errorType: TEMPLATE_REQUIRED
```

---

### **7. Network/API Issues**
**Error Type:** Network errors, timeouts, etc.

**Symptoms:**
- `fetch failed`
- `ECONNREFUSED`
- `ETIMEDOUT`
- `Network error`

**Solution:**
- Check network connectivity
- Verify Meta API is accessible
- Check firewall/proxy settings

**Check logs for:**
```
Error sending WhatsApp message
error: [Network error details]
```

---

## 🔧 **How to Diagnose**

### **Step 1: Check Production Logs**

Look for these log entries when the error occurs:

```javascript
// When fetching picks
logger.info("Fetching today's picks for WhatsApp user", { to });
logger.info("Fetched picks for WhatsApp", { to, picksCount: X });

// When formatting message
logger.debug("Formatted picks message", { to, messageLength: X, picksCount: X });

// When sending fails
logger.error("Failed to send picks", {
  to,
  error: result.error,
  messageLength: X,
  errorDetails: result.error,
});

// WhatsApp API error details
logger.error("WhatsApp API error", {
  status: X,
  statusText: "...",
  errorCode: X,
  errorType: "...",
  error: "...",
  to,
  url: "...",
});
```

### **Step 2: Check Message Length**

If `messageLength > 4096`, the message is too long. The code will:
1. Try to send a shorter version automatically
2. If that fails, send an error message

### **Step 3: Check Error Code**

Match the error code from logs to the causes above:
- `190` = Token expired
- `100` = Message too long
- `429` = Rate limit
- `131047` = Invalid phone
- `131026` = Number not registered
- `131031` = Template required

### **Step 4: Test with `/whatsapp/test` Page**

Use the test page to:
1. Send command "1" to your phone number
2. Check the response
3. View the full message content
4. Verify message length

---

## 🛠️ **Enhanced Error Handling**

I've added enhanced error handling that:

1. **Checks message length before sending** - Prevents sending messages that are too long
2. **Provides specific error messages** - Based on error type (token expired, rate limit, etc.)
3. **Logs detailed error information** - Including error code, type, and full error details
4. **Auto-shortens messages** - If message is too long, tries to send a shorter version

---

## 📋 **Quick Checklist**

When you see this error, check:

- [ ] **Message length** - Is it > 4096 characters?
- [ ] **Access token** - Is it expired? (Check error code 190)
- [ ] **Rate limits** - Are you hitting WhatsApp API limits?
- [ ] **Phone number** - Is it in E.164 format?
- [ ] **Network** - Are there network/connectivity issues?
- [ ] **Logs** - What's the exact error code and message?

---

## 🎯 **Next Steps**

1. **Check your production logs** for the error details above
2. **Share the error code and type** from the logs
3. **Test with `/whatsapp/test`** to verify message length
4. **Check WhatsApp Business Account** for rate limit status

The enhanced logging will help identify the exact issue!

