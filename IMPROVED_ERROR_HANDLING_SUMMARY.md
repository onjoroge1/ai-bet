# Improved Error Handling for Live Matches API

**Date**: January 3, 2026  
**Status**: ✅ **IMPLEMENTED**  
**File**: `app/api/market/route.ts`

---

## 🎯 **What Was Improved**

### **Before** ❌

When external API timed out:
1. Logged error message
2. Returned empty matches array
3. No fallback to stale database data
4. Users saw empty table even though data exists in database

**Result**: Poor user experience - empty table when data is available

---

### **After** ✅

When external API times out:
1. **Enhanced error logging** with full context
2. **Fallback to stale database data** if available
3. **Metadata in response** indicating data is stale
4. **Better error messages** explaining what happened

**Result**: Users see matches (even if slightly stale) instead of empty table

---

## 📋 **Changes Made**

### **1. Enhanced Error Logging** ✅

**Before**:
```typescript
console.error(`[Market API] Error fetching from external API:`, errorMessage)
```

**After**:
```typescript
console.error(`[Market API] Error fetching from external API:`, {
  error: errorMessage,
  isTimeout,
  status,
  limit,
  url,
  hasStaleData: dbMatches.length > 0,
  staleMatchCount: dbMatches.length,
  timestamp: new Date().toISOString()
})
```

**Benefits**:
- More context for debugging
- Knows if stale data is available
- Includes request parameters
- Timestamp for correlation

---

### **2. Fallback to Stale Database Data** ✅

**Before**:
```typescript
// Return empty matches instead of error
return NextResponse.json({
  error: 'External API timeout',
  matches: [],
  total_count: 0
})
```

**After**:
```typescript
// Fallback to stale database data if available
if (dbMatches.length > 0) {
  const oldestSync = dbMatches.reduce((oldest, match) => {
    return match.lastSyncedAt < oldest ? match.lastSyncedAt : oldest
  }, dbMatches[0].lastSyncedAt)
  
  const ageSeconds = Math.floor((Date.now() - oldestSync.getTime()) / 1000)
  const ageMinutes = Math.floor(ageSeconds / 60)
  
  console.log(`[Market API] External API failed, using stale database data: ${dbMatches.length} matches (${ageMinutes}m ${ageSeconds % 60}s old)`)
  
  const apiResponse = transformMarketMatchesToApiResponse(dbMatches, dbMatches.length)
  
  return NextResponse.json({
    ...apiResponse,
    _metadata: {
      stale: true,
      lastSyncTime: oldestSync.toISOString(),
      ageSeconds,
      errorType: isTimeout ? 'api_timeout' : 'api_error',
      errorMessage: isTimeout 
        ? 'External API timeout - using stale database data'
        : `External API error - using stale database data: ${errorMessage}`,
      fallbackReason: 'external_api_unavailable'
    }
  })
}
```

**Benefits**:
- Users see matches instead of empty table
- Metadata indicates data is stale
- Frontend can show "Last updated X minutes ago"
- Better user experience

---

### **3. Response Metadata** ✅

**Added `_metadata` field** to response:

```typescript
_metadata: {
  stale: true,                    // Indicates data is stale
  lastSyncTime: "2026-01-03T...", // When data was last synced
  ageSeconds: 839,                // How old the data is (in seconds)
  errorType: "api_timeout",     // Type of error that occurred
  errorMessage: "...",            // Human-readable error message
  fallbackReason: "external_api_unavailable" // Why we're using stale data
}
```

**Benefits**:
- Frontend can display "Data may be outdated"
- Frontend can show "Last updated X minutes ago"
- Frontend can make intelligent decisions about refreshing
- Better transparency for users

---

### **4. Variable Scope Fix** ✅

**Problem**: `dbMatches` was defined inside try block, not accessible in catch block

**Solution**: Declared `dbMatches` outside try block so it's accessible in both places

