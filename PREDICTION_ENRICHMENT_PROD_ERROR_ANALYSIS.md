# 🔍 Prediction Enrichment Production Error Analysis

**Date:** February 2026  
**Feature:** "Enrich All Predictions (Smart)" button  
**Issue:** Works locally but fails in production  
**Status:** 🔍 Analysis Complete

---

## 📋 **Overview**

The "Enrich All Predictions (Smart)" button calls `/api/admin/predictions/enrich-quickpurchases` which processes potentially hundreds of matches sequentially. While this works fine locally, it fails in production due to several infrastructure and configuration differences.

---

## 🔴 **Root Causes Identified**

### **1. Missing API Route Timeout Configuration** 🔴 **CRITICAL**

**Location:** `app/api/admin/predictions/enrich-quickpurchases/route.ts`

**Problem:**
- **No `export const maxDuration`** configuration
- Next.js/Vercel default timeouts:
  - **Vercel Hobby**: 10 seconds
  - **Vercel Pro**: 60 seconds  
  - **Vercel Enterprise**: 300 seconds (5 minutes)
  - **Local Development**: No hard limit (can run indefinitely)

**Current Behavior:**
- The enrichment process can take **several minutes** to complete:
  - Processes matches in batches of 100
  - Each match has 300ms delay between calls
  - Each `/predict` API call has 30-second timeout
  - Example: 200 matches × (300ms delay + 2s API call) = **~460 seconds** (7.6 minutes)

**Impact:**
- On Vercel Hobby (10s limit): Request killed after 10 seconds → **504 Gateway Timeout**
- On Vercel Pro (60s limit): Request killed after 60 seconds if processing >60 matches
- Partial data saved, no error message to user

**Evidence:**
```typescript
// app/api/admin/predictions/enrich-quickpurchases/route.ts
// ❌ NO maxDuration export found
export async function POST(req: NextRequest) {
  // ... processes potentially hundreds of matches
}
```

---

### **2. Environment Variables Not Set in Production** 🔴 **CRITICAL**

**Location:** `app/api/admin/predictions/enrich-quickpurchases/route.ts` (lines 12-15, 170, 179)

**Required Environment Variables:**
```typescript
process.env.REDIS_URL        // Redis connection URL
process.env.REDIS_TOKEN      // Redis authentication token
process.env.BACKEND_URL      // Backend API base URL
process.env.BACKEND_API_KEY  // Backend API authentication key
```

**Potential Issues:**
1. **Missing Variables**: If any of these are not set in production, the code will fail:
   - `REDIS_URL` or `REDIS_TOKEN` missing → Redis initialization fails
   - `BACKEND_URL` missing → API calls fail with "undefined/predict"
   - `BACKEND_API_KEY` missing → 401 Unauthorized errors

2. **Different Values**: Production might have:
   - Different backend URL (staging vs production)
   - Different API keys
   - Redis connection issues (network, firewall, credentials)

