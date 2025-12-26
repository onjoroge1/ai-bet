# Existing Parlay Tables Analysis - Query-Based Approach

**Date**: January 2025  
**Status**: ✅ **FEASIBLE - NO NEW CODE NEEDED**  
**Approach**: Query existing tables to identify single-game and multi-game parlays

---

## 🎯 **Executive Summary**

**Question**: Can we use existing `ParlayConsensus`, `ParlayLeg`, `ParlayPerformance`, and `ParlayPurchase` tables (already synced from backend API) to find single-game parlays (SGPs) and multi-game parlays for upcoming matches?

**Answer**: ✅ **YES - FULLY FEASIBLE WITH SIMPLE QUERIES**

**Key Finding**: The existing parlay infrastructure already contains all the data needed. We just need to:
1. Query `ParlayLeg` to identify single-game parlays (all legs have same `matchId`)
2. Query `ParlayLeg` + `MarketMatch` to find parlays where all legs reference UPCOMING matches
3. No new code needed - just SQL/Prisma queries

---

## 📊 **Existing Table Structure Analysis**

### **1. ParlayConsensus Table**

```prisma
model ParlayConsensus {
  id                String   @id @default(cuid())
  parlayId          String   @unique // Backend parlay_id (UUID)
  apiVersion        String   @default("v2")
  legCount          Int
  combinedProb      Decimal
  correlationPenalty Decimal
  adjustedProb      Decimal
  impliedOdds       Decimal
  edgePct           Decimal
  confidenceTier    String   // "high", "medium", "low"
  parlayType        String   // "same_league", "cross_league", etc.
  leagueGroup       String?
  earliestKickoff   DateTime
  latestKickoff     DateTime
  kickoffWindow     String   // "today", "tomorrow", "this_week"
  status            String   @default("active") // "active", "expired", "settled"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  syncedAt          DateTime @default(now())
  
  legs              ParlayLeg[]
  purchases         ParlayPurchase[]
  performance       ParlayPerformance?
}
```

**Key Fields for Analysis**:
- ✅ `parlayType` - Can identify "single_game" if backend provides it
- ✅ `earliestKickoff` / `latestKickoff` - Can filter by date
- ✅ `status` - Filter for "active" parlays
- ✅ `legCount` - Number of legs (2+ for parlays)
- ✅ `legs[]` - Relationship to ParlayLeg (contains matchId)

---

### **2. ParlayLeg Table**

```prisma
model ParlayLeg {
  id                String   @id @default(cuid())
  parlayId          String   // References ParlayConsensus.id (internal ID)
  matchId           String   // Backend match_id (STRING - can match MarketMatch.matchId)
  outcome           String   // "H", "D", "A"
  homeTeam          String
  awayTeam          String
  modelProb         Decimal
  decimalOdds       Decimal
  edge              Decimal
  legOrder          Int      // Order in parlay (1, 2, 3...)
  
  parlay            ParlayConsensus @relation(fields: [parlayId], references: [id])
  
  @@unique([parlayId, legOrder])
  @@index([matchId])
  @@index([parlayId])
}
```

**Key Fields for Analysis**:
- ✅ `matchId` - **CRITICAL**: Can match with `MarketMatch.matchId`
- ✅ `parlayId` - Links to ParlayConsensus
- ✅ `outcome` - Betting outcome (H/D/A)
- ✅ `homeTeam` / `awayTeam` - Team names

**✅ Critical Insight**: `ParlayLeg.matchId` is a STRING that should match `MarketMatch.matchId` (also a string)

---

### **3. MarketMatch Table**

```prisma
model MarketMatch {
  id                String   @id @default(cuid())
  matchId           String   @unique // External API match ID (string)
  status            String   // "UPCOMING", "LIVE", "FINISHED"
  homeTeam          String
  awayTeam          String
  league            String
  kickoffDate       DateTime
  // ... other fields
}
```

**Key Fields for Analysis**:
- ✅ `matchId` - Can join with `ParlayLeg.matchId`
- ✅ `status` - Filter for "UPCOMING"
- ✅ `kickoffDate` - Filter by date range

---

## 🔍 **Query Analysis - What We Can Find**

### **Query 1: Find Single-Game Parlays (SGPs)**

**Logic**: Find parlays where ALL legs have the same `matchId`

