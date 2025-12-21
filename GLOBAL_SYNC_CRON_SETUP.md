# 🕐 Global Match Sync - Cron Job Setup

**Date**: December 2025  
**Status**: ✅ **COMPLETED**

---

## 📋 Summary

Successfully added Global Match Sync to the automated cron job system. The sync will now run automatically every 2 hours to discover new matches, enrich existing ones, and keep the QuickPurchase table up-to-date.

---

## ✅ Implementation

### **1. Created Scheduled Endpoint**

**File**: `app/api/admin/predictions/sync-from-availability-scheduled/route.ts`

- **Purpose**: Endpoint called by Vercel Cron for automated sync
- **Authentication**: Uses `CRON_SECRET` instead of user sessions
- **Function**: Calls the main sync endpoint internally with proper authentication

### **2. Updated Main Sync Endpoint**

**File**: `app/api/admin/predictions/sync-from-availability/route.ts`

- **Added**: Support for `CRON_SECRET` authentication (in addition to admin session)
- **Behavior**: Can now be called by both:
  - Manual admin requests (with session)
  - Automated cron jobs (with CRON_SECRET)

### **3. Updated Middleware**

**File**: `middleware.ts`

- **Added**: `/api/admin/predictions/sync-from-availability-scheduled` to cron endpoints list
- **Result**: Middleware allows CRON_SECRET authentication for this endpoint

### **4. Updated Vercel Cron Configuration**

**File**: `vercel.json`

- **Added**: New cron job entry:
  ```json
  {
    "path": "/api/admin/predictions/sync-from-availability-scheduled",
    "schedule": "0 */2 * * *"  // Every 2 hours
  }
  ```

---

## ⏰ Schedule

### **Cron Schedule**: `0 */2 * * *`

- **Frequency**: Every 2 hours
- **Times**: 00:00, 02:00, 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
- **Rationale**: 
  - Frequent enough to keep data fresh
  - Not too frequent to avoid API rate limits
  - Balances between discovery and enrichment

---

## 🔄 How It Works

### **Automated Flow**:

```
1. Vercel Cron triggers at scheduled time
   └─ Calls: /api/admin/predictions/sync-from-availability-scheduled

2. Scheduled Endpoint
   ├─ Validates CRON_SECRET
   ├─ Calls main sync endpoint internally
   └─ Returns results

3. Main Sync Endpoint
   ├─ Validates CRON_SECRET (from scheduled endpoint)
   ├─ Calls /consensus/sync API (discovers new matches)
   ├─ Queries database (finds existing matches needing enrichment)
   ├─ Checks availability API (filters to ready matches)
   ├─ Processes matches:
   │  ├─ Creates new QuickPurchase records
   │  └─ Enriches existing records
   └─ Returns summary
```

---

## 🔐 Authentication

### **For Cron Jobs**:
- Uses `CRON_SECRET` environment variable
- Vercel automatically sends `Authorization: Bearer {CRON_SECRET}` header
- Middleware validates and allows request through

### **For Manual Requests**:
- Uses admin session authentication
- Requires user to be logged in as admin
- Same endpoint, different authentication method

---

## 📊 Expected Results

### **Every 2 Hours, the Cron Job Will**:

1. **Discover New Matches**:
   - Call `/consensus/sync` API (last 5 days)
   - Find matches not in QuickPurchase table
   - Create new QuickPurchase records with prediction data

2. **Enrich Existing Matches**:
   - Query database for matches without predictionData
   - Check availability API for ready matches
   - Enrich matches with prediction data

3. **Log Results**:
   - Number of matches created
   - Number of matches enriched
   - Number of matches skipped (already complete)
   - Processing time and errors

---

## 🧪 Testing

### **Local Testing**:

```powershell
# Test the scheduled endpoint manually
$uri = "http://localhost:3000/api/admin/predictions/sync-from-availability-scheduled"
$headers = @{Authorization="Bearer 749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb"}
Invoke-WebRequest -Uri $uri -Method GET -Headers $headers
```

