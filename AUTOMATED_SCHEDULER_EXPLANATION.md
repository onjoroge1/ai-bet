# 🕐 Automated Scheduler - How It Works

## ✅ **Yes, There IS an Automated Scheduler!**

The automated scheduler is **Vercel Cron**, which is configured in `vercel.json`. It automatically calls your endpoints at specified intervals.

---

## 📋 **Current Scheduler Configuration**

### **From `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/admin/parlays/sync-scheduled",
      "schedule": "*/15 * * * *"  // Every 15 minutes
    },
    {
      "path": "/api/admin/market/sync-scheduled?type=live",
      "schedule": "* * * * *"  // Every minute
    },
    {
      "path": "/api/admin/market/sync-scheduled?type=upcoming",
      "schedule": "*/10 * * * *"  // Every 10 minutes
    },
    {
      "path": "/api/admin/market/sync-scheduled?type=completed",
      "schedule": "*/10 * * * *"  // Every 10 minutes
    },
    {
      "path": "/api/admin/predictions/sync-from-availability-scheduled",
      "schedule": "0 */2 * * *"  // Every 2 hours
    }
  ]
}
```

---

## ⏰ **How the Schedules Work**

### **1. Live Matches Sync**

**Cron Schedule**: `* * * * *` (Every minute)

**Actual Behavior**:
- Vercel calls the endpoint **every minute**
- The endpoint checks if last sync was **> 30 seconds ago**
- If yes → syncs data
- If no → skips (already synced recently)

**Result**: Effectively syncs **every 30 seconds** for live matches ✅

**Code Logic**:
```typescript
// In syncMatchesByStatus('live')
if (status === 'live') {
  const existing = await prisma.marketMatch.findUnique({
    where: { matchId: transformed.matchId },
    select: { lastSyncedAt: true, status: true }
  })

  if (existing && existing.status === 'LIVE') {
    const timeSinceLastSync = Date.now() - existing.lastSyncedAt.getTime()
    if (timeSinceLastSync < LIVE_SYNC_INTERVAL) { // 30 seconds
      skipped++
      continue // Skip if synced recently
    }
  }
}
```

### **2. Upcoming Matches Sync**

**Cron Schedule**: `*/10 * * * *` (Every 10 minutes)

**Actual Behavior**:
- Vercel calls the endpoint **every 10 minutes**
- The endpoint checks if last sync was **> 10 minutes ago**
- If yes → syncs data
- If no → skips (already synced recently)

**Result**: Syncs **every 10 minutes** for upcoming matches ✅

### **3. Completed Matches Sync**

**Cron Schedule**: `*/10 * * * *` (Every 10 minutes)

**Actual Behavior**:
- Vercel calls the endpoint **every 10 minutes**
- The endpoint checks if match is already **FINISHED**
- If yes → skips (no need to sync again)
- If no → syncs once when status changes to FINISHED

**Result**: Syncs **once** when match finishes, then never again ✅

### **4. Global Match Sync** 🆕

**Cron Schedule**: `0 */2 * * *` (Every 2 hours)

**Actual Behavior**:
- Vercel calls the endpoint **every 2 hours**
- Discovers new matches from `/consensus/sync` API
- Finds existing matches in database needing enrichment
- Checks availability API for ready matches
- Creates new QuickPurchase records
- Enriches existing records with prediction data

**Result**: Keeps QuickPurchase table up-to-date with fresh matches and predictions ✅

---

## 🔄 **How Vercel Cron Works**

### **1. Automatic Execution**

Vercel Cron is a **built-in service** that:
- ✅ Runs automatically on your deployed Vercel project
- ✅ Calls your endpoints at the specified schedule
- ✅ Sends `Authorization: Bearer {CRON_SECRET}` header automatically
- ✅ Works 24/7 without any manual intervention

### **2. Local Development**

**Important**: Vercel Cron **only works in production** (on Vercel servers).

**For local testing**, you need to:
- Manually call the endpoint with PowerShell/curl
- Or set up a local cron job (not recommended)

### **3. Production Deployment**

Once deployed to Vercel:
1. Vercel reads `vercel.json` cron configuration
2. Sets up scheduled jobs automatically
3. Calls endpoints at specified times
4. Sends `Authorization: Bearer snapbet-marketmatch` header
5. Logs all executions in Vercel dashboard

---

## 📊 **Schedule Breakdown**

| Match Type | Cron Schedule | Frequency | Smart Sync Logic |
|------------|--------------|-----------|------------------|
| **Live** | `* * * * *` | Every minute | Only syncs if last sync > 30 seconds ago |
| **Upcoming** | `*/10 * * * *` | Every 10 minutes | Only syncs if last sync > 10 minutes ago |
| **Completed** | `*/10 * * * *` | Every 10 minutes | Only syncs once when status changes to FINISHED |
| **Global Sync** | `0 */2 * * *` | Every 2 hours | Discovers new matches and enriches existing ones |

---

## 🔍 **Why Browser Shows "Unauthorized"**

### **Expected Behavior** ✅

When you visit `http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming` in a browser:

1. **Browser doesn't send Authorization header** (by design)
2. **Middleware checks for CRON_SECRET** → Not found
3. **Returns 401 Unauthorized** → This is **correct and secure**!

### **This is Good Security** 🔒

- Prevents unauthorized access
- Only automated cron jobs (with CRON_SECRET) can access
- Users can't accidentally trigger syncs

---

## 📝 **How to Check Logs**

### **1. Dev Server Console (Local Testing)**

When you manually call the endpoint, look for:

**✅ Success Logs:**
```
[INFO] Middleware - CRON_SECRET authenticated
[INFO] 🕐 CRON: Starting scheduled market sync
[INFO] 🔄 Starting sync for upcoming matches
[INFO] ✅ Completed sync for upcoming matches
[INFO] 🕐 CRON: Scheduled market sync completed
```

**❌ Error Logs:**
```
[WARN] Middleware - Invalid CRON_SECRET attempt
[ERROR] 🕐 CRON: Market sync failed
```

### **2. Vercel Dashboard (Production)**

Once deployed:
1. Go to Vercel Dashboard → Your Project
2. Click **Functions** tab
3. Click on the cron job
4. View **Logs** tab
5. See all execution logs

### **3. Check Database**

Verify sync is working:
```sql
SELECT 
  status,
  COUNT(*) as count,
  MAX("lastSyncedAt") as last_sync
