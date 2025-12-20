# 🔍 MarketMatch Data Collection Verification Guide

## 📊 **Expected Response Format**

### **Success Response (200 OK)**

```json
{
  "success": true,
  "results": {
    "live": {
      "synced": 5,
      "errors": 0,
      "skipped": 2
    },
    "upcoming": {
      "synced": 15,
      "errors": 0,
      "skipped": 8
    },
    "completed": {
      "synced": 3,
      "errors": 0,
      "skipped": 10
    }
  },
  "summary": {
    "totalSynced": 23,
    "totalErrors": 0,
    "totalSkipped": 20,
    "duration": "1234ms"
  }
}
```

### **Error Response (401 Unauthorized)**

```json
{
  "error": "Unauthorized"
}
```

### **Error Response (500 Server Error)**

```json
{
  "success": false,
  "error": "Error message here",
  "duration": "500ms"
}
```

---

## ✅ **What Data Should Be Collected**

### **For Each Match, We Collect:**

#### **Basic Match Info** ✅
- `matchId` - External API match ID (unique identifier)
- `status` - "UPCOMING", "LIVE", or "FINISHED"
- `homeTeam`, `awayTeam` - Team names
- `league` - League name
- `kickoffDate` - Match start time

#### **Odds Data** ✅
- `consensusOdds` - { home, draw, away } from novig_current
- `allBookmakers` - All bookmaker odds (bet365, pinnacle, etc.)
- `primaryBook` - Primary bookmaker name
- `booksCount` - Number of bookmakers

#### **Model Predictions** ✅
- `v1Model` - Free model predictions (pick, confidence, probs)
- `v2Model` - Premium model predictions (pick, confidence, probs)
- `modelPredictions` - Normalized format

#### **Live Match Data** (Status: LIVE) ✅
- `currentScore` - { home, away }
- `elapsed` / `minute` - Minutes played
- `period` - "1st Half", "2nd Half", etc.
- `liveStatistics` - Possession, shots, corners, etc.
- `momentum` - Momentum data
- `modelMarkets` - Live betting markets
- `aiAnalysis` - AI analysis (premium)

#### **Completed Match Data** (Status: FINISHED) ✅
- `finalResult` - { score, outcome, outcome_text }
- `matchStatistics` - Final match stats
- `venue`, `referee`, `attendance`

#### **Sync Metadata** ✅
- `lastSyncedAt` - When last synced
- `nextSyncAt` - When to sync next
- `syncPriority` - "high", "medium", "low"
- `syncCount` - Number of times synced
- `syncErrors` - Error count
- `lastSyncError` - Last error message

---

## 🔍 **How to Verify Data Collection**

### **1. Test Sync Endpoint**

**PowerShell:**
```powershell
.\VERIFY_MARKET_SYNC.ps1
```

**Bash:**
```bash
chmod +x VERIFY_MARKET_SYNC.sh
./VERIFY_MARKET_SYNC.sh
```

**Manual Test:**
```powershell
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/market/sync-scheduled?type=live" `
    -Method GET `
    -Headers @{Authorization="Bearer snapbet-marketmatch"} `
    | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### **2. Check Database**

**Using Prisma Studio:**
```bash
npx prisma studio
```
Then navigate to `MarketMatch` table and verify:
- Matches are being created/updated
- All fields are populated correctly
- `lastSyncedAt` is recent
- `syncCount` is incrementing

**Using Prisma Query:**
```typescript
// Check recent syncs
const recentMatches = await prisma.marketMatch.findMany({
  orderBy: { lastSyncedAt: 'desc' },
  take: 10,
  select: {
    matchId: true,
    status: true,
    homeTeam: true,
    awayTeam: true,
    league: true,
    kickoffDate: true,
    consensusOdds: true,
    v1Model: true,
    v2Model: true,
    lastSyncedAt: true,
    syncCount: true,
  }
})

console.log('Recent synced matches:', recentMatches)
```

### **3. Check Logs**

**Expected Log Messages:**

**Start:**
```
🕐 CRON: Starting scheduled market sync
```

**Per Status:**
```
🔄 Starting sync for live matches
✅ Completed sync for live matches
  data: { synced: 5, errors: 0, skipped: 2, total: 7 }
```

**Completion:**
```
🕐 CRON: Scheduled market sync completed
  data: {
    results: { live: {...}, upcoming: {...} },
    totalSynced: 23,
    totalErrors: 0,
    totalSkipped: 20,
    duration: "1234ms"
  }
```