**Expected**: ✅ 200 OK with sync results

### **Production Testing**:

1. Deploy to Vercel
2. Wait for scheduled time (or check Vercel logs)
3. Verify logs show:
   - `🕐 CRON: Starting scheduled global match sync`
   - `🕐 CRON: Scheduled global match sync completed`
4. Check database for new/enriched QuickPurchase records

---

## 📝 Logging

### **Cron-Specific Logs**:

- `🕐 CRON: Starting scheduled global match sync`
- `🕐 CRON: Calling global sync endpoint`
- `🕐 CRON: Scheduled global match sync completed`
- `🕐 CRON: Global sync failed` (on errors)

### **Sync Logs** (from main endpoint):

- `Starting global availability sync` (with `source: 'cron'`)
- `Categorized matches from consensus and database`
- `DIAGNOSTIC: Consensus vs Database match comparison`
- `DIAGNOSTIC: Consensus vs Availability API comparison`
- `Global sync completed`

---

## ⚙️ Configuration

### **Environment Variables Required**:

```env
# Cron Authentication
CRON_SECRET=749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb

# Backend APIs
BACKEND_URL=https://your-backend-url.com
BACKEND_API_KEY=your-api-key
CONSENSUS_API_KEY=your-consensus-key

# Database
DATABASE_URL=your-database-url

# Redis (for caching)
REDIS_URL=your-redis-url
REDIS_TOKEN=your-redis-token
```

---

## 📈 Monitoring

### **Vercel Dashboard**:

1. Go to Vercel Dashboard → Your Project
2. Click **Functions** tab
3. Find `/api/admin/predictions/sync-from-availability-scheduled`
4. View **Logs** tab for execution history
5. Check **Cron** tab for schedule status

### **Key Metrics to Monitor**:

- **Execution Frequency**: Should run every 2 hours
- **Success Rate**: Should be > 95%
- **Processing Time**: Typically 1-5 minutes
- **Matches Created**: Number of new matches per run
- **Matches Enriched**: Number of existing matches enriched per run

---

## 🔧 Troubleshooting

### **Issue: Cron Job Not Running**

**Check**:
1. Vercel Pro/Enterprise plan (required for cron jobs)
2. `CRON_SECRET` set in Vercel environment variables
3. `vercel.json` deployed correctly
4. Vercel logs for errors

### **Issue: Unauthorized Errors**

**Check**:
1. `CRON_SECRET` matches in both Vercel and code
2. Middleware includes endpoint in `cronEndpoints` array
3. Authorization header format: `Bearer {CRON_SECRET}`

### **Issue: No Matches Found**

**Check**:
1. Diagnostic logs for consensus vs database comparison
2. Database has matches needing enrichment
3. Consensus API returns matches
4. Availability API shows ready matches

---

## 📚 Related Documentation

- [AUTOMATED_SCHEDULER_EXPLANATION.md](./AUTOMATED_SCHEDULER_EXPLANATION.md) - How Vercel Cron works
- [UNIFIED_GLOBAL_SYNC_IMPLEMENTATION.md](./UNIFIED_GLOBAL_SYNC_IMPLEMENTATION.md) - Unified sync implementation
- [GLOBAL_SYNC_DATABASE_FALLBACK_FIX.md](./GLOBAL_SYNC_DATABASE_FALLBACK_FIX.md) - Database fallback fix

---

## ✅ Checklist

- [x] Created scheduled endpoint
- [x] Updated main sync endpoint to accept CRON_SECRET
- [x] Added endpoint to middleware cron list
- [x] Added cron job to vercel.json
- [x] Set schedule to every 2 hours
- [x] Added comprehensive logging
- [x] Tested authentication flow
- [x] Documented setup and monitoring

---

**Status**: ✅ **READY FOR DEPLOYMENT**  
**Next Steps**: Deploy to Vercel and monitor first few executions