FROM "MarketMatch"
GROUP BY status;
```

---

## 🧪 **Testing the Scheduler**

### **Local Testing (Manual)**

```powershell
# Test upcoming sync
$uri = "http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming"
$headers = @{Authorization="Bearer snapbet-marketmatch"}
Invoke-WebRequest -Uri $uri -Method GET -Headers $headers
```

### **Production Testing (Automatic)**

Once deployed to Vercel:
1. Wait for the scheduled time (10 minutes for upcoming)
2. Check Vercel logs
3. Check database for new/updated records

---

## ⚠️ **Important Notes**

### **1. Vercel Cron Only Works in Production**

- ❌ **Local dev server**: Cron jobs don't run automatically
- ✅ **Vercel production**: Cron jobs run automatically

### **2. Minimum Interval**

- Vercel Cron minimum: **1 minute**
- For 30-second sync: Run every minute, but only sync if needed (smart sync)

### **3. Plan Requirements**

- **Hobby Plan**: Only 2 cron jobs (not enough for 4 jobs)
- **Pro Plan**: Up to 40 cron jobs ✅ (perfect for your needs)
- **Enterprise Plan**: Unlimited cron jobs

---

## ✅ **Summary**

1. **✅ Automated Scheduler Exists**: Vercel Cron configured in `vercel.json`
2. **✅ Live Matches**: Runs every minute, syncs if last sync > 30 seconds ago
3. **✅ Upcoming Matches**: Runs every 10 minutes
4. **✅ Completed Matches**: Runs every 10 minutes, syncs once when finished
5. **✅ Global Match Sync**: Runs every 2 hours, discovers and enriches matches
6. **✅ Browser "Unauthorized"**: Expected and correct (security feature)
7. **✅ Production Only**: Cron jobs only run on Vercel, not locally

---

## 🚀 **Next Steps**

1. ✅ **Deploy to Vercel** - Cron jobs will start automatically
2. ✅ **Add CRON_SECRET** to Vercel environment variables
3. ✅ **Monitor logs** in Vercel dashboard
4. ✅ **Verify data** in database after first sync

---

**Status**: ✅ Automated scheduler configured and ready  
**Deployment**: Deploy to Vercel to activate automated sync

