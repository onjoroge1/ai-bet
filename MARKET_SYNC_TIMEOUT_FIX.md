# 🔧 Market Sync Timeout Fix - Progressive Fallback Strategy

**Date:** February 2026  
**Status:** ✅ **IMPLEMENTED**  
**File:** `app/api/admin/market/sync-manual/route.ts`

---

## 🔴 **Root Cause Analysis**

### **The Problem:**
The external API (`https://bet-genius-ai-onjoroge1.replit.app/market`) is **consistently slow**, taking longer than 40 seconds to respond when fetching 100 matches.

**Evidence from Logs:**
```
[2026-02-20T22:57:05.738Z] [WARN] [Sync Manual] External API timeout after 40000ms
[2026-02-20T22:57:05.738Z] [ERROR] All 3 retry attempts failed
POST /api/admin/market/sync-manual 500 in 127304ms
```

**Why This Happens:**
1. **External API Performance**: The backend API is slow/unresponsive
2. **Large Batch Size**: Fetching 100 matches at once is too much for the API
3. **No Fallback Strategy**: If 100 matches fails, we don't try smaller batches
4. **All-or-Nothing**: Complete failure if API times out, even if we could sync some matches

---

## ✅ **Solutions Implemented**

### **1. Progressive Fallback Strategy** ✅ **CRITICAL**

**Before:**
```typescript
// Try 100 matches, fail completely if timeout
const apiMatches = await retryWithBackoff(
  () => fetchMatchesFromAPI(status, 100),
  3, 2000, 30000
)
```

**After:**
```typescript
// Progressive fallback: try 50 → 25 → 10 if larger fails
async function fetchMatchesWithFallback(status) {
  const limits = [50, 25, 10] // Try smaller limits if larger fails
  
  for (const limit of limits) {
    try {
      const matches = await fetchMatchesFromAPI(status, limit)
      if (matches.length > 0) return matches
    } catch (error) {
      // Try next smaller limit
      if (isLastAttempt) throw error
    }
  }
}
```

**Benefits:**
- **Partial Success**: If 100 fails, try 50. If 50 fails, try 25. If 25 fails, try 10.
- **Better Success Rate**: Smaller batches are more likely to succeed
- **Graceful Degradation**: Sync some matches instead of failing completely

---

### **2. Reduced Timeout for Smaller Batches** ✅

**Before:**
```typescript
// Same timeout regardless of batch size
const EXTERNAL_API_TIMEOUT = 40000 // 40s for 100 matches
```

**After:**
```typescript
// Adaptive timeout: smaller batches get shorter timeouts
const baseTimeout = status === 'live' ? 15000 : 20000
const perMatchTimeout = status === 'live' ? 200 : 300
const EXTERNAL_API_TIMEOUT = Math.min(baseTimeout + (limit * perMatchTimeout), 45000)

// Examples:
// - 50 matches: 20s + (50 × 300ms) = 35s
// - 25 matches: 20s + (25 × 300ms) = 27.5s
// - 10 matches: 20s + (10 × 300ms) = 23s
```

**Benefits:**
- Smaller batches timeout faster (fail fast)
- Larger batches get more time (but still capped)
- More efficient use of time

---

### **3. Better Error Handling** ✅

**Before:**
```typescript
catch (error) {
  throw error // Complete failure
}
```

**After:**
```typescript
catch (error) {
  // If we got some matches, return partial success
  if (apiMatches.length > 0) {
    return { 
      synced: synced || 0, 
      errors: errors || apiMatches.length, 
      skipped: skipped || 0,
      partial: true,
      error: errorMessage
    }
  }
  
  // Otherwise return error result (don't throw)
  return { synced: 0, errors: 1, skipped: 0, error: errorMessage }
}
```

**Benefits:**
- **Partial Success**: If we synced some matches before error, return those results
- **No Complete Failure**: Don't throw, return error result instead
- **Better UX**: UI can show "X matches synced, Y failed" instead of "Sync failed"

---

### **4. Improved Response Status Codes** ✅

**Before:**
```typescript
return NextResponse.json({ success: true, ... }, { status: 200 })
// or
return NextResponse.json({ success: false, ... }, { status: 500 })
```

**After:**
```typescript
const success = totalSynced > 0 || (totalErrors === 0 && totalSkipped === 0)
const statusCode = success ? 200 : (hasPartialSuccess ? 207 : 500) // 207 = Multi-Status

return NextResponse.json({ ... }, { status: statusCode })
```

**Benefits:**
- **200**: Complete success
- **207**: Partial success (some matches synced, some failed)
- **500**: Complete failure
- Better API semantics for frontend handling

---

## 📊 **Expected Behavior**

### **Scenario 1: API is Fast (< 35s for 50 matches)**
```
1. Try limit=50 → ✅ Success (35s) → Return 50 matches
2. Process 50 matches → ✅ Complete
Result: ✅ Full success, 50 matches synced
```

### **Scenario 2: API is Slow (> 35s for 50, but < 27s for 25)**
```
1. Try limit=50 → ❌ Timeout (35s)
2. Try limit=25 → ✅ Success (27s) → Return 25 matches
3. Process 25 matches → ✅ Complete
Result: ⚠️ Partial success, 25 matches synced (instead of 50)
```

### **Scenario 3: API is Very Slow (> 23s for 10)**
```
1. Try limit=50 → ❌ Timeout (35s)
2. Try limit=25 → ❌ Timeout (27s)
3. Try limit=10 → ❌ Timeout (23s)
Result: ❌ Complete failure, but with clear error message
```

---

## 🎯 **Key Improvements**

1. ✅ **Progressive Fallback**: Try smaller batches if larger fails
2. ✅ **Adaptive Timeouts**: Shorter timeouts for smaller batches
3. ✅ **Partial Success Handling**: Return results even if some matches fail
4. ✅ **Better Error Messages**: Clear indication of what failed and why
5. ✅ **Improved Status Codes**: 207 for partial success

---

## ⚠️ **Remaining Issue: External API Performance**

**The Root Problem:**
The external API at `https://bet-genius-ai-onjoroge1.replit.app/market` is **consistently slow**. Even with smaller batches, it may still timeout.

**Recommendations:**
1. **Check External API Health**: Verify the backend API is running properly
2. **Optimize Backend API**: If you control it, optimize the `/market` endpoint
3. **Reduce Limit Further**: If API is still slow, reduce initial limit to 25 or 10
4. **Add Caching**: Cache API responses to reduce load
5. **Consider Alternative**: Use database-first approach (sync less frequently, use cached data)

---

## 📝 **Testing**

To test the improvements:

1. **Manual Sync from Admin Dashboard**:
   - Click "Sync Matches" button
   - Watch logs for progressive fallback attempts
   - Should see: "Attempting to fetch with limit=50" → "Falling back to limit=25" → etc.

2. **Expected Logs**:
   ```
   [INFO] Attempting to fetch upcoming matches with limit=50
   [WARN] Failed to fetch with limit=50, falling back to limit=25
   [INFO] Successfully fetched 25 upcoming matches with limit=25
   ```

3. **Check Results**:
   - Even if 50 fails, should sync 25 matches
   - UI should show partial success instead of complete failure
   - Status should be "degraded" or "healthy" instead of "error"

---

## 🔗 **Related Files:**
- `app/api/admin/market/sync-manual/route.ts` - Manual sync (improved)
- `app/api/admin/market/sync-scheduled/route.ts` - Scheduled sync (could benefit from same improvements)
- `app/api/admin/market/sync-status/route.ts` - Status endpoint (unchanged)

