# 📊 MarketMatch UPCOMING Sync Analysis & Implementation Plan

**Date**: December 2025  
**Status**: 📋 **ANALYSIS COMPLETE - READY FOR IMPLEMENTATION**

---

## 🎯 **Objective**

Ensure all matches in `MarketMatch` table with `status='UPCOMING'` have corresponding `QuickPurchase` records with populated `predictionData`. These are the matches we're selling, so they **must** have predictions.

---

## 📋 **Current State Analysis**

### **1. MarketMatch Table Structure**

```prisma
model MarketMatch {
  id                String   @id @default(cuid())
  matchId           String   @unique // External API match ID
  status            String   // "UPCOMING", "LIVE", "FINISHED"
  
  // Basic Match Info
  homeTeam          String
  awayTeam          String
  league            String
  leagueId          String?
  kickoffDate       DateTime
  
  // Relations
  quickPurchases    QuickPurchase[] // One-to-many relationship
}
```

**Key Points:**
- `status='UPCOMING'` indicates matches that are scheduled but not yet started
- `matchId` is the unique identifier (external API ID)
- One `MarketMatch` can have multiple `QuickPurchase` records (one-to-many)

### **2. QuickPurchase Table Structure**

```prisma
model QuickPurchase {
  id                 String     @id @default(cuid())
  matchId            String?    @unique // External API match ID (backward compatibility)
  marketMatchId      String?    // Link to MarketMatch table (NEW)
  marketMatch        MarketMatch? @relation(fields: [marketMatchId], references: [id])
  
  predictionData     Json?      // The prediction data from /predict API
  predictionType     String?    // Type of prediction
  confidenceScore    Int?       // Confidence score
  valueRating        String?    // Value rating
  
  isActive           Boolean    @default(true)
  isPredictionActive Boolean    @default(true)
  
  // ... other fields ...
}
```

**Key Points:**
- Can link to `MarketMatch` via `marketMatchId` (relation) OR `matchId` (string)
- `predictionData` is the critical field - must be populated for selling
- `isPredictionActive=true` indicates the prediction is ready for sale

### **3. Current Global Sync Flow**

**File**: `app/api/admin/predictions/sync-from-availability/route.ts`

**Current Process:**
1. **Discovery**: Calls `/consensus/sync` API (last 5 days) → Gets match IDs
2. **Database Check**: Queries `QuickPurchase` for existing records needing enrichment
3. **Combination**: Combines match IDs from consensus API + database
4. **Categorization**:
   - `matchesToSkip`: Exists with `predictionData` ✅
   - `matchesToEnrich`: Exists without `predictionData` 🔄
   - `matchesToCreate`: Does not exist ➕
5. **Availability Check**: Calls `/predict/availability` API to filter to "ready" matches
6. **Processing**: 
   - Enriches existing `QuickPurchase` records
   - Creates new `QuickPurchase` records
   - Calls `/predict` API for each match

**Current Data Sources:**
- ✅ `/consensus/sync` API (external)
- ✅ `QuickPurchase` table (database - records needing enrichment)

**Missing Data Source:**
- ❌ `MarketMatch` table (UPCOMING matches)

---

## 🔍 **Problem Statement**

### **The Gap**

1. **MarketMatch table** is synced from Market API (every 10 minutes for upcoming matches)
2. **QuickPurchase table** is synced from Global Sync (every 2 hours)
3. **No direct link** between MarketMatch UPCOMING matches and QuickPurchase prediction data

### **The Risk**

- MarketMatch has UPCOMING matches that are **ready to sell**
- But these matches may not be in QuickPurchase yet
- Or they're in QuickPurchase but `predictionData` is null
- **Result**: We can't sell predictions for matches we're supposed to be selling

### **Example Scenario**

```
MarketMatch Table:
- Match ID: 12345, Status: UPCOMING, Kickoff: Tomorrow 3PM
- Match ID: 67890, Status: UPCOMING, Kickoff: Tomorrow 5PM

QuickPurchase Table:
- Match ID: 12345 → predictionData: null ❌
- Match ID: 67890 → NOT FOUND ❌

Result: We can't sell either match, even though they're in MarketMatch!
```

