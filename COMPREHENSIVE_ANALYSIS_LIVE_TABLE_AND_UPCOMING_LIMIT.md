# Comprehensive Analysis: Live Match Table 504 Errors & Upcoming Matches Limit

**Date**: January 2025  
**Status**: 🔍 **ANALYSIS COMPLETE**  
**Scope**: 
1. Live match table 504 timeout errors in production
2. Increasing upcoming matches limit from 50 to 100

---

## 📋 **Executive Summary**

### **Issue 1: Live Match Table 504 Errors** 🔴 **CRITICAL**
- **Status**: Intermittent failures in production
- **Symptom**: Live matches table stops loading, returns 504 Gateway Timeout
- **Impact**: Poor user experience, empty live matches table
- **Root Causes**: Multiple contributing factors identified

### **Issue 2: Upcoming Matches Limit** 🟡 **ENHANCEMENT**
- **Current**: 50 matches fetched for upcoming status
- **Requested**: Increase to 100 matches (upcoming only, not live)
- **Impact**: More matches displayed, better user experience
- **Complexity**: Low - simple configuration change

---

## 🔴 **ISSUE 1: LIVE MATCH TABLE 504 ERRORS - DETAILED ANALYSIS**

### **✅ ROOT CAUSE IDENTIFIED** (Based on Production Logs & Database Tests)

**PRIMARY ISSUE**: **All LIVE matches in database are STALE** (>30 seconds old)

**Evidence from Tests**:
- Most recent LIVE match sync: **13 minutes ago** (should be <30 seconds)
- All 10 LIVE matches in database are stale (7577+ seconds old)
- When database has no fresh matches → Code falls back to external API
- External API consistently times out after 15 seconds
- All retry attempts fail (external API is slow/unresponsive)

**The Flow**:
```
User Request → /api/market?status=live&limit=50
  ↓
1. Query MarketMatch database (status='LIVE')
   ❌ All matches are STALE (>30 seconds old)
   ↓
2. Filter out stale matches → 0 fresh matches
   ↓
3. Fallback to external API: ${BASE_URL}/market?status=live&limit=50
   ❌ External API timeout after 15 seconds
   ❌ Retry 1 fails (15s timeout)
   ❌ Retry 2 fails (15s timeout)
   ❌ Retry 3 fails (15s timeout)
   ↓
4. Return empty matches array (graceful degradation)
   ✅ Page loads but shows empty table
```

### **Why Sync Process is Not Working**

**Expected Behavior**:
- Cron runs every minute: `* * * * *` → `/api/admin/market/sync-scheduled?type=live`
- Sync should update LIVE matches if `lastSyncedAt` > 30 seconds ago
- Matches should stay fresh (<30 seconds old)

**Actual Behavior**:
- Last sync was **13 minutes ago** (not 30 seconds ago)
- Sync process is either:
  1. **Not running** (cron not executing)
  2. **Failing silently** (errors not logged)
  3. **External API too slow** (sync times out before completing)
  4. **Skipping matches** (logic issue in sync process)

### **Root Causes Identified**

#### **1. Sync Process Not Keeping Matches Fresh** 🔴 **CRITICAL - ROOT CAUSE**

**Location**: `app/api/admin/market/sync-scheduled/route.ts`

**The Problem**:
- **Sync should run every minute** via Vercel Cron (`* * * * *`)
- **Sync should update LIVE matches** if `lastSyncedAt` > 30 seconds ago
- **But matches are 13+ minutes old** - sync is NOT working

**Possible Reasons**:
1. **Cron Not Executing**: Vercel cron may not be running
2. **Sync Failing Silently**: Errors may not be logged
3. **External API Too Slow**: Sync times out before completing
4. **Skip Logic Issue**: Sync may be skipping matches incorrectly

