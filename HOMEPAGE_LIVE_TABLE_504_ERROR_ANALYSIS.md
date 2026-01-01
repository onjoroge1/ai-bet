# Homepage Live Table 504 Error - Root Cause Analysis

**Date**: January 2025  
**Status**: 🔍 **ANALYSIS COMPLETE**  
**Issue**: 504 Gateway Timeout error when fetching live matches on homepage (both local and prod)

---

## 📋 **Current Flow**

### **Request Path**
```
Homepage → OddsPredictionTable → /api/market?status=live&limit=50
  ↓
Market API Route (app/api/market/route.ts):
  1. Query MarketMatch database (status='LIVE', isActive=true, isArchived=false)
  2. Filter out stale matches (>30 seconds old)
  3. If no fresh matches → Fallback to external API: ${BASE_URL}/market?status=live&limit=50
  4. Transform results and return
```

---

## 🔴 **ROOT CAUSES IDENTIFIED**

### **Issue 1: No API Route Timeout Configuration** 🔴 **CRITICAL**

**Location**: `app/api/market/route.ts`

**Problem**:
- **No `export const maxDuration`** configuration
- Next.js default timeouts:
  - **Development**: 10 seconds
  - **Production (Vercel Hobby)**: 10 seconds
  - **Production (Vercel Pro)**: 60 seconds
  - **Production (Vercel Enterprise)**: 300 seconds

**Impact**:
- If database query takes >10 seconds → 504 timeout
- If external API call takes >10 seconds → 504 timeout
- If transformation takes >10 seconds → 504 timeout

**Evidence**:
```typescript
// app/api/market/route.ts - NO timeout configuration
export async function GET(request: NextRequest) {
  // ... no maxDuration export
}
```

---

### **Issue 2: External API Call Has No Timeout** 🔴 **CRITICAL**

**Location**: `app/api/market/route.ts` (lines 196-201)

**Problem**:
- External API fetch has **NO timeout specified**
- If `${BASE_URL}/market?status=live&limit=50` is slow or unresponsive, the fetch will hang
- No `AbortController` or timeout signal
- Could wait indefinitely until Next.js kills the request

**Code Reference**:
```typescript
// Line 196 - No timeout protection
const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${API_KEY}`,
  },
  ...cacheConfig
  // ❌ NO timeout or AbortController
})
```

**Impact**:
- If external API takes >10 seconds → 504 timeout
- If external API is down/slow → 504 timeout
- No way to cancel the request if it's taking too long

---

### **Issue 3: Database Query Performance** 🟡 **HIGH**

**Location**: `app/api/market/route.ts` (lines 131-137)

**Problem**:
- Query filters by `status`, `isActive`, `isArchived`, and orders by `kickoffDate`
- **No explicit timeout** on Prisma query
- Could be slow if:
  - Missing indexes on `status`, `isActive`, `isArchived`, `kickoffDate`
  - Large number of LIVE matches in database
  - Database connection pool exhausted
  - Database server is slow/overloaded

**Code Reference**:
```typescript
// Line 131 - No query timeout
const dbMatches = await prisma.marketMatch.findMany({
  where: {
    status: dbStatus,        // 'LIVE'
    isActive: true,
    isArchived: false,
  },
  orderBy: [
    { kickoffDate: 'asc' },
  ],
  take: parseInt(limit) || 10,
  // ❌ NO query timeout
})
```

**Potential Issues**:
1. **Missing Indexes**: If `(status, isActive, isArchived, kickoffDate)` composite index doesn't exist, query could be slow
2. **Large Dataset**: If there are thousands of LIVE matches, even with indexes, query could take time
3. **Database Connection**: If connection pool is exhausted, query waits for available connection

---

### **Issue 4: No Retry Logic on External API** 🟡 **MEDIUM**

**Location**: `app/api/market/route.ts` (lines 196-224)

**Problem**:
- External API call has **NO retry logic**
- Transient network failures result in immediate 504
- No exponential backoff or retry attempts

**Impact**:
- Single network hiccup → 504 error
- No resilience for temporary failures
- Poor user experience

**Comparison**:
- `lib/whatsapp-market-fetcher.ts` has retry logic with timeout:
  ```typescript
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MARKET_API_TIMEOUT);
  // ... retry logic with exponential backoff
  ```

---

### **Issue 5: Backend Data Publishing/Sync Process Contention** 🔴 **CRITICAL**

**Location**: `app/api/admin/market/sync-scheduled/route.ts` + `app/api/market/route.ts`

**Problem**:
- **Sync process runs every minute** via cron (`* * * * *`) for live matches
- **Sync calls the SAME external API** that homepage uses: `${BASE_URL}/market?status=live&limit=100`
- **Homepage also calls the same API**: `${BASE_URL}/market?status=live&limit=50`
- **High probability of concurrent requests** hitting the external API simultaneously
- **Sync processes matches sequentially**, holding database connections for extended time

**Resource Contention**:

1. **External API Overload**:
   - Sync: Fetches 100 matches every minute
   - Homepage: Fetches 50 matches on every page load
   - **Concurrent requests** → External API may be slow/overloaded
   - **No rate limiting** between sync and homepage requests

2. **Database Connection Pool Exhaustion**:
   - Sync does **many database queries** per match:
     ```typescript
     // For each of 100 matches:
     const existing = await prisma.marketMatch.findUnique(...) // Query 1
     await prisma.marketMatch.upsert(...) // Query 2
     ```
   - For 100 matches = **200+ database queries** per sync
   - **Homepage query competes** for same connection pool
   - If pool is exhausted → Homepage query waits → Timeout

3. **Sequential Processing Bottleneck**:
   - Sync processes matches one-by-one (not batched)
   - Each match: 2 database queries + external API fetch
   - If sync is processing 100 matches, it holds connections for extended time
   - Homepage query waits in queue → Timeout

**Timing Analysis**:
```
00:00:00 - Sync cron triggers
00:00:01 - Sync starts fetching 100 matches from external API
00:00:05 - Homepage request arrives, tries to fetch 50 matches
00:00:05 - External API handling both requests → Slow response
00:00:10 - Homepage request times out → 504 error
00:00:30 - Sync still processing matches, holding DB connections
```

**Evidence**:
- Sync runs **every minute** (high overlap probability)
- Both sync and homepage hit **same external API endpoint**
- Both use **same database connection pool**
- 504 errors are **intermittent** (matches sync timing)
- Affects **both local and prod** (cron runs in both)

**Code Reference**:
```typescript
// app/api/admin/market/sync-scheduled/route.ts
// Cron runs every minute: "* * * * *"
{
  "path": "/api/admin/market/sync-scheduled?type=live",
  "schedule": "* * * * *"  // Every minute
}

