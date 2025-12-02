# 🔐 WhatsApp APP_SECRET Setup Guide

## 📋 **What is WHATSAPP_APP_SECRET?**

The `WHATSAPP_APP_SECRET` is a **secret key provided by Meta** when you set up your WhatsApp Business App. It's used to verify that webhook requests are actually coming from Meta (not spoofed).

## ⚠️ **Important: Two Different Scenarios**

### **1. Production (Real WhatsApp Integration)**
- **MUST use the real App Secret from Meta**
- You **cannot** make up your own value
- Meta signs webhook payloads with this secret
- Without the correct secret, signature verification will fail

### **2. Development/Testing (Local Testing)**
- Can use a placeholder/test value
- Or skip verification entirely (already implemented)
- The code will skip verification if `WHATSAPP_APP_SECRET` is not set

---

## 🚀 **How to Get Your Real App Secret from Meta**

### **Step 1: Go to Meta for Developers**
1. Visit [Meta for Developers](https://developers.facebook.com/)
2. Select your app (or create a new WhatsApp Business App)

### **Step 2: Navigate to App Settings**
1. Go to **Settings** → **Basic**
2. Scroll down to find **App Secret**
3. Click **Show** and enter your password
4. Copy the App Secret (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### **Step 3: Add to Environment Variables**
```env
WHATSAPP_APP_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## 🧪 **For Local Development/Testing**

If you're testing locally and don't have the App Secret yet, you have two options:

### **Option 1: Skip Verification (Recommended for Local Testing)**
Simply **don't set** `WHATSAPP_APP_SECRET` in your `.env` file. The code will automatically skip signature verification in this case.

```env
# Leave this commented out or don't include it
# WHATSAPP_APP_SECRET=
```

### **Option 2: Use a Test Secret**
Generate a secure random string for testing. This won't work with real Meta webhooks, but allows you to test the verification logic.

```bash
# Generate a random 32-character hex string
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Then add to `.env`:
```env
WHATSAPP_APP_SECRET=your_generated_test_secret_here
```

---

## 🔍 **How It Works**

1. **Meta sends webhook** → Signs payload with App Secret
2. **Your server receives webhook** → Reads `X-Hub-Signature-256` header
3. **Your server verifies** → Recreates signature using your `WHATSAPP_APP_SECRET`
4. **If signatures match** → Request is legitimate ✅
5. **If signatures don't match** → Request is rejected ❌

---

## ✅ **Current Implementation**

The code in `lib/whatsapp-webhook-verification.ts`:
- ✅ Verifies signature if `WHATSAPP_APP_SECRET` is set
- ✅ Skips verification if `WHATSAPP_APP_SECRET` is not set (development mode)
- ✅ Uses constant-time comparison (prevents timing attacks)
- ✅ Logs verification failures for debugging

---

## 🎯 **Recommendation**

### **For Local Development:**
```env
# Don't set WHATSAPP_APP_SECRET - verification will be skipped
# This allows you to test without the real secret
```

### **For Production:**
```env
# MUST use the real App Secret from Meta
WHATSAPP_APP_SECRET=your_real_app_secret_from_meta
```

---

## 📝 **Security Notes**

1. **Never commit** `WHATSAPP_APP_SECRET` to version control
2. **Store securely** in environment variables or secret management system
3. **Rotate if compromised** - regenerate in Meta dashboard
4. **Use different secrets** for development and production

---

## 🆘 **Troubleshooting**

### **Verification Always Fails**
- Check that you're using the correct App Secret from Meta
- Ensure the secret matches the one in your Meta app settings
- Check logs for signature comparison details

### **Webhook Not Working in Development**
- Make sure `WHATSAPP_APP_SECRET` is not set (or set to empty)
- The code will skip verification automatically

### **Can't Find App Secret in Meta Dashboard**
- Make sure you have admin access to the app
- Check that you're looking at the correct app
- App Secret is in Settings → Basic (scroll down)