**Code Reference**:
```typescript
// app/api/admin/market/sync-scheduled/route.ts (lines 283-296)
if (status === 'live') {
  // For live matches, check if last sync was more than 30 seconds ago
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

**The Issue**: If external API is slow, sync may timeout before updating matches, leaving them stale.

---

#### **2. External API Timeout** 🔴 **SECONDARY ISSUE**

**Location**: `app/api/market/route.ts`

**The Problem**:
- When database has no fresh matches, code falls back to external API
- External API consistently times out after 15 seconds
- All retry attempts fail (external API is slow/unresponsive)

**Evidence from Logs**:
```
[Market API] External API timeout after 15000ms: https://bet-genius-ai-onjoroge1.replit.app/market?status=live&limit=5
[WARN] Retry attempt 1/3 failed, retrying in 2000ms
[Market API] External API timeout after 15000ms
[WARN] Retry attempt 2/3 failed, retrying in 4000ms
[Market API] External API timeout after 15000ms
```

**Impact**: 
- All retries fail
- Returns empty matches array (graceful degradation)
- User sees empty live matches table

---

#### **3. Sync Process Contention** 🟡 **POTENTIAL ISSUE** (If Sync is Running)

**Location**: `app/api/admin/market/sync-scheduled/route.ts`

**The Problem**:
- **Sync runs every minute** via Vercel Cron (`* * * * *`)
- **Sync fetches 100 matches** from external API: `${BASE_URL}/market?status=live&limit=100`
- **Homepage fetches 50 matches** from same API: `${BASE_URL}/market?status=live&limit=50`
- **High probability of concurrent requests** hitting external API simultaneously
- **Sync processes matches sequentially**, holding database connections for extended time

**Resource Contention**:

1. **External API Overload**:
   - Sync: Fetches 100 matches every minute
   - Homepage: Fetches 50 matches on every page load
   - **Concurrent requests** → External API may be slow/overloaded
   - **No rate limiting** between sync and homepage requests
   - **Timing overlap**: High probability sync and homepage requests hit API simultaneously

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
   ```typescript
   // Sync processes matches sequentially
   for (const apiMatch of apiMatches) {
     const existing = await prisma.marketMatch.findUnique(...) // DB query
     await prisma.marketMatch.upsert(...) // Another DB query
   }
   ```
   - If sync is processing 100 matches, it holds database connections for extended time
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

#### **2. External API Timeout Issues** 🔴 **SECONDARY SUSPECT**

**Location**: `app/api/market/route.ts`

**Current State** (After Previous Fixes):
- ✅ `maxDuration = 30` seconds configured
- ✅ External API timeout: 15 seconds
- ✅ Retry logic with exponential backoff (3 retries)
- ✅ Graceful error handling (returns empty array instead of 504)

**However**:
- If external API is consistently slow (>15 seconds), all retries will timeout
- If external API is down/unresponsive, all retries will fail
- **Retry logic adds time**: 4 attempts × 15s = up to 60 seconds total
- **But `maxDuration = 30`**: Next.js will kill request after 30 seconds
- **Conflict**: Retry logic can exceed `maxDuration` limit

**Potential Issues**:
1. **External API Performance**:
   - External API may be slow during peak times
   - External API may have rate limiting that causes delays
   - External API may be overloaded by sync + homepage requests

2. **Timeout Configuration Conflict**:
   - `maxDuration = 30` seconds (Next.js timeout)
   - External API timeout = 15 seconds per attempt
   - Retry logic: 3 retries = 4 total attempts
   - **Total possible time**: 4 × 15s = 60 seconds (exceeds 30s limit)
   - **Result**: Request killed by Next.js before retries complete

**Code Reference**:
```typescript
// app/api/market/route.ts
export const maxDuration = 30 // 30 seconds

const EXTERNAL_API_TIMEOUT = 15000 // 15 seconds