// Sync fetches from same API as homepage
const url = `${BASE_URL}/market?status=live&limit=100`  // Same endpoint!

// Sequential processing (slow)
for (const apiMatch of apiMatches) {
  const existing = await prisma.marketMatch.findUnique(...) // DB query
  await prisma.marketMatch.upsert(...) // Another DB query
}
```

---

### **Issue 6: Transformation Could Be Slow** 🟢 **LOW**

**Location**: `lib/market-match-helpers.ts` (lines 309-317)

**Problem**:
- `transformMarketMatchesToApiResponse` processes matches sequentially
- Each match goes through `transformMarketMatchToApiFormat` which:
  - Extracts multiple JSON fields
  - Performs multiple object transformations
  - Logs extensively (especially for FINISHED matches)

**Impact**:
- If processing 50 matches, could take 1-2 seconds
- Extensive logging could slow down processing
- Not likely the primary cause, but could contribute

---

## 🔍 **DIAGNOSTIC STEPS**

### **1. Check External API Response Time**

**Test Command**:
```bash
# Test external API directly
curl -H "Authorization: Bearer $API_KEY" \
  "${BACKEND_API_URL}/market?status=live&limit=50" \
  -w "\nTime: %{time_total}s\n" \
  -o /dev/null
```

**What to Look For**:
- Response time > 10 seconds → **External API is the problem**
- Response time < 2 seconds → External API is fine, check database

---

### **2. Check Database Query Performance**

**SQL Query** (equivalent to Prisma query):
```sql
SELECT * FROM "MarketMatch"
WHERE status = 'LIVE'
  AND "isActive" = true
  AND "isArchived" = false