```typescript
// Declare dbMatches outside try block so it's accessible in catch block for stale data fallback
let dbMatches: any[] = []

try {
  dbMatches = await prisma.marketMatch.findMany({...})
  // ... use dbMatches
} catch (dbError) {
  // dbMatches still accessible here
}

try {
  // External API call
} catch (error) {
  // dbMatches accessible here for stale data fallback
  if (dbMatches.length > 0) {
    // Use stale data
  }
}
```

---

## 🔍 **Error Handling Flow**

```
1. Query Database
   ✅ Found matches → Check if fresh
      ✅ Fresh → Return immediately
      ❌ Stale → Continue to step 2
   ❌ No matches → Continue to step 2
   
2. Fetch from External API
   ✅ Success → Return matches
   ❌ Timeout/Error → Continue to step 3
   
3. Check for Stale Database Data
   ✅ Has stale data → Return stale data with metadata
   ❌ No stale data → Return empty array with error
```

---

## 📊 **Example Responses**

### **Success (Fresh Data)**
```json
{
  "matches": [...],
  "total_count": 10
}
```

### **Success (Stale Data Fallback)**
```json
{
  "matches": [...],
  "total_count": 10,
  "_metadata": {
    "stale": true,
    "lastSyncTime": "2026-01-03T19:02:40.481Z",
    "ageSeconds": 839,
    "errorType": "api_timeout",
    "errorMessage": "External API timeout - using stale database data",
    "fallbackReason": "external_api_unavailable"
  }
}
```

### **Failure (No Data Available)**
```json
{
  "error": "External API timeout - request took too long",
  "message": "No matches available - external API unavailable and no database fallback",
  "matches": [],
  "total_count": 0,
  "_metadata": {
    "stale": false,
    "errorType": "api_timeout",
    "errorMessage": "External API timeout - request took too long",
    "fallbackReason": "no_data_available",
    "hasStaleData": false
  }
}
```

---

## 🎯 **Benefits**

1. **Better User Experience**:
   - Users see matches instead of empty table
   - Even if data is slightly stale, it's better than nothing

2. **Better Debugging**:
   - Enhanced logging with full context
   - Knows if stale data is available
   - Includes request parameters and timestamps

3. **Better Frontend Integration**:
   - Metadata allows frontend to show "Last updated X minutes ago"
   - Frontend can make intelligent decisions about refreshing
   - Better transparency for users

4. **Graceful Degradation**:
   - System continues to work even when external API is down
   - Falls back to stale data instead of failing completely
   - Better resilience

---

## 🧪 **Testing**

### **Test Scenario 1: External API Timeout with Stale Data**

1. Ensure database has stale LIVE matches (>30 seconds old)
2. Make request to `/api/market?status=live&limit=50`
3. External API should timeout
4. **Expected**: Returns stale database matches with `_metadata.stale: true`

### **Test Scenario 2: External API Timeout with No Data**

1. Ensure database has no matches for status
2. Make request to `/api/market?status=live&limit=50`
3. External API should timeout
4. **Expected**: Returns empty array with error message and `_metadata.hasStaleData: false`

### **Test Scenario 3: Enhanced Logging**

1. Make request that causes external API timeout
2. Check logs
3. **Expected**: Logs include full context (error, status, limit, url, hasStaleData, staleMatchCount, timestamp)

---

## 📝 **Next Steps**

1. **Frontend Integration**: Update frontend to handle `_metadata` field
   - Show "Last updated X minutes ago" when `stale: true`
   - Show warning when using stale data
   - Auto-refresh when data is stale

2. **Monitoring**: Add alerts for:
   - High rate of stale data fallbacks
   - External API timeout rate
   - Sync process failures

3. **Sync Process Fix**: Fix root cause (sync not keeping matches fresh)
   - Verify cron is running
   - Fix sync process if failing
   - Monitor sync success rate

---

**Status**: ✅ **IMPLEMENTED**  
**Next**: Test in production and monitor results