---

## 💡 **Proposed Solution**

### **Integration Strategy: Add MarketMatch as Data Source**

Integrate `MarketMatch` UPCOMING matches into the existing Global Sync flow as an **additional data source**.

### **Flow Design**

```
┌─────────────────────────────────────────────────────────────┐
│                    GLOBAL SYNC PROCESS                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │   STEP 1: DISCOVERY (Multiple Sources) │
        └───────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
    ┌────────┐ ┌──────────┐ ┌──────────────┐
    │Consensus│ │QuickPurch│ │MarketMatch   │
    │  API   │ │  (DB)    │ │  UPCOMING    │
    └────────┘ └──────────┘ └──────────────┘
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │   STEP 2: COMBINE & DEDUPLICATE        │
        │   - Merge all match IDs                │
        │   - Remove duplicates                  │
        └───────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │   STEP 3: CATEGORIZE                  │
        │   - Skip: Has predictionData          │
        │   - Enrich: Exists, no predictionData│
        │   - Create: Not in QuickPurchase      │
        └───────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │   STEP 4: AVAILABILITY CHECK          │
        │   - Filter to "ready" matches          │
        └───────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │   STEP 5: PROCESS                     │
        │   - Enrich existing records            │
        │   - Create new records                 │
        │   - Call /predict API                  │
        └───────────────────────────────────────┘
```

---

## 📝 **Detailed Implementation Plan**

### **Phase 1: Add MarketMatch Query to Global Sync**

**File**: `app/api/admin/predictions/sync-from-availability/route.ts`

**Changes:**

1. **Add MarketMatch Query** (after Step 1 - Consensus API call):

```typescript
// Step 1.5: Query MarketMatch table for UPCOMING matches
logger.info('Querying MarketMatch table for UPCOMING matches', {
  tags: ['api', 'admin', 'global-sync'],
  data: { 
    source: 'marketmatch_table',
    status: 'UPCOMING'
  }
})

const upcomingMarketMatches = await prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    isActive: true,
    kickoffDate: {
      gte: new Date() // Only future matches
    }
  },
  select: {
    matchId: true,
    id: true, // MarketMatch internal ID
    homeTeam: true,
    awayTeam: true,
    league: true,
    kickoffDate: true,
    consensusOdds: true,
    v1Model: true,
    v2Model: true
  }
})

const marketMatchIds = upcomingMarketMatches
  .map(m => m.matchId)
  .filter(Boolean) as string[]

logger.info('Found UPCOMING matches in MarketMatch table', {
  tags: ['api', 'admin', 'global-sync'],
  data: { 
    totalUpcoming: upcomingMarketMatches.length,
    uniqueMatchIds: marketMatchIds.length,
    sampleMatchIds: marketMatchIds.slice(0, 5)
  }
})
```

2. **Combine All Match IDs** (update Step 2):

```typescript
// Combine match IDs from ALL sources:
// 1. Consensus API (external discovery)
// 2. QuickPurchase database (existing records needing enrichment)
// 3. MarketMatch table (UPCOMING matches - PRIMARY SOURCE for selling)

const allMatchIds = new Set<string>([
  ...marketMatchIds,        // PRIMARY: MarketMatch UPCOMING (matches we're selling)
  ...databaseMatchIds,       // SECONDARY: QuickPurchase needing enrichment
  ...uniqueMatchIds          // TERTIARY: Consensus API (for new matches)
])

logger.info('Combined match IDs from all sources', {
  tags: ['api', 'admin', 'global-sync'],
  data: { 
    fromMarketMatch: marketMatchIds.length,
    fromDatabase: databaseMatchIds.length,
    fromConsensus: uniqueMatchIds.length,
    totalUnique: allMatchIds.size
  }
})
```

3. **Enhanced Categorization** (update Step 3):