```sql
-- SQL Approach
SELECT 
  pc.id,
  pc.parlayId,
  pc.legCount,
  pc.combinedProb,
  pc.impliedOdds,
  pc.edgePct,
  pc.confidenceTier,
  pc.parlayType,
  pc.earliestKickoff,
  pc.latestKickoff,
  pc.status,
  pl.matchId,
  pl.homeTeam,
  pl.awayTeam,
  COUNT(DISTINCT pl.matchId) as unique_match_count
FROM "ParlayConsensus" pc
JOIN "ParlayLeg" pl ON pl."parlayId" = pc.id
WHERE pc.status = 'active'
GROUP BY pc.id, pc.parlayId, pc.legCount, pc.combinedProb, 
         pc.impliedOdds, pc.edgePct, pc.confidenceTier, 
         pc.parlayType, pc.earliestKickoff, pc.latestKickoff, 
         pc.status, pl.matchId, pl.homeTeam, pl.awayTeam
HAVING COUNT(DISTINCT pl.matchId) = 1  -- All legs from same match
ORDER BY pc.edgePct DESC, pc.earliestKickoff ASC;
```

**Prisma Approach**:
```typescript
// Find all active parlays
const allParlays = await prisma.parlayConsensus.findMany({
  where: { status: 'active' },
  include: { legs: true }
})

// Filter for single-game parlays
const singleGameParlays = allParlays.filter(parlay => {
  const uniqueMatchIds = new Set(parlay.legs.map(leg => leg.matchId))
  return uniqueMatchIds.size === 1 // All legs from same match
})
```

**✅ Result**: List of all single-game parlays (SGPs) already in database

---

### **Query 2: Find Parlays for UPCOMING Matches**

**Logic**: Find parlays where ALL legs reference matches in `MarketMatch` with `status='UPCOMING'`

```sql
-- SQL Approach
SELECT DISTINCT
  pc.id,
  pc.parlayId,
  pc.legCount,
  pc.combinedProb,
  pc.impliedOdds,
  pc.edgePct,
  pc.confidenceTier,
  pc.parlayType,
  pc.earliestKickoff,
  pc.latestKickoff,
  pc.status,
  mm.matchId,
  mm.homeTeam,
  mm.awayTeam,
  mm.league,
  mm.kickoffDate
FROM "ParlayConsensus" pc
JOIN "ParlayLeg" pl ON pl."parlayId" = pc.id
JOIN "MarketMatch" mm ON mm."matchId" = pl."matchId"
WHERE pc.status = 'active'
  AND mm.status = 'UPCOMING'
  AND mm.kickoffDate >= NOW()
  -- Ensure ALL legs are from UPCOMING matches
  AND NOT EXISTS (
    SELECT 1 
    FROM "ParlayLeg" pl2 
    WHERE pl2."parlayId" = pc.id
      AND pl2."matchId" NOT IN (
        SELECT "matchId" 
        FROM "MarketMatch" 
        WHERE status = 'UPCOMING' AND "kickoffDate" >= NOW()
      )
  )
ORDER BY pc.edgePct DESC, mm.kickoffDate ASC;
```

**Prisma Approach**:
```typescript
// Get all UPCOMING matchIds
const upcomingMatchIds = await prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    kickoffDate: { gte: new Date() }
  },
  select: { matchId: true }
})
const upcomingMatchIdSet = new Set(upcomingMatchIds.map(m => m.matchId))

// Get all active parlays with legs
const allParlays = await prisma.parlayConsensus.findMany({
  where: { status: 'active' },
  include: { legs: true }
})

// Filter for parlays where ALL legs are from UPCOMING matches
const upcomingParlays = allParlays.filter(parlay => {
  return parlay.legs.every(leg => upcomingMatchIdSet.has(leg.matchId))
})
```

**✅ Result**: List of all parlays (single-game or multi-game) for upcoming matches

---

### **Query 3: Find Single-Game Parlays for UPCOMING Matches**

**Logic**: Combine Query 1 + Query 2 - SGPs where the match is UPCOMING

```typescript
// Get UPCOMING matchIds
const upcomingMatchIds = await prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    kickoffDate: { gte: new Date() }
  },
  select: { matchId: true }
})
const upcomingMatchIdSet = new Set(upcomingMatchIds.map(m => m.matchId))

// Get all active parlays
const allParlays = await prisma.parlayConsensus.findMany({
  where: { status: 'active' },
  include: { legs: true }
})

// Filter: Single-game parlays for upcoming matches
const upcomingSGPs = allParlays.filter(parlay => {
  const uniqueMatchIds = new Set(parlay.legs.map(leg => leg.matchId))
  const isSingleGame = uniqueMatchIds.size === 1
  const matchId = parlay.legs[0]?.matchId
  return isSingleGame && matchId && upcomingMatchIdSet.has(matchId)
})
```

**✅ Result**: Single-game parlays specifically for upcoming matches

---

### **Query 4: Find Multi-Game Parlays for UPCOMING Matches**

**Logic**: Parlays with 2+ different matches, all UPCOMING

