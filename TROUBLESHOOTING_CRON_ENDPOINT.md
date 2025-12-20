# 🔧 Troubleshooting CRON Endpoint - "Unauthorized" Error

## ✅ **Good News: The Endpoint Works!**

The PowerShell test shows the endpoint is working correctly:
```json
{
  "success": true,
  "results": {
    "upcoming": {
      "synced": 34,
      "errors": 0,
      "skipped": 0
    }
  },
  "summary": {
    "totalSynced": 34,
    "totalErrors": 0,
    "totalSkipped": 0,
    "duration": "33186ms"
  }
}
```

## ❌ **Why You're Getting "Unauthorized"**

If you're accessing `http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming` in a **browser**, you'll get `{"error":"Unauthorized"}` because:

1. **Browsers don't send Authorization headers** by default
2. **The endpoint requires CRON_SECRET** for security
3. **This is intentional** - cron endpoints should only be accessed by automated systems

---

## ✅ **How to Test the Endpoint**

### **Method 1: PowerShell (Works ✅)**

```powershell
$uri = "http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming"
$headers = @{Authorization="Bearer snapbet-marketmatch"}
Invoke-WebRequest -Uri $uri -Method GET -Headers $headers
```

### **Method 2: curl (Works ✅)**

```bash
curl -X GET "http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming" \
  -H "Authorization: Bearer snapbet-marketmatch"
```

### **Method 3: Browser Extension (Works ✅)**

Use a browser extension like:
- **ModHeader** (Chrome/Edge)
- **Header Editor** (Firefox)

Add header:
- **Name**: `Authorization`
- **Value**: `Bearer snapbet-marketmatch`

Then visit: `http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming`

### **Method 4: Postman/Insomnia (Works ✅)**

1. Create a GET request to: `http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming`
2. Add header:
   - **Key**: `Authorization`
   - **Value**: `Bearer snapbet-marketmatch`
3. Send request

---

## 🔍 **Debugging Steps**

### **1. Check if CRON_SECRET is Set**

```powershell
# Check environment variable
$env:CRON_SECRET
```

If empty, add to `.env.local`:
```bash
CRON_SECRET=snapbet-marketmatch
```

### **2. Check Middleware Logs**

Look in your dev server console for:
- ✅ `Middleware - CRON_SECRET authenticated` (success)
- ❌ `Middleware - Invalid CRON_SECRET attempt` (failure)

### **3. Check Route Handler Logs**

Look for:
- ✅ `🕐 CRON: Starting scheduled market sync` (success)
- ❌ `🕐 CRON: Unauthorized market sync attempt` (failure)

### **4. Test with Different Methods**

Try the PowerShell command above - if it works, the endpoint is fine, you just need to send the Authorization header.

---

## 🎯 **Expected Behavior**

### **✅ With Authorization Header:**
```json
{
  "success": true,
  "results": {
    "upcoming": {
      "synced": 34,
      "errors": 0,
      "skipped": 0
    }
  },
  "summary": {
    "totalSynced": 34,
    "totalErrors": 0,
    "totalSkipped": 0,
    "duration": "33186ms"
  }
}
```

### **❌ Without Authorization Header (Browser):**
```json
{
  "error": "Unauthorized"
}
```

---

## 🔒 **Security Note**

**This is correct behavior!** Cron endpoints should:
- ✅ Require CRON_SECRET authentication
- ✅ Reject requests without proper authentication
- ✅ Not be accessible via browser without headers

This prevents:
- Unauthorized access to sync endpoints
- Accidental triggering of syncs
- API abuse

---

## ✅ **Solution**

**For Testing:**
- Use PowerShell, curl, or Postman with Authorization header
- Don't test in browser directly (unless using a header extension)

**For Production:**
- Vercel Cron will automatically send the Authorization header
- No changes needed - it will work automatically

---

## 📊 **Current Status**

✅ **Endpoint is working correctly**
✅ **34 matches synced successfully**
✅ **Middleware authentication working**
✅ **Route handler authentication working**

The "Unauthorized" error in browser is **expected and correct** - use a tool that can send headers!

