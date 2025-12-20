# 🔄 Status Transition - How It Works

## ✅ **Current Implementation**

### **How Status Updates Work:**

1. **Read from API**: The sync function reads `apiMatch.status` from the external API
2. **Normalize Status**: Converts to our format:
   ```typescript
   const status = apiMatch.status?.toUpperCase() || 'UPCOMING'
   const normalizedStatus = status === 'LIVE' ? 'LIVE' : 
                           status === 'FINISHED' || status === 'COMPLETED' ? 'FINISHED' : 
                           'UPCOMING'
   ```
3. **Upsert to DB**: Uses `prisma.marketMatch.upsert()` which:
   - **Updates** existing match (if `matchId` exists) → **Status gets updated**
   - **Creates** new match (if `matchId` doesn't exist)

### **Status Transition Flow:**

```
UPCOMING → LIVE → FINISHED
   ↓         ↓        ↓
Sync every  Sync every  Sync once
10 minutes  30 seconds (when finished)
```

---

## ⚠️ **Current Limitation**

### **The Problem:**

When we sync by status type, we only fetch matches with that specific status:

- **Sync "upcoming"**: Fetches `status=upcoming` → Won't see matches that became LIVE
- **Sync "live"**: Fetches `status=live` → Won't see matches that became FINISHED
- **Sync "completed"**: Fetches `status=finished` → Only sees already finished matches

### **Example Scenario:**

1. Match starts as UPCOMING (synced at 10:00 AM)
2. Match goes LIVE at 2:00 PM
3. We sync "upcoming" at 2:10 PM → **Won't find this match** (it's no longer "upcoming")
4. We sync "live" at 2:01 PM → **Will find it and update status to LIVE** ✅

**Result**: Status transitions ARE captured, but only when we sync the correct status type.

---

## ✅ **How Status Transitions Actually Work**

### **Scenario 1: UPCOMING → LIVE**

1. **Initial State**: Match in DB with `status: 'UPCOMING'`
2. **Match Starts**: External API now returns `status: 'live'`
3. **Live Sync Runs**: Fetches `status=live` from API
4. **Upsert**: Updates existing match with new status `'LIVE'`
5. **Result**: ✅ Status updated to LIVE

### **Scenario 2: LIVE → FINISHED**

1. **Current State**: Match in DB with `status: 'LIVE'`
2. **Match Ends**: External API now returns `status: 'finished'`
3. **Completed Sync Runs**: Fetches `status=finished` from API
4. **Upsert**: Updates existing match with new status `'FINISHED'`
5. **Result**: ✅ Status updated to FINISHED

### **Scenario 3: UPCOMING → FINISHED (Missed LIVE)**

1. **Initial State**: Match in DB with `status: 'UPCOMING'`
2. **Match Plays & Ends**: External API returns `status: 'finished'`
3. **Completed Sync Runs**: Fetches `status=finished` from API
4. **Upsert**: Updates existing match with new status `'FINISHED'`
5. **Result**: ✅ Status updated to FINISHED (skipped LIVE, but that's okay)

---

## 🔧 **Current Sync Strategy**

### **Why It Works:**

1. **Live Sync (Every Minute)**: Catches matches that just went LIVE
2. **Upcoming Sync (Every 10 Minutes)**: Updates upcoming matches
3. **Completed Sync (Every 10 Minutes)**: Catches matches that finished

### **Status Update Logic:**

```typescript
// In transformMatchData()
const status = apiMatch.status?.toUpperCase() || 'UPCOMING'
const normalizedStatus = status === 'LIVE' ? 'LIVE' : 
                        status === 'FINISHED' || status === 'COMPLETED' ? 'FINISHED' : 
                        'UPCOMING'

// In upsert()
await prisma.marketMatch.upsert({
  where: { matchId: transformed.matchId },
  update: {
    ...transformed,  // Includes the new status from API
    status: normalizedStatus,  // Status gets updated here
  },
  create: { ... }
})
```

**Key Point**: The `upsert` operation **always updates the status** with whatever the API returns, so status transitions are automatically handled.

---

## 📊 **Status Transition Timeline**

### **Example Match Lifecycle:**

```
10:00 AM - Match created (UPCOMING)
          ↓
2:00 PM  - Match starts (LIVE)
          ↓ (Live sync runs every minute)
2:00 PM  - Status updated to LIVE ✅
2:00:30 PM - Live data synced (score, minute, etc.)
2:01 PM  - Live data synced again
...
3:45 PM  - Match ends (FINISHED)
          ↓ (Completed sync runs every 10 minutes)
3:50 PM  - Status updated to FINISHED ✅
          ↓
          (No more syncing - already FINISHED)
```

---

## ✅ **Summary**

**Yes, status transitions work automatically:**

1. ✅ **Read from API**: Status is read from `apiMatch.status`
2. ✅ **Normalize**: Converted to our format (UPCOMING, LIVE, FINISHED)
3. ✅ **Update in DB**: `upsert` operation updates the status field
4. ✅ **Automatic**: No manual intervention needed

**How it works:**
- When a match transitions UPCOMING → LIVE, the next "live" sync will update it
- When a match transitions LIVE → FINISHED, the next "completed" sync will update it
- The `upsert` operation ensures the status is always updated to match the API

**Potential Gap:**
- If a match goes UPCOMING → FINISHED without being synced as LIVE, it will still be updated correctly when the completed sync runs
- The sync frequencies ensure status transitions are caught within reasonable timeframes

---

**Status**: ✅ **Working as designed** - Status transitions are automatic via API sync