```typescript
const upcomingMatchIds = await prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    kickoffDate: { gte: new Date() }
  },
  select: { matchId: true }
})
const upcomingMatchIdSet = new Set(upcomingMatchIds.map(m => m.matchId))

const allParlays = await prisma.parlayConsensus.findMany({
  where: { status: 'active' },
  include: { legs: true }
})

// Filter: Multi-game parlays (2+ matches) where all matches are UPCOMING
const upcomingMultiGameParlays = allParlays.filter(parlay => {
  const uniqueMatchIds = new Set(parlay.legs.map(leg => leg.matchId))
  const isMultiGame = uniqueMatchIds.size > 1
  const allUpcoming = parlay.legs.every(leg => upcomingMatchIdSet.has(leg.matchId))
  return isMultiGame && allUpcoming
})
```

**✅ Result**: Multi-game parlays where all legs reference upcoming matches

---

## 📋 **Simple Script Approach (No New Code)**

### **Option A: Prisma Script (TypeScript)**

Create a simple script file: `scripts/analyze-parlays.ts`

```typescript
import prisma from '../lib/db'

async function analyzeParlays() {
  console.log('🔍 Analyzing existing parlays...\n')
  
  // 1. Get UPCOMING matchIds
  const upcomingMatches = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      kickoffDate: { gte: new Date() }
    },
    select: { matchId: true, homeTeam: true, awayTeam: true, league: true, kickoffDate: true }
  })
  const upcomingMatchIdSet = new Set(upcomingMatches.map(m => m.matchId))
  
  console.log(`📊 Found ${upcomingMatches.length} UPCOMING matches\n`)
  
  // 2. Get all active parlays
  const allParlays = await prisma.parlayConsensus.findMany({
    where: { status: 'active' },
    include: { legs: { orderBy: { legOrder: 'asc' } } }
  })
  
  console.log(`📊 Found ${allParlays.length} active parlays\n`)
  
  // 3. Analyze single-game parlays
  const singleGameParlays = allParlays.filter(parlay => {
    const uniqueMatchIds = new Set(parlay.legs.map(leg => leg.matchId))
    return uniqueMatchIds.size === 1
  })
  
  console.log(`🎯 Single-Game Parlays (SGPs): ${singleGameParlays.length}`)
  
  // 4. Single-game parlays for upcoming matches
  const upcomingSGPs = singleGameParlays.filter(parlay => {
    const matchId = parlay.legs[0]?.matchId
    return matchId && upcomingMatchIdSet.has(matchId)
  })
  
  console.log(`   └─ For UPCOMING matches: ${upcomingSGPs.length}\n`)
  
  // 5. Multi-game parlays for upcoming matches
  const upcomingMultiGame = allParlays.filter(parlay => {
    const uniqueMatchIds = new Set(parlay.legs.map(leg => leg.matchId))
    const isMultiGame = uniqueMatchIds.size > 1
    const allUpcoming = parlay.legs.every(leg => upcomingMatchIdSet.has(leg.matchId))
    return isMultiGame && allUpcoming
  })
  
  console.log(`🎯 Multi-Game Parlays (all legs UPCOMING): ${upcomingMultiGame.length}\n`)
  
  // 6. Print sample results
  console.log('📋 Sample Single-Game Parlays for UPCOMING matches:')
  upcomingSGPs.slice(0, 5).forEach((parlay, idx) => {
    const matchId = parlay.legs[0]?.matchId
    const match = upcomingMatches.find(m => m.matchId === matchId)
    console.log(`\n${idx + 1}. Parlay ${parlay.parlayId}`)
    console.log(`   Match: ${match?.homeTeam} vs ${match?.awayTeam} (${match?.league})`)
    console.log(`   Legs: ${parlay.legCount} (${parlay.legs.map(l => l.outcome).join(', ')})`)
    console.log(`   Edge: ${parlay.edgePct}% | Confidence: ${parlay.confidenceTier}`)
    console.log(`   Odds: ${parlay.impliedOdds.toFixed(2)} | Kickoff: ${match?.kickoffDate.toISOString()}`)
  })
  
  // 7. Summary
  console.log('\n📊 SUMMARY:')
  console.log(`   Total Active Parlays: ${allParlays.length}`)
  console.log(`   Single-Game Parlays: ${singleGameParlays.length}`)
  console.log(`   └─ For UPCOMING: ${upcomingSGPs.length}`)
  console.log(`   Multi-Game Parlays (all UPCOMING): ${upcomingMultiGame.length}`)
  console.log(`   Total Parlays for UPCOMING matches: ${upcomingSGPs.length + upcomingMultiGame.length}`)
}

analyzeParlays()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Run**: `npx tsx scripts/analyze-parlays.ts`

---

### **Option B: SQL Query (Direct Database)**

```sql
-- Find single-game parlays for upcoming matches
WITH upcoming_matches AS (
  SELECT "matchId"
  FROM "MarketMatch"
  WHERE status = 'UPCOMING'
    AND "kickoffDate" >= NOW()
),
single_game_parlays AS (
  SELECT 
    pc.id,
    pc."parlayId",
    pc."legCount",
    pc."combinedProb",
    pc."impliedOdds",
    pc."edgePct",
    pc."confidenceTier",
    pc."parlayType",
    pc."earliestKickoff",
    pc."latestKickoff",
    pl."matchId",
    pl."homeTeam",
    pl."awayTeam",
    COUNT(DISTINCT pl."matchId") as unique_matches
  FROM "ParlayConsensus" pc
  JOIN "ParlayLeg" pl ON pl."parlayId" = pc.id
  WHERE pc.status = 'active'
  GROUP BY pc.id, pc."parlayId", pc."legCount", pc."combinedProb",
           pc."impliedOdds", pc."edgePct", pc."confidenceTier",
           pc."parlayType", pc."earliestKickoff", pc."latestKickoff",
           pl."matchId", pl."homeTeam", pl."awayTeam"
  HAVING COUNT(DISTINCT pl."matchId") = 1
)
SELECT 
  sgp.*,
  mm.league,
  mm."kickoffDate"
