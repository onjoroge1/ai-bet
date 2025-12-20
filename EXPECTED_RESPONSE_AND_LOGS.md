# 📊 Expected Response & Logs - MarketMatch Sync

## ✅ **Expected Response Format**

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

## 📋 **Response Field Descriptions**

### **`success`** (boolean)
- **Type**: `boolean`
- **Values**: `true` (success) or `false` (error)
- **Required**: Yes

### **`results`** (object)
- **Type**: `Record<string, { synced: number; errors: number; skipped: number }>`
- **Keys**: `live`, `upcoming`, `completed` (depending on sync type)
- **Required**: Yes (on success)

#### **`results.{type}.synced`** (number)
- **Type**: `number`
- **Description**: Number of matches successfully synced/updated
- **Range**: `>= 0`
- **Example**: `15`

#### **`results.{type}.errors`** (number)
- **Type**: `number`
- **Description**: Number of matches that failed to sync
- **Range**: `>= 0`
- **Example**: `0`

#### **`results.{type}.skipped`** (number)
- **Type**: `number`
- **Description**: Number of matches skipped (already synced recently or already finished)
- **Range**: `>= 0`
- **Example**: `3`

### **`summary`** (object)
- **Type**: `{ totalSynced: number; totalErrors: number; totalSkipped: number; duration: string }`
- **Required**: Yes (on success)

#### **`summary.totalSynced`** (number)
- **Type**: `number`
- **Description**: Total matches synced across all types
- **Range**: `>= 0`
- **Example**: `15`

#### **`summary.totalErrors`** (number)
- **Type**: `number`
- **Description**: Total errors across all types
- **Range**: `>= 0`
- **Example**: `0`

#### **`summary.totalSkipped`** (number)
- **Type**: `number`
- **Description**: Total matches skipped across all types
- **Range**: `>= 0`
- **Example**: `3`

#### **`summary.duration`** (string)
- **Type**: `string`
- **Description**: Total execution time in milliseconds
- **Format**: `"{number}ms"`
- **Example**: `"2345ms"`

---

## 📝 **Expected Logs**

### **Success Logs**

```
🕐 CRON: Starting scheduled market sync
🔄 Starting sync for upcoming matches
✅ Completed sync for upcoming matches
🕐 CRON: Scheduled market sync completed
```

### **Log Structure**

**Start Log:**
```typescript
logger.info('🕐 CRON: Starting scheduled market sync', {
  tags: ['api', 'admin', 'market', 'cron', 'sync'],
  data: { startTime: '2025-01-XX...' },
})
```

**Status Sync Log:**
```typescript
logger.info(`🔄 Starting sync for ${status} matches`, {
  tags: ['market', 'sync', status],
})
```

**Completion Log:**
```typescript
logger.info(`✅ Completed sync for ${status} matches`, {
  tags: ['market', 'sync', status],
  data: { 
    synced: 15, 
    errors: 0, 
    skipped: 3, 
    total: 18 
  },
})
```

**Final Summary Log:**
```typescript
logger.info('🕐 CRON: Scheduled market sync completed', {
  tags: ['api', 'admin', 'market', 'cron', 'sync'],
  data: {
    results: { upcoming: { synced: 15, errors: 0, skipped: 3 } },
    totalSynced: 15,
    totalErrors: 0,
    totalSkipped: 3,
    duration: '2345ms',
  },
})
```

### **Error Logs**

**Unauthorized:**
```typescript
logger.warn('🕐 CRON: Unauthorized market sync attempt', {
  tags: ['api', 'admin', 'market', 'cron', 'security'],
  data: { hasAuthHeader: true },
})
```

**Sync Error:**
```typescript
logger.error(`Error syncing match ${matchId}`, {
  tags: ['market', 'sync', status, 'error'],
  error: Error,
})
```

**Failed Sync:**
```typescript
logger.error(`Failed to sync ${status} matches`, {
  tags: ['market', 'sync', status, 'error'],
  error: Error,
})
```

**Fatal Error:**
```typescript
logger.error('🕐 CRON: Market sync failed', {
  tags: ['api', 'admin', 'market', 'cron', 'sync', 'error'],
  error: Error,
  data: { duration: '1234ms' },
})
```

---

## 🔍 **Data Collection Verification**

### **What Should Be Collected**

#### **For Upcoming Matches:**
- ✅ `matchId` (unique identifier)
- ✅ `status` = "UPCOMING"
- ✅ `homeTeam`, `awayTeam`, `league`
- ✅ `kickoffDate`
- ✅ `consensusOdds` (if available)
- ✅ `allBookmakers` (if available)
- ✅ `v1Model` (if available)
- ✅ `v2Model` (if available)
- ✅ `lastSyncedAt` (timestamp)
- ✅ `syncCount` (incremented on each sync)

#### **For Live Matches:**
- ✅ Everything from Upcoming PLUS:
- ✅ `status` = "LIVE"
- ✅ `currentScore` / `liveScore`
- ✅ `elapsed` / `minute`
- ✅ `period`
- ✅ `liveStatistics` (if available)
- ✅ `momentum` (if available)
- ✅ `modelMarkets` (if available)
- ✅ `aiAnalysis` (if available)

#### **For Completed Matches:**
- ✅ Everything from Live PLUS:
- ✅ `status` = "FINISHED"
- ✅ `finalResult`
- ✅ `matchStatistics`
- ✅ `venue`, `referee`, `attendance` (if available)

---

## 🧪 **Verification Steps**

### **1. Test Endpoint Response**

```powershell
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming" `
  -Method GET `
  -Headers @{Authorization="Bearer snapbet-marketmatch"} `
  | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Output:**