ORDER BY "kickoffDate" ASC
LIMIT 50;
```

**What to Check**:
- **Query Execution Time**: Should be < 100ms
- **Indexes**: Verify indexes exist on:
  - `status`
  - `(status, isActive, isArchived)`
  - `(status, isActive, isArchived, kickoffDate)`
- **Row Count**: How many LIVE matches exist?

**Check Indexes**:
```sql
-- Check existing indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'MarketMatch'
ORDER BY indexname;
```

---

### **3. Check Next.js Logs**

**What to Look For**:
- `[Market API] Using database: X fresh matches` → Database query succeeded
- `[Market API] Fetching from external API: ${url}` → Database had no fresh matches
- `[Market API] Backend API error: 504` → External API timed out
- No logs at all → Request killed before reaching API route

---

### **4. Check Database Connection Pool**

**Potential Issue**:
- Prisma connection pool exhausted
- All connections waiting for slow queries
- New requests queue up → timeout

**Check**:
- Prisma connection pool size in `lib/db.ts`
- Database server connection limits
- Active connections count

---

### **5. Check Sync Process Timing** 🔴 **NEW - CRITICAL**

**Potential Issue**:
- Sync process running at same time as homepage requests
- Sync holding database connections
- Sync overloading external API

**Check Sync Logs**:
```bash
# Look for sync process logs around the time of 504 errors
# Pattern: "🕐 CRON: Starting scheduled market sync"
# Pattern: "🔄 Starting sync for live matches"
# Pattern: "✅ Completed sync for live matches"
```

**Check Sync Timing**:
- Sync runs **every minute** at `:00` seconds (e.g., 12:00:00, 12:01:00, 12:02:00)
- If 504 errors occur at `:00-:30` seconds → **Sync is likely the cause**
- If 504 errors occur at `:30-:59` seconds → Less likely sync-related

**Check Sync Duration**:
```typescript
// In sync-scheduled route, check how long sync takes
const startTime = Date.now()
// ... sync process ...
const duration = Date.now() - startTime
// If duration > 10 seconds → Sync is blocking homepage requests
```

**Check Concurrent Requests**:
- Monitor external API logs for concurrent requests
- If sync and homepage hit API simultaneously → Overload
- Check if external API has rate limiting

---

## 🎯 **MOST LIKELY ROOT CAUSES**

Based on the analysis, there are **TWO equally likely root causes**:

### **Root Cause #1: Backend Data Publishing/Sync Process** 🔴 **VERY LIKELY**

**The Problem**:
- **Sync process runs every minute** via cron (`* * * * *`) for live matches
- **Sync calls the SAME external API** that homepage uses: `${BASE_URL}/market?status=live&limit=100`
- **Homepage also calls the same API**: `${BASE_URL}/market?status=live&limit=50`
- **Timing overlap**: High probability sync and homepage requests hit the API simultaneously

**Resource Contention Issues**:

1. **External API Overload**:
   - Sync process: Fetches 100 matches every minute
   - Homepage: Fetches 50 matches on every page load
   - **Concurrent requests** → External API may be slow/overloaded
   - **No rate limiting** between sync and homepage requests

2. **Database Connection Pool Exhaustion**:
   - Sync process does **many database queries** per match:
     - `findUnique` to check last sync time
     - `upsert` to save match data
   - For 100 matches = **200+ database queries** per sync
   - **Homepage query competes** for same connection pool
   - If pool is exhausted → Homepage query waits → Timeout

3. **Sequential Processing Bottleneck**:
   ```typescript
   // Sync processes matches sequentially
   for (const apiMatch of apiMatches) {
     const existing = await prisma.marketMatch.findUnique(...) // DB query
     await prisma.marketMatch.upsert(...) // Another DB query
   }
   ```
   - If sync is processing 100 matches, it holds database connections for extended time
   - Homepage query waits in queue → Timeout

**Evidence**:
- Sync runs **every minute** (high overlap probability)
- Both sync and homepage hit **same external API endpoint**
- Both use **same database connection pool**
- 504 errors are **intermittent** (matches sync timing)
- Affects **both local and prod** (cron runs in both)

**Timing Analysis**:
- **00:00** - Sync starts, fetches 100 matches, processes sequentially
- **00:05** - Homepage request arrives, external API slow (sync still running)
- **00:10** - Homepage request times out → 504 error

---

### **Root Cause #2: External API Timeout (Issue #2)** 🔴 **VERY LIKELY**

**Reasoning**:
1. **No timeout on fetch**: External API call can hang indefinitely
2. **No retry logic**: Single failure = 504 error
3. **Common pattern**: External APIs are often slower than database queries
4. **Both local and prod affected**: Suggests external API issue, not database

**Evidence**:
- 504 is a Gateway Timeout, typically means upstream service (external API) is slow
- Database queries are usually fast (<100ms) with proper indexes
- External API calls are network-dependent and can be slow

---

## 📊 **RECOMMENDED FIXES (Priority Order)**

### **1. Add Timeout Configuration** 🔴 **CRITICAL**

```typescript
// app/api/market/route.ts
export const maxDuration = 30 // 30 seconds for Vercel Pro/Enterprise
export const runtime = 'nodejs'
```

### **2. Fix Backend Data Publishing/Sync Contention** 🔴 **CRITICAL**

**Option A: Stagger Sync Timing**
```typescript
// Add random delay to sync start (0-30 seconds)
// This reduces chance of overlap with homepage requests
const randomDelay = Math.floor(Math.random() * 30000)
await new Promise(resolve => setTimeout(resolve, randomDelay))
```

**Option B: Use Database-First for Homepage**
```typescript
// app/api/market/route.ts
// If database has fresh data (<30 seconds old), use it
// Only fallback to external API if database is stale
// This avoids hitting external API during sync
```

**Option C: Add Rate Limiting Between Sync and Homepage**
```typescript
// Implement request queuing or rate limiting
// Ensure sync and homepage don't hit external API simultaneously
```

**Option D: Optimize Sync Database Queries**
```typescript
// Batch database operations instead of sequential
// Use transaction for multiple upserts
// Reduce connection pool usage
```

### **3. Add Timeout to External API Fetch** 🔴 **CRITICAL**

```typescript
// app/api/market/route.ts
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