**Error Scenarios:**
```typescript
// Line 12-15: Redis initialization
const redis = new Redis({
  url: process.env.REDIS_URL!,      // ❌ Fails if undefined
  token: process.env.REDIS_TOKEN!,  // ❌ Fails if undefined
})

// Line 170: Backend API call
const backendUrl = `${process.env.BACKEND_URL}/predict`  // ❌ "undefined/predict" if not set

// Line 179: Authorization header
'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`  // ❌ Empty token if not set
```

---

### **3. Long-Running Process Without Timeout Protection** 🔴 **HIGH**

**Location:** `app/api/admin/predictions/enrich-quickpurchases/route.ts` (lines 617-803)

**Problem:**
- Processes matches sequentially in a loop
- No check for elapsed time vs. timeout limit
- No early exit if approaching timeout
- No progress tracking or cancellation mechanism

**Current Flow:**
```typescript
for (let i = 0; i < ready.length; i++) {
  const matchId = ready[i]
  await delay(300)  // 300ms delay
  await fetchPredictionData(matchId)  // Up to 30s per call
  // ... update database
  // ❌ No timeout check here
}
```

**Impact:**
- If processing 200 matches and timeout is 60s:
  - After 60 seconds, Next.js kills the request
  - Only ~30-40 matches processed
  - User sees error, but doesn't know how many succeeded
  - No way to resume or track progress

---

### **4. Database Connection Pool Exhaustion** 🟡 **MEDIUM**

**Location:** Throughout the enrichment process

**Problem:**
- Sequential database queries for each match:
  - Find QuickPurchase record
  - Update QuickPurchase with prediction data
  - Multiple queries per match
- No connection pooling optimization
- No batch updates

**Impact:**
- With many matches, database connections can be exhausted
- Queries start failing with "Connection pool timeout"
- Production databases often have stricter connection limits

---

### **5. Memory Issues in Serverless Environment** 🟡 **MEDIUM**

**Location:** `app/api/admin/predictions/enrich-quickpurchases/route.ts` (lines 269-300)

**Problem:**
- Loads **ALL** pending QuickPurchase records into memory:
  ```typescript
  const quickPurchases = await prisma.quickPurchase.findMany({
    // ... no limit
  })
  ```
- In production, this could be hundreds or thousands of records
- Serverless functions have memory limits (512MB-3GB depending on plan)

**Impact:**
- Memory exhaustion if too many records
- Function killed by platform
- No graceful degradation

---

### **6. External API Timeout Issues** 🟡 **MEDIUM**

**Location:** `app/api/admin/predictions/enrich-quickpurchases/route.ts` (lines 146-229)

**Problem:**
- Each `/predict` call has 30-second timeout
- If backend API is slow in production:
  - Network latency higher (production servers farther away)
  - Backend might be under load
  - Rate limiting from backend API

**Current Timeout:**
```typescript
const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 seconds
```

**Impact:**
- If backend takes >30s, request times out
- Match skipped, but no clear error message
- Accumulates failed matches

---

### **7. Redis Connection Issues** 🟡 **MEDIUM**

**Location:** `app/api/admin/predictions/enrich-quickpurchases/route.ts` (lines 12-15, 149-162)

**Problem:**
- Redis used for caching predictions
- Production Redis might have:
  - Network restrictions (firewall, VPC)
  - Different connection requirements
  - Rate limiting
  - Authentication issues

**Impact:**
- If Redis fails, falls back to backend API (slower)
- But if Redis initialization fails, entire process fails

---

## 🔧 **Recommended Fixes (Priority Order)**

### **1. Add API Route Timeout Configuration** 🔴 **CRITICAL**

```typescript
// app/api/admin/predictions/enrich-quickpurchases/route.ts
export const maxDuration = 300 // 5 minutes (Vercel Enterprise)
export const runtime = 'nodejs'
```

**Note:** 
- Vercel Hobby: Max 10s (not enough for this operation)
- Vercel Pro: Max 60s (might not be enough)
- Vercel Enterprise: Max 300s (should be sufficient)

**Alternative:** Break into smaller batches with separate API calls

---

### **2. Add Timeout Protection in Loop** 🔴 **CRITICAL**

```typescript
// Add before the processing loop
const MAX_PROCESSING_TIME = 240000 // 4 minutes (leave buffer for cleanup)

for (let i = 0; i < ready.length; i++) {
  const elapsedTime = Date.now() - startTime
  
  if (elapsedTime > MAX_PROCESSING_TIME) {
    logger.warn('⏰ Approaching timeout, stopping processing', {
      processed: i,
      total: ready.length,
      elapsed: `${elapsedTime}ms`
    })
    break // Exit early
  }
  
  // ... continue processing
}
```

---

### **3. Verify Environment Variables** 🔴 **CRITICAL**

**Check Production Environment:**
```bash
# Verify all required variables are set
echo $REDIS_URL
echo $REDIS_TOKEN  
echo $BACKEND_URL
echo $BACKEND_API_KEY
```

**Add Validation:**
```typescript
// At the start of POST handler
const requiredEnvVars = ['REDIS_URL', 'REDIS_TOKEN', 'BACKEND_URL', 'BACKEND_API_KEY']
const missing = requiredEnvVars.filter(key => !process.env[key])