```typescript
// For each match ID, check:
// 1. Does it exist in QuickPurchase?
// 2. If yes, does it have predictionData?
// 3. If no, does it exist in MarketMatch?

for (const matchId of allMatchIds) {
  const existingQP = existingQuickPurchases.find(qp => qp.matchId === matchId)
  const marketMatch = upcomingMarketMatches.find(m => m.matchId === matchId)
  
  if (existingQP) {
    // Exists in QuickPurchase
    if (existingQP.predictionData && 
        existingQP.predictionData !== Prisma.JsonNull &&
        Object.keys(existingQP.predictionData as object).length > 0) {
      matchesToSkip.add(matchId) // Has predictionData ✅
    } else {
      matchesToEnrich.add(matchId) // No predictionData 🔄
    }
  } else {
    // Not in QuickPurchase
    if (marketMatch) {
      // Exists in MarketMatch → Create QuickPurchase record
      matchesToCreate.add(matchId) // Create new ➕
    } else {
      // Not in MarketMatch either → Skip (from consensus API only)
      matchesToSkip.add(matchId) // Not a MarketMatch match, skip
    }
  }
}
```

4. **Enhanced QuickPurchase Creation** (update Step 5):

```typescript
// When creating new QuickPurchase records, use MarketMatch data if available
if (type === 'create' && marketMatch) {
  // Use MarketMatch data for richer match information
  const matchData = {
    match_id: Number(matchId),
    home_team: marketMatch.homeTeam,
    away_team: marketMatch.awayTeam,
    league: marketMatch.league,
    date: marketMatch.kickoffDate.toISOString(),
    // ... other MarketMatch fields
  }
  
  // Create QuickPurchase with marketMatchId link
  await prisma.quickPurchase.create({
    data: {
      matchId: matchId,
      marketMatchId: marketMatch.id, // Link to MarketMatch
      name: `${marketMatch.homeTeam} vs ${marketMatch.awayTeam}`,
      matchData: matchData,
      predictionData: predictionData,
      // ... other fields
    }
  })
}
```

---

## 🔄 **Integration with Current Flow**

### **How It Marries with Global Sync**

**Current Global Sync:**
- ✅ Discovers matches from `/consensus/sync` API
- ✅ Enriches existing `QuickPurchase` records
- ✅ Creates new `QuickPurchase` records