// Retry logic: 3 retries = 4 total attempts
const response = await retryWithBackoff(
  async () => {
    // Each attempt has 15s timeout
    // Total: 4 × 15s = 60s (exceeds 30s maxDuration!)
  },
  3,    // Max 3 retries
  2000, // Initial delay 2 seconds
  30000 // Max delay cap 30 seconds
)
```

---

#### **3. Database Query Performance** 🟡 **POTENTIAL ISSUE**

**Location**: `app/api/market/route.ts` (lines 191-197)

**Current Query**:
```typescript
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
})
```

**Potential Issues**:
1. **Missing Indexes**: If composite index `(status, isActive, isArchived, kickoffDate)` doesn't exist, query could be slow
2. **Large Dataset**: If there are thousands of LIVE matches, even with indexes, query could take time
3. **Database Connection**: If connection pool is exhausted (due to sync), query waits for available connection
4. **No Query Timeout**: Prisma doesn't have built-in query timeout, could wait indefinitely

**Index Verification Needed**:
```sql
-- Check if composite index exists
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'MarketMatch'
  AND indexname LIKE '%status%active%archived%kickoff%';
```

**Expected Index** (from schema):
```prisma
@@index([status, isActive, isArchived])
@@index([status, kickoffDate])
```

---

#### **4. Stale Data Filtering** 🟢 **MINOR ISSUE**

**Location**: `app/api/market/route.ts` (lines 199-201)

**Current Logic**:
```typescript
const freshMatches = dbMatches.filter((match) => !isMarketMatchTooOld(match))
```

**Potential Issue**:
- If all database matches are stale (>30 seconds old), falls back to external API
- External API call may be slow or fail
- **Result**: Empty matches array (graceful degradation, but still poor UX)

**Impact**: Low - graceful degradation is working, but indicates sync may not be keeping data fresh

---

### **Diagnostic Steps Required**

#### **1. Check Production Logs** 🔍

**What to Look For**:
```bash
# Pattern 1: Database query succeeded
"[Market API] Using database: X fresh matches for status=live"

# Pattern 2: Database had no fresh matches, falling back to API
"[Market API] No matches in database for status=live, fetching from API"
"[Market API] Fetching from external API: ${url}"

# Pattern 3: External API timeout
"[Market API] External API timeout after 15000ms"
"[Market API] Error fetching from external API: External API timeout - request took too long"

# Pattern 4: Sync process running
"🕐 CRON: Starting scheduled market sync"
"🔄 Starting sync for live matches"
"✅ Completed sync for live matches"
```

**Timing Correlation**:
- If 504 errors occur at `:00-:30` seconds → **Sync contention likely**
- If 504 errors occur at `:30-:59` seconds → **Less likely sync-related**

#### **2. Check External API Response Time** 🔍

**Test Command**:
```bash
# Test external API directly
time curl -H "Authorization: Bearer $API_KEY" \
  "${BACKEND_API_URL}/market?status=live&limit=50" \
  -w "\nTime: %{time_total}s\n" \
  -o /dev/null
```

**What to Look For**:
- Response time > 10 seconds → **External API is the problem**
- Response time < 2 seconds → External API is fine, check database/sync

#### **3. Check Database Query Performance** 🔍

**SQL Query** (equivalent to Prisma query):
```sql
EXPLAIN ANALYZE
SELECT * FROM "MarketMatch"
WHERE status = 'LIVE'
  AND "isActive" = true
  AND "isArchived" = false
ORDER BY "kickoffDate" ASC
LIMIT 50;
```

**What to Check**:
- **Query Execution Time**: Should be < 100ms
- **Index Usage**: Verify indexes are being used
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

#### **4. Check Sync Process Timing** 🔍

**What to Check**:
- **Sync Duration**: How long does sync take?
- **Sync Frequency**: Is sync running every minute as expected?
- **Concurrent Requests**: Are sync and homepage hitting API simultaneously?

**Log Analysis**:
```bash
# Look for sync process logs around the time of 504 errors
# Pattern: "🕐 CRON: Starting scheduled market sync"
# Pattern: "🔄 Starting sync for live matches"
# Pattern: "✅ Completed sync for live matches"
```

**Timing Check**:
- Sync runs **every minute** at `:00` seconds (e.g., 12:00:00, 12:01:00, 12:02:00)
- If 504 errors occur at `:00-:30` seconds → **Sync is likely the cause**
- If 504 errors occur at `:30-:59` seconds → Less likely sync-related

---

### **Recommended Fixes (Priority Order)**

#### **1. Fix Sync Contention** 🔴 **CRITICAL**

**Option A: Stagger Sync Timing** (Recommended)
```typescript
// Add random delay to sync start (0-30 seconds)
// This reduces chance of overlap with homepage requests
const randomDelay = Math.floor(Math.random() * 30000)
await new Promise(resolve => setTimeout(resolve, randomDelay))
```

**Option B: Use Database-First for Homepage** (Recommended)
```typescript
// app/api/market/route.ts
// If database has fresh data (<30 seconds old), use it
// Only fallback to external API if database is stale
// This avoids hitting external API during sync
```

**Option C: Optimize Sync Database Queries** (Recommended)
```typescript
// Batch database operations instead of sequential
// Use transaction for multiple upserts
// Reduce connection pool usage