if (missing.length > 0) {
  logger.error('Missing required environment variables', {
    tags: ['api', 'admin', 'predictions', 'enrich'],
    data: { missing }
  })
  return NextResponse.json(
    { error: `Missing environment variables: ${missing.join(', ')}` },
    { status: 500 }
  )
}
```

---

### **4. Add Better Error Handling** 🟡 **HIGH**

```typescript
// Wrap Redis initialization
let redis: Redis | null = null
try {
  redis = new Redis({
    url: process.env.REDIS_URL!,
    token: process.env.REDIS_TOKEN!,
  })
} catch (error) {
  logger.warn('Redis initialization failed, continuing without cache', {
    error: error instanceof Error ? error.message : 'Unknown error'
  })
  // Continue without cache (slower but functional)
}
```

---

### **5. Add Progress Tracking** 🟡 **MEDIUM**

**Option A: WebSocket/SSE for Real-Time Updates**
- Send progress updates to frontend
- User can see how many matches processed
- User can cancel if needed

**Option B: Background Job Queue**
- Use BullMQ or similar
- Process in background
- Store progress in database
- Frontend polls for status

**Option C: Break into Smaller Batches**
- Frontend makes multiple API calls
- Each call processes 10-20 matches
- User sees progress incrementally

---

### **6. Optimize Database Queries** 🟡 **MEDIUM**

```typescript
// Instead of sequential updates, batch them
const updates = ready.map(matchId => ({
  where: { matchId: matchId.toString() },
  data: { /* prediction data */ }
}))

// Use transaction for batch update
await prisma.$transaction(
  updates.map(update => prisma.quickPurchase.update(update))
)
```

---

### **7. Add Memory Limit Protection** 🟡 **LOW**

```typescript
// Add limit to initial query
const quickPurchases = await prisma.quickPurchase.findMany({
  where: whereClause,
  take: 500, // Limit to prevent memory issues
  orderBy: { createdAt: 'desc' }
})

// Process in chunks
const chunks = chunk(quickPurchases, 100)
for (const chunk of chunks) {
  // Process chunk
}
```

---

## 📊 **Diagnostic Steps**

### **1. Check Production Logs**

Look for these error patterns:
- `504 Gateway Timeout` → Timeout issue
- `Missing environment variables` → Env var issue
- `Redis connection failed` → Redis issue
- `Backend API timeout` → Backend API issue
- `Connection pool timeout` → Database issue

### **2. Check Environment Variables**

```bash
# In production console/terminal
vercel env ls
# Or
echo $REDIS_URL
echo $BACKEND_URL
```

### **3. Test Backend API Connectivity**

```bash
# Test from production server
curl -X POST "${BACKEND_URL}/predict" \
  -H "Authorization: Bearer ${BACKEND_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"match_id": 123456, "include_analysis": true}'
```

### **4. Monitor Request Duration**

Check Vercel dashboard:
- Function execution time
- Timeout errors
- Memory usage
- Error rates

---

## 🎯 **Quick Wins (Immediate Actions)**

1. ✅ **Add `maxDuration` export** - Prevents timeout kills
2. ✅ **Add timeout protection in loop** - Graceful early exit
3. ✅ **Add environment variable validation** - Clear error messages
4. ✅ **Add better error logging** - Easier debugging

---

## 📝 **Summary**

The production error is most likely caused by:

1. **Missing `maxDuration` configuration** → Request killed by Next.js/Vercel timeout
2. **Missing or incorrect environment variables** → Redis/Backend API failures
3. **Long-running process without timeout protection** → Exceeds platform limits

**Recommended immediate fix:**
- Add `export const maxDuration = 300` to the route
- Add timeout protection in the processing loop
- Add environment variable validation
- Improve error logging

**Long-term solution:**
- Move to background job queue (BullMQ, etc.)
- Implement progress tracking
- Break into smaller batches
- Add retry logic with exponential backoff

---

## 🔗 **Related Files:**
- `app/api/admin/predictions/enrich-quickpurchases/route.ts` - Main enrichment API
- `components/admin/league-management.tsx` - Frontend button handler
- `lib/predictionAvailability.ts` - Availability checking logic
- `lib/predictionCacheKey.ts` - Cache key generation