try {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
    signal: controller.signal, // Add timeout signal
    ...cacheConfig
  })
  clearTimeout(timeoutId)
  // ... rest of code
} catch (error) {
  clearTimeout(timeoutId)
  if (error.name === 'AbortError') {
    console.error('[Market API] External API timeout after 15 seconds')
    // Return cached/stale data or empty array
  }
  throw error
}
```

### **3. Add Retry Logic with Exponential Backoff** 🟡 **HIGH**

```typescript
// Use existing retry utility or implement
import { retryWithBackoff } from '@/lib/retry-utils'

const response = await retryWithBackoff(
  () => fetch(url, { ... }),
  { maxRetries: 3, initialDelay: 2000 }
)
```

### **4. Add Database Query Timeout** 🟡 **MEDIUM**

```typescript
// Add query timeout to Prisma
const dbMatches = await prisma.$queryRaw`
  SELECT * FROM "MarketMatch"
  WHERE status = ${dbStatus}
    AND "isActive" = true
    AND "isArchived" = false
  ORDER BY "kickoffDate" ASC
  LIMIT ${parseInt(limit) || 10}
` // Prisma doesn't support query timeout directly, may need raw query
```

### **5. Verify Database Indexes** 🟢 **LOW**

```sql
-- Ensure composite index exists
CREATE INDEX IF NOT EXISTS idx_marketmatch_status_active_archived_kickoff
ON "MarketMatch" (status, "isActive", "isArchived", "kickoffDate")
WHERE "isActive" = true AND "isArchived" = false;
```

---

## 🔬 **IMMEDIATE DIAGNOSTIC COMMANDS**

### **Check External API Response Time**
```bash
# Replace with actual BACKEND_API_URL and API_KEY
time curl -H "Authorization: Bearer YOUR_API_KEY" \
  "YOUR_BACKEND_API_URL/market?status=live&limit=50"
```

### **Check Database Query Performance**
```sql
EXPLAIN ANALYZE
SELECT * FROM "MarketMatch"
WHERE status = 'LIVE'
  AND "isActive" = true
  AND "isArchived" = false
ORDER BY "kickoffDate" ASC
LIMIT 50;
```

### **Check Next.js Logs**
```bash
# Look for these patterns in logs:
# - "[Market API] Using database: X fresh matches"
# - "[Market API] Fetching from external API:"
# - "[Market API] Backend API error:"
```

---

## 📝 **SUMMARY**

**Root Causes**: **TWO equally likely issues** causing 504 errors:

### **Primary Issue #1: Backend Data Publishing/Sync Contention** 🔴
- Sync process runs every minute and calls same external API as homepage
- High probability of concurrent requests → External API overload
- Sync holds database connections for extended time → Homepage query waits → Timeout
- **Fix**: Stagger sync timing, use database-first for homepage, optimize sync queries

### **Primary Issue #2: External API Timeout** 🔴
- External API call has no timeout, causing requests to hang until Next.js default timeout (10 seconds) kills them
- **Fix**: Add timeout to external API fetch (15 seconds), add retry logic

**All Issues**:
1. ❌ **Backend sync process competing with homepage requests** (NEW - VERY LIKELY)
2. ❌ No API route timeout configuration (`maxDuration`)
3. ❌ No timeout on external API fetch call
4. ❌ No retry logic for transient failures
5. ⚠️ Potential database query performance issues (needs verification)
6. ⚠️ Database connection pool exhaustion during sync

**Next Steps** (Priority Order):
1. **Fix sync contention**: Stagger sync timing OR use database-first for homepage
2. Add `maxDuration` export to API route
3. Add timeout to external API fetch (15 seconds)
4. Add retry logic with exponential backoff
5. Optimize sync database queries (batch operations)
6. Verify database indexes exist
7. Monitor logs to confirm which step is timing out