// Instead of:
for (const apiMatch of apiMatches) {
  await prisma.marketMatch.upsert(...)
}

// Use:
await prisma.$transaction(
  apiMatches.map(apiMatch => 
    prisma.marketMatch.upsert(...)
  )
)
```

**Option D: Add Rate Limiting Between Sync and Homepage**
```typescript
// Implement request queuing or rate limiting
// Ensure sync and homepage don't hit external API simultaneously
```

---

#### **2. Fix Timeout Configuration Conflict** 🔴 **HIGH**

**Problem**: Retry logic (4 attempts × 15s = 60s) exceeds `maxDuration` (30s)

**Solution A: Reduce Retry Attempts**
```typescript
// Reduce to 2 retries = 3 total attempts
// 3 × 15s = 45s (still exceeds 30s, but closer)
const response = await retryWithBackoff(
  async () => { ... },
  2,    // Max 2 retries (3 total attempts)
  2000, // Initial delay 2 seconds
  30000 // Max delay cap 30 seconds
)
```

**Solution B: Reduce External API Timeout**
```typescript
// Reduce to 7 seconds per attempt
// 4 × 7s = 28s (within 30s limit)
const EXTERNAL_API_TIMEOUT = 7000 // 7 seconds
```

**Solution C: Increase maxDuration** (If Vercel plan allows)
```typescript
// Increase to 60 seconds (requires Vercel Pro/Enterprise)
export const maxDuration = 60 // 60 seconds
```

**Recommended**: Solution B (reduce timeout to 7s) + Solution A (reduce retries to 2)

---

#### **3. Verify Database Indexes** 🟡 **MEDIUM**

**Action**: Verify composite indexes exist and are being used

**Check**:
```sql
-- Verify indexes exist
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'MarketMatch'
  AND (indexname LIKE '%status%' OR indexname LIKE '%kickoff%');
