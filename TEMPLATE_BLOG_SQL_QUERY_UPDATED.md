# Template Blog SQL Query - Updated (Using matchId Matching)

## Query Strategy

Since `marketMatchId` relation may not be populated, we're matching by `matchId` (external API ID) instead.

## SQL Queries Generated

### **Step 1: Fetch MarketMatch Records**

```sql
-- Get UPCOMING MarketMatch records without blogs
SELECT 
  "MarketMatch".*
FROM "MarketMatch"
WHERE 
  "MarketMatch"."status" = 'UPCOMING'
  AND "MarketMatch"."isActive" = true
  AND NOT EXISTS (
    SELECT 1 
    FROM "BlogPost"
    WHERE 
      "BlogPost"."marketMatchId" = "MarketMatch"."id"
      AND "BlogPost"."isActive" = true
  )
ORDER BY "MarketMatch"."kickoffDate" ASC
LIMIT 50;
```

**With BlogPosts included:**
```sql
-- For each MarketMatch, fetch blog posts
SELECT 
  "BlogPost"."id",
  "BlogPost"."title",
  "BlogPost"."isPublished"
FROM "BlogPost"
WHERE 
  "BlogPost"."marketMatchId" = ?  -- MarketMatch.id
  AND "BlogPost"."isActive" = true
LIMIT 1;
```

### **Step 2: Extract matchIds**

After fetching MarketMatch records, extract their `matchId` values (external API IDs) into an array.

**Example matchIds array:**
```
['12345', '12346', '12347', ...]
```

### **Step 3: Fetch QuickPurchase Records by matchId**

```sql
SELECT 
  "QuickPurchase"."id",
  "QuickPurchase"."name",
  "QuickPurchase"."description",
  "QuickPurchase"."matchId",
  "QuickPurchase"."confidenceScore",
  "QuickPurchase"."valueRating",
  "QuickPurchase"."analysisSummary",
  "QuickPurchase"."createdAt",
  "QuickPurchase"."matchData",
  "QuickPurchase"."predictionData"
FROM "QuickPurchase"
WHERE 
  "QuickPurchase"."matchId" IN ('12345', '12346', '12347', ...)  -- Array of matchIds from MarketMatch
  AND "QuickPurchase"."isActive" = true
  AND "QuickPurchase"."isPredictionActive" = true
  AND "QuickPurchase"."confidenceScore" >= 60
  AND "QuickPurchase"."predictionData" IS NOT NULL
ORDER BY "QuickPurchase"."confidenceScore" DESC;
```

### **Step 4: Combine Results (In Application Code)**

The application code then:
1. Groups QuickPurchase records by `matchId`
2. Matches each MarketMatch with its corresponding QuickPurchase(s)
3. Takes the first (highest confidence) QuickPurchase for each match
4. Filters out MarketMatch records that don't have QuickPurchase data

## Complete Query Flow

```
1. SELECT MarketMatch WHERE status='UPCOMING' AND isActive=true (no blogs)
   ↓
2. Extract matchId values: ['12345', '12346', ...]
   ↓
3. SELECT QuickPurchase WHERE matchId IN (...) AND filters
   ↓
4. Application code: Group by matchId and combine with MarketMatch
   ↓
5. Filter: Only return MarketMatch records that have QuickPurchase data
```

## Why This Approach?

**Problem:**
- Prisma relation `quickPurchases` relies on `marketMatchId` foreign key
- If `marketMatchId` is not populated in QuickPurchase table, relation returns empty
- Need fallback to match by `matchId` string field

**Solution:**
- Match by `matchId` (external API ID) which both tables have
- `MarketMatch.matchId` = `QuickPurchase.matchId` (string comparison)
- Works even if `marketMatchId` foreign key is not set

## Verification Queries

### Check if MarketMatch records exist:

```sql
SELECT COUNT(*) 
FROM "MarketMatch" 
WHERE "status" = 'UPCOMING' AND "isActive" = true;
```

### Check if QuickPurchase records exist with matchIds:

```sql
-- First, get sample matchIds from MarketMatch
SELECT "matchId" 
FROM "MarketMatch" 
WHERE "status" = 'UPCOMING' AND "isActive" = true 
LIMIT 5;

-- Then check if QuickPurchase has matching records
SELECT COUNT(*) 
FROM "QuickPurchase"
WHERE 
  "matchId" IN ('12345', '12346', ...)  -- Use matchIds from above
  AND "isActive" = true
  AND "isPredictionActive" = true
  AND "confidenceScore" >= 60
  AND "predictionData" IS NOT NULL;
```

### Find matches between MarketMatch and QuickPurchase:

```sql
SELECT 
  mm."id" as market_match_id,
  mm."matchId" as match_id,
  mm."homeTeam",
  mm."awayTeam",
  COUNT(qp."id") as quick_purchase_count
FROM "MarketMatch" mm
LEFT JOIN "QuickPurchase" qp ON qp."matchId" = mm."matchId"
  AND qp."isActive" = true
  AND qp."isPredictionActive" = true
  AND qp."confidenceScore" >= 60
  AND qp."predictionData" IS NOT NULL
WHERE 
  mm."status" = 'UPCOMING'
  AND mm."isActive" = true
GROUP BY mm."id", mm."matchId", mm."homeTeam", mm."awayTeam"
HAVING COUNT(qp."id") > 0
ORDER BY mm."kickoffDate" ASC
LIMIT 10;
```

## Key Differences from Original Approach

| Aspect | Original (Relation-based) | Updated (matchId-based) |
|--------|---------------------------|-------------------------|
| **Link Method** | `marketMatchId` foreign key | `matchId` string matching |
| **Prisma Query** | `include: { quickPurchases: ... }` | Separate queries + manual join |
| **SQL** | Single query with JOIN | Two separate queries |
| **Requires** | `marketMatchId` populated | `matchId` populated (both tables) |
| **Performance** | Single query (faster) | Two queries (slightly slower) |
| **Reliability** | Fails if relation missing | Works if matchId exists |

## Expected Performance

- **MarketMatch query**: < 50ms (indexed on status, isActive)
- **QuickPurchase query**: < 100ms (indexed on matchId, filters)
- **Application combining**: < 10ms (in-memory operations)
- **Total**: ~150ms for 50 matches