FROM single_game_parlays sgp
JOIN upcoming_matches um ON um."matchId" = sgp."matchId"
JOIN "MarketMatch" mm ON mm."matchId" = sgp."matchId"
ORDER BY sgp."edgePct" DESC, mm."kickoffDate" ASC
LIMIT 50;
```

---

## ✅ **Feasibility Conclusion**

### **✅ FULLY FEASIBLE - NO NEW CODE NEEDED**

**Reasons**:
1. ✅ All data already exists in `ParlayConsensus` and `ParlayLeg` tables
2. ✅ `ParlayLeg.matchId` can be joined with `MarketMatch.matchId`
3. ✅ Simple queries can identify:
   - Single-game parlays (all legs same matchId)
   - Multi-game parlays (2+ different matchIds)
   - Parlays for upcoming matches (all legs reference UPCOMING matches)
4. ✅ No new code generation needed - just query/analysis scripts
5. ✅ Can run on-demand or schedule as needed

**What We Can Discover**:
- ✅ How many single-game parlays exist in database
- ✅ How many single-game parlays are for upcoming matches
- ✅ How many multi-game parlays are for upcoming matches
- ✅ Which matches have the most parlay options
- ✅ Best-value parlays (by edgePct) for upcoming matches

---

## 🎯 **Recommended Approach**

### **Step 1: Run Analysis Script**

Create and run `scripts/analyze-parlays.ts` to discover:
- Current state of parlays in database
- How many SGPs exist
- How many are for upcoming matches

### **Step 2: Create Admin Query Page (Optional)**

If you want a UI, create a simple admin page that runs these queries:
- `/admin/parlays/analysis` - Shows query results
- Filter by: Single-game vs Multi-game
- Filter by: Upcoming matches only
- Sort by: Edge %, Confidence, Kickoff date

### **Step 3: Schedule Regular Analysis (Optional)**

Add to cron job to regularly analyze and report:
- Daily summary of available parlays
- Best-value parlays for upcoming matches
- Single-game parlay opportunities

---

## 📊 **Expected Results**

Based on existing parlay sync, you should find:

**If Backend API Generates SGPs**:
- ✅ Single-game parlays already in database
- ✅ Can filter by upcoming matches
- ✅ Ready to display to users

**If Backend API Only Generates Multi-Game Parlays**:
- ✅ Can still find parlays for upcoming matches
- ✅ Can identify which matches are most popular in parlays
- ⚠️ May need backend to generate SGPs, or use this analysis to request them

---

## 🔍 **Key Questions to Answer**

1. **Does the backend API already generate single-game parlays?**
   - Run Query 1 to find out
   - If yes → Great! Just filter for upcoming matches
   - If no → May need to request backend to add SGP generation

2. **What parlay types exist?**
   - Check `parlayType` field values
   - May already have "single_game" type
   - Or may need to identify by matchId uniqueness

3. **How many parlays are for upcoming matches?**
   - Run Query 2 to find out
   - This tells you how much content is available

---

## 📝 **Next Steps**

1. ✅ **Create analysis script** (`scripts/analyze-parlays.ts`)
2. ✅ **Run script** to discover current state
3. ⏭️ **Review results** - How many SGPs exist? How many for upcoming?
4. ⏭️ **Decide**: 
   - If SGPs exist → Create admin page to display them
   - If no SGPs → Request backend to generate them, or use this analysis to show what's possible

---

**Last Updated**: January 2025  
**Status**: ✅ **FEASIBLE - QUERY-BASED APPROACH**  
**No New Code Required**: Just analysis queries