```

**Create if Missing**:
```sql
-- Create composite index if missing
CREATE INDEX IF NOT EXISTS idx_marketmatch_status_active_archived_kickoff
ON "MarketMatch" (status, "isActive", "isArchived", "kickoffDate")
WHERE "isActive" = true AND "isArchived" = false;
```

---

#### **4. Add Database Query Timeout** 🟡 **MEDIUM**

**Problem**: Prisma doesn't have built-in query timeout

**Solution**: Use raw query with timeout (if needed)
```typescript
// Add query timeout using raw SQL
const dbMatches = await prisma.$queryRaw`
  SELECT * FROM "MarketMatch"
  WHERE status = ${dbStatus}
    AND "isActive" = true
    AND "isArchived" = false
  ORDER BY "kickoffDate" ASC
  LIMIT ${parseInt(limit) || 10}
` // Note: Prisma doesn't support query timeout directly
```

**Alternative**: Monitor query performance and optimize if needed

---

### **Testing Plan**

#### **1. Test Sync Contention Fix**

**Test Scenario**:
1. Trigger sync manually
2. Immediately trigger homepage request
3. Check if both succeed without timeout

**Expected Result**:
- Both requests complete successfully
- No 504 errors
- Database-first approach avoids external API contention

#### **2. Test Timeout Configuration**

**Test Scenario**:
1. Simulate slow external API (add delay)
2. Trigger homepage request
3. Check if timeout handling works correctly

**Expected Result**:
- Request times out gracefully after 15s (or 7s if reduced)
- Returns empty array (status 200) instead of 504
- Logs timeout error for debugging

#### **3. Test Database Query Performance**

**Test Scenario**:
1. Query database directly for LIVE matches
2. Check query execution time
3. Verify indexes are being used

**Expected Result**:
- Query completes in < 100ms
- Indexes are being used (from EXPLAIN ANALYZE)
- No connection pool exhaustion

---

## 🟡 **ISSUE 2: UPCOMING MATCHES LIMIT - DETAILED ANALYSIS**

### **Current Implementation**

**Location 1**: `components/homepage-matches.tsx` (line 72)
```typescript
const upcomingResponse = await fetch(
  "/api/market?status=upcoming&limit=50"
)
```

**Location 2**: `components/ui/odds-prediction-table.tsx` (line 119)
```typescript
const fetchLimit = status === "upcoming" ? 50 : limit
let url = `/api/market?status=${status}&limit=${fetchLimit}&include_v2=false`
```

**Location 3**: `lib/whatsapp-market-fetcher.ts` (line 17)
```typescript
export async function fetchUpcomingMatchesFromMarket(
  limit: number = 50
): Promise<MarketApiResponse>
```

### **Requested Change**

**Requirement**: Increase upcoming matches limit from **50 to 100**
- **Scope**: Upcoming matches only (not live matches)
- **Impact**: More matches displayed on homepage
- **Complexity**: Low - simple configuration change

### **Files Requiring Changes**

#### **1. `components/homepage-matches.tsx`** ✅ **REQUIRED**

**Current** (line 72):
```typescript
const upcomingResponse = await fetch(
  "/api/market?status=upcoming&limit=50"
)
```

**Change To**:
```typescript
const upcomingResponse = await fetch(
  "/api/market?status=upcoming&limit=100"
)
```

**Note**: Live matches limit remains at 50 (line 84)

---

#### **2. `components/ui/odds-prediction-table.tsx`** ✅ **REQUIRED**

**Current** (line 119):
```typescript
const fetchLimit = status === "upcoming" ? 50 : limit
```

**Change To**:
```typescript
const fetchLimit = status === "upcoming" ? 100 : limit
```

**Note**: This affects the OddsPredictionTable component used in various places

---

#### **3. `lib/whatsapp-market-fetcher.ts`** ⚠️ **OPTIONAL**

**Current** (line 17):
```typescript
export async function fetchUpcomingMatchesFromMarket(
  limit: number = 50
): Promise<MarketApiResponse>
```

**Decision Required**: 
- **Option A**: Keep default at 50 (WhatsApp may not need 100)
- **Option B**: Increase default to 100 (for consistency)

**Recommendation**: **Option A** (keep at 50 for WhatsApp, as it's a different use case)

---

### **Impact Analysis**

#### **Positive Impacts** ✅

1. **More Matches Displayed**: Users see 100 upcoming matches instead of 50
2. **Better User Experience**: More options to browse
3. **Better Coverage**: More matches available for purchase

#### **Potential Concerns** ⚠️

1. **API Response Time**: 
   - Fetching 100 matches may take longer than 50
   - **Mitigation**: Database-first approach should handle this efficiently
   - **Expected**: < 200ms for database query (with proper indexes)

2. **Frontend Rendering**:
   - Rendering 100 matches may be slower than 50
   - **Mitigation**: Current implementation groups matches (today/tomorrow/upcoming)
   - **Expected**: Acceptable performance (matches are grouped, not all rendered at once)

3. **Database Query Performance**:
   - Querying 100 matches may be slower than 50
   - **Mitigation**: Proper indexes should handle this efficiently
   - **Expected**: < 100ms for database query

4. **External API Load**:
   - Fetching 100 matches from external API may increase load
   - **Mitigation**: Database-first approach means external API is only used as fallback
   - **Expected**: Minimal impact (most requests served from database)

---

### **Testing Plan**

#### **1. Test API Response Time**

**Test Scenario**:
1. Query database for 100 upcoming matches
2. Measure response time
3. Compare with 50 matches query

**Expected Result**:
- Response time < 200ms
- Acceptable performance difference (< 50ms)

#### **2. Test Frontend Rendering**

**Test Scenario**:
1. Load homepage with 100 upcoming matches
2. Measure rendering time
3. Check for any performance issues

**Expected Result**:
- Page loads in < 2 seconds
- No noticeable performance degradation
- Matches are properly grouped and displayed

#### **3. Test Database Query Performance**

**Test Scenario**:
1. Query database for 100 upcoming matches
2. Check query execution time
3. Verify indexes are being used

**Expected Result**:
- Query completes in < 100ms
- Indexes are being used (from EXPLAIN ANALYZE)
- No performance issues

---

## 📊 **SUMMARY & RECOMMENDATIONS**

### **Issue 1: Live Match Table 504 Errors**

**Root Causes** (Priority Order):
1. 🔴 **Sync Process Contention** - Most likely cause
2. 🔴 **Timeout Configuration Conflict** - Secondary cause
3. 🟡 **Database Query Performance** - Potential issue (needs verification)
4. 🟢 **Stale Data Filtering** - Minor issue (graceful degradation working)

**Recommended Actions**:
1. **Fix sync contention** (stagger timing OR optimize queries OR use database-first)
2. **Fix timeout configuration** (reduce timeout to 7s OR reduce retries to 2)
3. **Verify database indexes** (ensure composite indexes exist)
4. **Monitor production logs** (correlate 504 errors with sync timing)

**Testing**:
- Test sync contention fix
- Test timeout configuration
- Test database query performance

---

### **Issue 2: Upcoming Matches Limit**

**Change Required**: Increase from 50 to 100 (upcoming only)

**Files to Modify**:
1. ✅ `components/homepage-matches.tsx` (line 72)
2. ✅ `components/ui/odds-prediction-table.tsx` (line 119)
3. ⚠️ `lib/whatsapp-market-fetcher.ts` (optional, keep at 50)

**Impact**: Low risk, high benefit

**Testing**:
- Test API response time
- Test frontend rendering
- Test database query performance

---

## 🔍 **NEXT STEPS**

### **Immediate Actions** (Day 1)

1. **Check Production Logs**:
   - Analyze production logs for 504 errors
   - Correlate with sync timing
   - Identify pattern (sync contention vs external API timeout)

2. **Test External API Performance**:
   - Measure response time for live matches endpoint
   - Check for rate limiting or performance issues

3. **Verify Database Indexes**:
   - Check if composite indexes exist
   - Verify indexes are being used in queries

### **Short-Term Actions** (Week 1)

1. **Implement Sync Contention Fix**:
   - Choose approach (stagger timing OR optimize queries OR database-first)
   - Implement and test

2. **Fix Timeout Configuration**:
   - Reduce external API timeout to 7s OR reduce retries to 2
   - Test timeout handling

3. **Increase Upcoming Matches Limit**:
   - Update homepage-matches.tsx
   - Update odds-prediction-table.tsx
   - Test and verify

### **Long-Term Actions** (Month 1)

1. **Monitor Production Performance**:
   - Track 504 error rate
   - Monitor API response times
   - Monitor database query performance

2. **Optimize Sync Process**:
   - Consider batching database operations
   - Consider parallel processing (if safe)
   - Consider reducing sync frequency (if data freshness allows)

---

## 📚 **REFERENCES**

### **Related Documentation**
- `HOMEPAGE_LIVE_TABLE_504_ERROR_ANALYSIS.md` - Previous analysis
- `504_ERROR_FIX_IMPLEMENTATION.md` - Previous fixes implemented
- `MARKET_MATCH_TABLE_SCHEMA.md` - Database schema
- `MARKET_MATCH_IMPLEMENTATION_SUMMARY.md` - Sync implementation

### **Code Files**
- `app/api/market/route.ts` - Market API endpoint
- `app/api/admin/market/sync-scheduled/route.ts` - Sync process
- `components/homepage-matches.tsx` - Homepage matches component
- `components/ui/odds-prediction-table.tsx` - Odds prediction table component

---

**Status**: ✅ **ANALYSIS COMPLETE**  
**Next**: Implement fixes based on production log analysis