- `success: true`
- `results.upcoming` object with `synced`, `errors`, `skipped`
- `summary` object with totals and duration

### **2. Check Database Records**

```typescript
// Check if records exist
const count = await prisma.marketMatch.count()
console.log(`Total MarketMatch records: ${count}`)

// Check by status
const byStatus = await prisma.marketMatch.groupBy({
  by: ['status'],
  _count: { id: true },
})
```

**Expected:**
- At least some records in `MarketMatch` table
- Records with `status: 'UPCOMING'` (most common)
- Records with `status: 'LIVE'` (if any live matches)
- Records with `status: 'FINISHED'` (if any completed)

### **3. Verify Data Completeness**

```typescript
// Check data completeness
const withOdds = await prisma.marketMatch.count({
  where: { consensusOdds: { not: null } },
})

const withV1 = await prisma.marketMatch.count({
  where: { v1Model: { not: null } },
})

const withV2 = await prisma.marketMatch.count({
  where: { v2Model: { not: null } },
})
```

**Expected:**
- Most matches should have `consensusOdds`
- Most matches should have `v1Model`
- Some matches should have `v2Model`

### **4. Check Sync Frequency**

```typescript
// Check last sync times
const recentSyncs = await prisma.marketMatch.findMany({
  where: {
    status: 'LIVE',
    lastSyncedAt: {
      gte: new Date(Date.now() - 60 * 1000), // Last minute
    },
  },
})
```

**Expected:**
- Live matches should have recent `lastSyncedAt` (within last minute)
- Upcoming matches should have `lastSyncedAt` within last 10 minutes

---

## 📊 **Sample Verification Output**

### **Successful Sync**

```
🔍 MarketMatch Sync Verification
==================================================
Base URL: http://localhost:3000
Cron Secret: snapbet-ma...

==================================================
TEST 1: Upcoming Matches Sync
==================================================

📡 Testing endpoint: http://localhost:3000/api/admin/market/sync-scheduled?type=upcoming

✅ Expected Response Format for upcoming:
==================================================
{
  "success": true,
  "results": {
    "upcoming": {
      "synced": "number (>= 0)",
      "errors": "number (>= 0)",
      "skipped": "number (>= 0)"
    }
  },
  "summary": {
    "totalSynced": "number (>= 0)",
    "totalErrors": "number (>= 0)",
    "totalSkipped": "number (>= 0)",
    "duration": "string (e.g., \"1234ms\")"
  }
}

📋 Actual Response for upcoming:
==================================================
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

🔍 Validation:
✅ success: true
✅ results object present
✅ results.upcoming present
✅ results.upcoming.synced: 15
✅ results.upcoming.errors: 0
✅ results.upcoming.skipped: 3
✅ summary object present
✅ summary.totalSynced: 15
✅ summary.duration: 2345ms

✅ Response structure is valid!

📊 Checking Database...
==================================================

📈 Match Counts by Status:
  UPCOMING: 45 matches
  LIVE: 3 matches
  FINISHED: 12 matches

🔄 Sync Statistics:
  UPCOMING:
    - Avg Syncs: 2.3
    - Last Sync: 2025-01-XX...
    - Total Errors: 0
  LIVE:
    - Avg Syncs: 5.7
    - Last Sync: 2025-01-XX...
    - Total Errors: 0

📋 Sample Upcoming Matches (first 5):
  123456: Arsenal vs Chelsea
    League: Premier League
    Kickoff: 2025-01-XX...
    Has Consensus Odds: true
    Has V1 Model: true
    Has V2 Model: true
    Last Synced: 2025-01-XX...
    Sync Count: 2

✅ Data Completeness:
  Total Active Matches: 60
  Matches with Consensus Odds: 58 (96.7%)
  Matches with V1 Model: 55 (91.7%)
  Matches with V2 Model: 42 (70.0%)

✅ Verification Complete!
```

---

## ⚠️ **Common Issues**

### **1. No Data Collected**

**Symptoms:**
- `synced: 0` in response
- No records in database

**Possible Causes:**
- API endpoint not accessible
- `BACKEND_API_URL` not configured
- API returning empty matches array
- All matches being skipped (already synced)

**Fix:**
- Check `BACKEND_API_URL` environment variable
- Verify API is accessible
- Check API response manually
- Reduce sync interval or clear `lastSyncedAt` for testing

### **2. Errors in Response**

**Symptoms:**
- `errors > 0` in response
- `syncErrors > 0` in database

**Possible Causes:**
- Invalid match data from API
- Database constraint violations
- Network timeouts
- API rate limiting

**Fix:**
- Check `lastSyncError` field in database
- Review error logs
- Verify API response structure
- Check database constraints

### **3. All Matches Skipped**

**Symptoms:**
- `synced: 0`, `skipped: {high number}`

**Possible Causes:**
- Matches already synced recently
- Sync interval too short
- Completed matches (already FINISHED)

**Fix:**
- This is normal behavior for smart sync
- Wait for sync interval to pass
- For testing, manually update `lastSyncedAt` to old date

---

## ✅ **Success Criteria**

1. ✅ **Endpoint Returns 200 OK** with valid JSON
2. ✅ **Response Structure Matches** expected format
3. ✅ **Database Contains Records** in `MarketMatch` table
4. ✅ **Data Completeness** > 80% (odds, models present)
5. ✅ **Sync Frequency** working (live matches sync every 30s, upcoming every 10min)
6. ✅ **No Errors** in response (`errors: 0`)
7. ✅ **Logs Present** in console/Vercel logs

---

**Status**: Ready for verification  
**Next**: Run verification script to check actual data collection