**Errors:**
```
Error syncing match 123456
  tags: ['market', 'sync', 'live', 'error']
```

---

## 📋 **Verification Checklist**

### **Response Structure** ✅
- [ ] Response has `success: true`
- [ ] Response has `results` object
- [ ] Response has `summary` object
- [ ] Each status has `synced`, `errors`, `skipped` counts

### **Data Collection** ✅
- [ ] Matches are being created in `MarketMatch` table
- [ ] `matchId` is unique and valid
- [ ] `status` is correct (UPCOMING/LIVE/FINISHED)
- [ ] Basic match info is populated (teams, league, kickoffDate)
- [ ] Odds data is collected (`consensusOdds`, `allBookmakers`)
- [ ] Model predictions are collected (`v1Model`, `v2Model`)
- [ ] Live data is collected for LIVE matches (`currentScore`, `elapsed`)
- [ ] Final data is collected for FINISHED matches (`finalResult`)

### **Sync Metadata** ✅
- [ ] `lastSyncedAt` is updating
- [ ] `syncCount` is incrementing
- [ ] `syncPriority` is set correctly
- [ ] `nextSyncAt` is set for upcoming/live matches
- [ ] `syncErrors` is 0 (or tracked if errors occur)

### **Sync Logic** ✅
- [ ] Live matches sync every 30 seconds (checked every minute)
- [ ] Upcoming matches sync every 10 minutes
- [ ] Completed matches sync only once
- [ ] Skipped matches are not re-synced unnecessarily

---

## 🐛 **Troubleshooting**

### **No Data Being Synced**

**Check:**
1. Is `BACKEND_API_URL` set in environment?
2. Is the external API responding?
3. Are there any errors in logs?
4. Is the cron secret correct?

**Debug:**
```typescript
// Add to sync endpoint for debugging
console.log('API URL:', BASE_URL)
console.log('API Key:', API_KEY ? 'Set' : 'Missing')
console.log('Fetched matches:', apiMatches.length)
```

### **Partial Data Collection**

**Check:**
1. Are all required fields in API response?
2. Are there transformation errors?
3. Check `syncErrors` and `lastSyncError` fields

**Debug:**
```typescript
// Check what's being transformed
console.log('Transformed match:', transformed)
console.log('Match ID:', transformed.matchId)
```

### **Sync Not Running**

**Check:**
1. Is cron configured in `vercel.json`?
2. Is `CRON_SECRET` set in Vercel Dashboard?
3. Are cron jobs enabled in Vercel project?
4. Check Vercel function logs

---

## 📊 **Sample Verification Query**

```typescript
// Run this in a test script or API route
async function verifyMarketSync() {
  // Check total matches
  const totalMatches = await prisma.marketMatch.count()
  
  // Check by status
  const upcomingCount = await prisma.marketMatch.count({
    where: { status: 'UPCOMING', isActive: true }
  })
  
  const liveCount = await prisma.marketMatch.count({
    where: { status: 'LIVE', isActive: true }
  })
  
  const finishedCount = await prisma.marketMatch.count({
    where: { status: 'FINISHED' }
  })
  
  // Check recent syncs
  const recentlySynced = await prisma.marketMatch.count({
    where: {
      lastSyncedAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      }
    }
  })
  
  // Check sync errors
  const matchesWithErrors = await prisma.marketMatch.count({
    where: {
      syncErrors: { gt: 0 }
    }
  })
  
  return {
    totalMatches,
    byStatus: {
      upcoming: upcomingCount,
      live: liveCount,
      finished: finishedCount
    },
    recentlySynced,
    matchesWithErrors
  }
}
```

---

## ✅ **Expected Results**

### **After First Sync:**
- `totalSynced` > 0 (matches were synced)
- `totalErrors` = 0 (no errors)
- `totalSkipped` may be > 0 (matches already synced recently)

### **After Subsequent Syncs:**
- `totalSynced` may be 0 (if all matches already synced)
- `totalSkipped` > 0 (matches skipped because recently synced)
- `totalErrors` = 0 (no errors)

### **Database:**
- `MarketMatch` table has records
- `lastSyncedAt` is recent (within last sync interval)
- `syncCount` is incrementing
- All required fields are populated

---

**Status**: Ready for verification  
**Next**: Run verification scripts and check database

