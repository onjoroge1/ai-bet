# 📋 MarketMatch Sync - Log Check Summary

## ✅ **What We Found**

### **1. Endpoint Status**
- ✅ Endpoint exists: `/api/admin/market/sync-scheduled`
- ⚠️ **Issue**: Request is being redirected to `/signin` page
- **Cause**: Middleware is intercepting the request before it reaches the route handler

### **2. Expected Response Format**

**Success Response:**
```json
{
  "success": true,
  "results": {
    "upcoming": {
      "synced": 15,
      "errors": 0,
      "skipped": 3
    }
  },
  "summary": {
    "totalSynced": 15,
    "totalErrors": 0,
    "totalSkipped": 3,
    "duration": "2345ms"
  }
}
```

### **3. Expected Log Messages**

**In Dev Server Console (when running `npm run dev`):**

**✅ Success Logs:**
```
[2025-01-XX...] [INFO] 🕐 CRON: Starting scheduled market sync
[2025-01-XX...] [INFO] 🔄 Starting sync for upcoming matches
[2025-01-XX...] [INFO] ✅ Completed sync for upcoming matches
[2025-01-XX...] [INFO] 🕐 CRON: Scheduled market sync completed
```

**❌ Error Logs:**
```
[2025-01-XX...] [WARN] 🕐 CRON: Unauthorized market sync attempt
[2025-01-XX...] [ERROR] Error syncing match {matchId}
[2025-01-XX...] [ERROR] Failed to sync upcoming matches
[2025-01-XX...] [ERROR] 🕐 CRON: Market sync failed
```

---

## 🔧 **How to Check Logs**

### **Method 1: Dev Server Console**

1. **Start dev server:**
   ```powershell
   npm run dev
   ```

2. **Watch the console output** for log messages starting with:
   - `🕐 CRON: Starting scheduled market sync`
   - `🔄 Starting sync for...`
   - `✅ Completed sync for...`

3. **Test the endpoint** in another terminal:
   ```powershell
   $uri = "http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming"
   $headers = @{Authorization="Bearer snapbet-marketmatch"}
   Invoke-WebRequest -Uri $uri -Method GET -Headers $headers
   ```

### **Method 2: Check Middleware**

The endpoint might be blocked by middleware. Check `middleware.ts` to ensure:
- Admin routes are excluded from auth checks
- Or CRON_SECRET authentication is handled before middleware

### **Method 3: Database Check**

**Verify data collection:**
```sql
-- Check total records
SELECT COUNT(*) FROM "MarketMatch";

-- Check by status
SELECT status, COUNT(*) 
FROM "MarketMatch" 
GROUP BY status;

-- Check recent syncs
SELECT 
  "matchId",
  status,
  "homeTeam",
  "awayTeam",
  "lastSyncedAt",
  "syncCount"
FROM "MarketMatch"
WHERE "lastSyncedAt" > NOW() - INTERVAL '1 hour'
ORDER BY "lastSyncedAt" DESC
LIMIT 10;
```

---

## ⚠️ **Current Issue: Middleware Redirect**

**Problem**: Request is redirected to `/signin` before reaching the route handler.

**Solution Options:**

1. **Exclude admin routes from middleware auth:**
   ```typescript
   // In middleware.ts
   if (pathname.startsWith('/api/admin/')) {
     // Skip auth check for admin routes
     return NextResponse.next()
   }
   ```

2. **Or handle CRON auth in middleware:**
   ```typescript
   // Check for CRON_SECRET in Authorization header
   const authHeader = request.headers.get('authorization')
   if (authHeader?.startsWith('Bearer ')) {
     const secret = authHeader.replace('Bearer ', '')
     if (secret === process.env.CRON_SECRET) {
       return NextResponse.next() // Allow through
     }
   }
   ```

---

## 📊 **Data Collection Verification**

### **What Should Be Collected:**

1. **Upcoming Matches:**
   - `matchId`, `status`, `homeTeam`, `awayTeam`, `league`
   - `kickoffDate`, `consensusOdds`, `v1Model`, `v2Model`
   - `lastSyncedAt`, `syncCount`

2. **Live Matches:**
   - Everything from upcoming PLUS:
   - `currentScore`, `elapsed`, `period`
   - `liveStatistics`, `momentum`, `modelMarkets`

3. **Completed Matches:**
   - Everything from live PLUS:
   - `finalResult`, `matchStatistics`

### **Success Criteria:**

✅ **Endpoint returns 200 OK** with JSON response  
✅ **Response has `success: true`**  
✅ **Database contains records** in `MarketMatch` table  
✅ **Data completeness > 80%** (odds, models present)  
✅ **No errors** in response (`errors: 0`)  
✅ **Logs appear** in dev server console  

---

## 🚀 **Next Steps**

1. **Fix middleware** to allow CRON requests through
2. **Test endpoint** with proper authentication
3. **Verify logs** appear in dev server console
4. **Check database** for collected data
5. **Monitor sync** frequency and success rate

---

**Status**: Endpoint created, needs middleware fix  
**Documentation**: See `HOW_TO_CHECK_LOGS.md` for detailed instructions

