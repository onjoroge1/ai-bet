# 📋 How to Check MarketMatch Sync Logs

## ✅ **Quick Check Methods**

### **Method 1: Test Endpoint Directly (PowerShell)**

```powershell
# Test the sync endpoint
$uri = "http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming"
$headers = @{Authorization="Bearer snapbet-marketmatch"}
$response = Invoke-WebRequest -Uri $uri -Method GET -Headers $headers -UseBasicParsing
$json = $response.Content | ConvertFrom-Json
$json | ConvertTo-Json -Depth 10
```

**Expected Response:**
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

### **Method 2: Check Dev Server Console**

**If running `npm run dev`, look for these log messages:**

#### **✅ Success Logs:**
```
[2025-01-XX...] [INFO] 🕐 CRON: Starting scheduled market sync
[2025-01-XX...] [INFO] 🔄 Starting sync for upcoming matches
[2025-01-XX...] [INFO] ✅ Completed sync for upcoming matches
[2025-01-XX...] [INFO] 🕐 CRON: Scheduled market sync completed
```

#### **❌ Error Logs:**
```
[2025-01-XX...] [WARN] 🕐 CRON: Unauthorized market sync attempt
[2025-01-XX...] [ERROR] Error syncing match {matchId}
[2025-01-XX...] [ERROR] Failed to sync upcoming matches
[2025-01-XX...] [ERROR] 🕐 CRON: Market sync failed
```

### **Method 3: Check Database**

**Run this SQL query to verify data collection:**

```sql
SELECT 
  status,
  COUNT(*) as count,
  MAX("lastSyncedAt") as last_sync,
  AVG("syncCount") as avg_sync_count
FROM "MarketMatch"
GROUP BY status
ORDER BY status;
```

**Expected Output:**
```
status    | count | last_sync              | avg_sync_count
----------|-------|------------------------|---------------
UPCOMING  | 45    | 2025-01-XX 12:34:56     | 2.3
LIVE      | 3     | 2025-01-XX 12:35:01     | 5.7
FINISHED  | 12    | 2025-01-XX 11:20:15     | 1.0
```

---

## 🔍 **What to Look For**

### **1. Response Structure**

✅ **Good Response:**
- `success: true`
- `results.{type}.synced > 0` (matches were synced)
- `results.{type}.errors = 0` (no errors)
- `summary.duration` is reasonable (< 60 seconds)

⚠️ **Warning Signs:**
- `synced: 0` and `skipped: {high number}` (all matches skipped - may be normal if recently synced)
- `errors > 0` (check logs for specific errors)
- `duration > 60s` (may timeout on Vercel)

❌ **Error Response:**
- `success: false`
- `error: "..."` (check error message)
- HTTP status code 401, 404, or 500

### **2. Log Messages**

**Check your dev server terminal for:**

1. **Start Log:**
   ```
   🕐 CRON: Starting scheduled market sync
   ```

2. **Status Sync Log:**
   ```
   🔄 Starting sync for upcoming matches
   ```

3. **Completion Log:**
   ```
   ✅ Completed sync for upcoming matches
   data: { synced: 15, errors: 0, skipped: 3, total: 18 }
   ```

4. **Final Summary:**
   ```
   🕐 CRON: Scheduled market sync completed
   data: { results: {...}, totalSynced: 15, ... }
   ```

### **3. Database Records**

**Verify data is being stored:**

```sql
-- Check total records
SELECT COUNT(*) FROM "MarketMatch";

-- Check by status
SELECT status, COUNT(*) FROM "MarketMatch" GROUP BY status;

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

## 🐛 **Troubleshooting**

### **Issue: 401 Unauthorized**

**Symptoms:**
- Response: `{ "error": "Unauthorized" }`
- Log: `🕐 CRON: Unauthorized market sync attempt`

**Fix:**
1. Check `CRON_SECRET` environment variable
2. Verify Authorization header: `Bearer snapbet-marketmatch`
3. Check `.env.local` file

### **Issue: 404 Not Found**

**Symptoms:**
- HTTP 404 error
- Endpoint not found

**Fix:**
1. Verify server is running: `npm run dev`
2. Check route file exists: `app/api/admin/market/sync-scheduled/route.ts`
3. Restart dev server

### **Issue: 500 Server Error**

**Symptoms:**
- Response: `{ "success": false, "error": "..." }`
- Log: `🕐 CRON: Market sync failed`

**Fix:**
1. Check `BACKEND_API_URL` is configured
2. Verify database connection
3. Check server console for detailed error
4. Review error message in response

### **Issue: No Data Collected**

**Symptoms:**
- `synced: 0` in response
- No records in database

**Fix:**
1. Check `BACKEND_API_URL` is correct
2. Verify API is accessible
3. Check API response manually
4. Review logs for API errors

### **Issue: All Matches Skipped**

**Symptoms:**
- `synced: 0`, `skipped: {high number}`

**This is Normal If:**
- Matches were synced recently (within sync interval)
- Completed matches (already FINISHED)

**To Test:**
- Wait for sync interval to pass (10 min for upcoming, 30s for live)
- Or manually update `lastSyncedAt` in database to old date

---

## 📊 **Expected Response Format**

### **Success Response**

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

### **Error Response**

```json
{
  "success": false,
  "error": "BACKEND_API_URL not configured",
  "duration": "12ms"
}
```

### **Unauthorized Response**

```json
{
  "error": "Unauthorized"
}
```

---

## ✅ **Success Criteria**

1. ✅ **Endpoint Returns 200 OK** with valid JSON
2. ✅ **Response Structure Matches** expected format
3. ✅ **Database Contains Records** in `MarketMatch` table
4. ✅ **Data Completeness** > 80% (odds, models present)
5. ✅ **No Errors** in response (`errors: 0`)
6. ✅ **Logs Present** in dev server console

---

## 🚀 **Quick Test Commands**

### **PowerShell:**
```powershell
# Test upcoming sync
$uri = "http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming"
$headers = @{Authorization="Bearer snapbet-marketmatch"}
Invoke-WebRequest -Uri $uri -Method GET -Headers $headers -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### **Bash/curl:**
```bash
curl -X GET "http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming" \
  -H "Authorization: Bearer snapbet-marketmatch" | jq .
```

### **Database Check:**
```sql
SELECT COUNT(*) as total_matches FROM "MarketMatch";
SELECT status, COUNT(*) FROM "MarketMatch" GROUP BY status;
```

---

**Status**: Ready to check logs  
**Next**: Run test command and check dev server console