**Enhanced Global Sync:**
- ✅ **NEW**: Discovers matches from `MarketMatch` table (UPCOMING)
- ✅ **PRIORITY**: MarketMatch matches are PRIMARY source (matches we're selling)
- ✅ Discovers matches from `/consensus/sync` API (secondary)
- ✅ Enriches existing `QuickPurchase` records
- ✅ Creates new `QuickPurchase` records with `marketMatchId` link

### **Priority Order**

1. **MarketMatch UPCOMING** (HIGHEST PRIORITY)
   - These are matches we're actively selling
   - Must have `predictionData` populated
   - Link via `marketMatchId` for proper relations

2. **QuickPurchase needing enrichment** (MEDIUM PRIORITY)
   - Existing records that need prediction data
   - May or may not be in MarketMatch

3. **Consensus API** (LOWEST PRIORITY)
   - New matches from external API
   - May not be in MarketMatch yet
   - Will be synced to MarketMatch later

---

## 📊 **Expected Results**

### **Before Implementation**

```
MarketMatch UPCOMING: 100 matches
QuickPurchase with predictionData: 60 matches
QuickPurchase without predictionData: 20 matches
QuickPurchase missing: 20 matches

Result: 40 matches can't be sold ❌
```

### **After Implementation**

```
MarketMatch UPCOMING: 100 matches
QuickPurchase with predictionData: 100 matches ✅
QuickPurchase without predictionData: 0 matches ✅
QuickPurchase missing: 0 matches ✅

Result: 100 matches can be sold ✅
```

---

## 🎯 **Key Benefits**

1. **Complete Coverage**: All MarketMatch UPCOMING matches will have predictions
2. **Proper Relations**: QuickPurchase records linked to MarketMatch via `marketMatchId`
3. **Unified Process**: Single sync process handles all sources
4. **Priority Handling**: MarketMatch matches get highest priority
5. **No Duplication**: Deduplication ensures each match is processed once
6. **Availability Check**: Still uses availability API to filter to "ready" matches

---

## ⚠️ **Considerations**

### **1. Performance**

- **Query Size**: MarketMatch UPCOMING query may return 100-500 matches
- **Solution**: Use pagination or limit to reasonable batch size (e.g., 200 matches)

### **2. Rate Limiting**

- **Issue**: More matches = more `/predict` API calls
- **Solution**: Already implemented rate limiting (300ms delay between calls)

### **3. Duplicate Processing**

- **Issue**: Same match from multiple sources
- **Solution**: Use `Set` for deduplication (already implemented)

### **4. MarketMatch Sync Frequency**

- **Current**: MarketMatch syncs every 10 minutes
- **Global Sync**: Runs every 2 hours
- **Gap**: New MarketMatch matches may wait up to 2 hours
- **Solution**: Consider running Global Sync more frequently (every 1 hour) OR add MarketMatch-specific sync

---

## 🚀 **Implementation Steps**

### **Step 1: Update Global Sync Endpoint**

1. Add MarketMatch query after consensus API call
2. Combine match IDs from all sources
3. Update categorization logic
4. Update QuickPurchase creation to use MarketMatch data

### **Step 2: Add Logging**

1. Log MarketMatch query results
2. Log source breakdown (MarketMatch vs Consensus vs Database)
3. Log matches created from MarketMatch vs other sources

### **Step 3: Testing**

1. Test with small batch of MarketMatch UPCOMING matches
2. Verify QuickPurchase records created with `marketMatchId` link
3. Verify `predictionData` populated correctly
4. Verify no duplicates

### **Step 4: Monitor**

1. Monitor Global Sync logs for MarketMatch matches
2. Check QuickPurchase table for `marketMatchId` links
3. Verify all UPCOMING matches have predictions

---

## 📋 **Code Changes Summary**

### **Files to Modify**

1. **`app/api/admin/predictions/sync-from-availability/route.ts`**
   - Add MarketMatch query
   - Update match ID combination
   - Update categorization logic
   - Update QuickPurchase creation

### **New Queries**

```typescript
// Query MarketMatch for UPCOMING matches
const upcomingMarketMatches = await prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    isActive: true,
    kickoffDate: { gte: new Date() }
  },
  select: {
    matchId: true,
    id: true,
    homeTeam: true,
    awayTeam: true,
    league: true,
    kickoffDate: true,
    consensusOdds: true,
    v1Model: true,
    v2Model: true
  }
})
```

### **Enhanced Logic**

```typescript
// Priority: MarketMatch > Database > Consensus
const allMatchIds = new Set([
  ...marketMatchIds,      // PRIMARY
  ...databaseMatchIds,     // SECONDARY
  ...uniqueMatchIds        // TERTIARY
])
```

---

## ✅ **Success Criteria**

1. ✅ All MarketMatch UPCOMING matches have QuickPurchase records
2. ✅ All QuickPurchase records have `predictionData` populated
3. ✅ QuickPurchase records linked to MarketMatch via `marketMatchId`
4. ✅ No duplicate processing
5. ✅ Proper logging and monitoring
6. ✅ Performance acceptable (< 5 minutes for 200 matches)

---

## 📚 **Related Documentation**

- [UNIFIED_GLOBAL_SYNC_IMPLEMENTATION.md](./UNIFIED_GLOBAL_SYNC_IMPLEMENTATION.md) - Current global sync implementation
- [MARKET_MATCH_TABLE_SCHEMA.md](./MARKET_MATCH_TABLE_SCHEMA.md) - MarketMatch table structure
- [GLOBAL_SYNC_CRON_SETUP.md](./GLOBAL_SYNC_CRON_SETUP.md) - Cron job setup

---

**Status**: ✅ **ANALYSIS COMPLETE**  
**Next Step**: Review and approve plan, then implement

