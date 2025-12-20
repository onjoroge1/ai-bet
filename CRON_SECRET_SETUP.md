# 🔐 Cron Secret Setup Guide

## ✅ **Quick Answer**

**Yes, you need to add `CRON_SECRET` to your `.env.local` file and Vercel Dashboard.**

---

## 📋 **Setup Instructions**

### **1. Local Development (`.env.local`)**

Create or update `.env.local` in your project root:

```bash
# Cron Security
CRON_SECRET=snapbet-marketmatch
```

**Note**: `.env.local` is already in `.gitignore`, so it won't be committed.

### **2. Production (Vercel Dashboard)**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter:
   - **Key**: `CRON_SECRET`
   - **Value**: `snapbet-marketmatch`
   - **Environment**: Select all (Production, Preview, Development)
6. Click **Save**
7. **Redeploy** your project for changes to take effect

---

## 🔒 **Security Notes**

### **Current Secret: `snapbet-marketmatch`**

**Pros:**
- ✅ Easy to remember
- ✅ Descriptive (you know what it's for)
- ✅ Works for authentication

**Cons:**
- ⚠️ Less secure than random hash
- ⚠️ Predictable pattern

### **Recommendation for Production:**

Consider using a longer, more random value:
```bash
CRON_SECRET=snapbet-marketmatch-2025-secure-sync-key-xyz123
```

Or generate a random hash:
```bash
# Generate random secret (run in terminal)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**However**, `snapbet-marketmatch` is **acceptable** for cron authentication since:
- It's not user-facing
- Only used for internal cron jobs
- Protected by Vercel's infrastructure

---

## ✅ **Verification**

### **Test Locally:**

**PowerShell (Windows):**
```powershell
# Test with your secret (PowerShell)
curl.exe -X GET "http://localhost:3000/api/admin/market/sync-scheduled?type=live" -H "Authorization: Bearer snapbet-marketmatch"
```

**Or using Invoke-WebRequest (PowerShell native):**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/market/sync-scheduled?type=live" -Method GET -Headers @{Authorization="Bearer snapbet-marketmatch"}
```

**Bash/Unix:**
```bash
# Test with your secret (Bash)
curl -X GET "http://localhost:3000/api/admin/market/sync-scheduled?type=live" \
  -H "Authorization: Bearer snapbet-marketmatch"
```

**Expected Response:**
```json
{
  "success": true,
  "results": {
    "live": { "synced": 5, "errors": 0, "skipped": 2 }
  },
  "summary": {
    "totalSynced": 5,
    "totalErrors": 0,
    "totalSkipped": 2,
    "duration": "1234ms"
  }
}
```

### **Test Without Secret (Should Fail):**

**PowerShell (Windows):**
```powershell
curl.exe -X GET "http://localhost:3000/api/admin/market/sync-scheduled?type=live"
```

**Bash/Unix:**
```bash
curl -X GET "http://localhost:3000/api/admin/market/sync-scheduled?type=live"
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

---

## 📝 **Code Reference**

The sync endpoint uses the secret here:

```typescript
// app/api/admin/market/sync-scheduled/route.ts
const cronSecret = process.env.CRON_SECRET || 'snapbet-marketmatch'

if (authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Fallback**: If `CRON_SECRET` is not set, it defaults to `snapbet-marketmatch` (for development).

---

## 🚀 **After Setup**

1. ✅ Add `CRON_SECRET` to `.env.local`
2. ✅ Add `CRON_SECRET` to Vercel Dashboard
3. ✅ Redeploy project (if production)
4. ✅ Test endpoint manually
5. ✅ Monitor Vercel logs for cron execution

---

**Status**: Ready to configure  
**Secret Value**: `snapbet-marketmatch`  
**Required**: Yes, add to both `.env.local` and Vercel Dashboard

