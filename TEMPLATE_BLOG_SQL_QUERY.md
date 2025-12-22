# Template Blog SQL Query Analysis

## Prisma Query Being Executed

The query structure is:

```typescript
prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    isActive: true,
    blogPosts: {
      none: {
        isActive: true
      }
    }
  },
  include: {
    quickPurchases: {
      where: {
        isActive: true,
        isPredictionActive: true,
        confidenceScore: { gte: 60 },
        predictionData: { not: null }
      }
    },
    blogPosts: {
      where: { isActive: true }
    }
  },
  orderBy: { kickoffDate: 'asc' },
  take: 50
})
```

## Equivalent SQL Query

This Prisma query translates to approximately:

```sql
-- Main query for MarketMatch
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

-- Then for each MarketMatch, fetch QuickPurchases:
SELECT 
  "QuickPurchase".* 
FROM "QuickPurchase"
WHERE 
  "QuickPurchase"."marketMatchId" = ?  -- Each MarketMatch.id
  AND "QuickPurchase"."isActive" = true
  AND "QuickPurchase"."isPredictionActive" = true
  AND "QuickPurchase"."confidenceScore" >= 60
  AND "QuickPurchase"."predictionData" IS NOT NULL
ORDER BY "QuickPurchase"."confidenceScore" DESC
LIMIT 1;

-- And fetch BlogPosts:
SELECT 
  "BlogPost"."id",
  "BlogPost"."title",
  "BlogPost"."isPublished"
FROM "BlogPost"
WHERE 
  "BlogPost"."marketMatchId" = ?  -- Each MarketMatch.id
  AND "BlogPost"."isActive" = true
LIMIT 1;
```

## Where to See the Actual SQL

Since Prisma client has logging enabled (`log: ['query', 'error', 'warn']`), you should see the actual SQL queries in your:

1. **Server Console/Terminal** - Where you run `npm run dev`
2. **Browser Console** - Network tab shows API responses

## Potential Issues

### Issue 1: QuickPurchase Relation
The query uses `quickPurchases` relation which requires `marketMatchId` to be set on QuickPurchase records.

**Check if QuickPurchase records have marketMatchId:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT("marketMatchId") as with_market_match_id,
  COUNT(*) - COUNT("marketMatchId") as missing_market_match_id
FROM "QuickPurchase"
WHERE "isActive" = true;
```

### Issue 2: Status Value
Make sure MarketMatch records use exactly `'UPCOMING'` (uppercase) for status.

**Check status values:**
```sql
SELECT DISTINCT "status" 
FROM "MarketMatch" 
WHERE "isActive" = true;
```

### Issue 3: QuickPurchase Filters Too Strict
The filters might be excluding all records:
- `confidenceScore >= 60`
- `predictionData IS NOT NULL`
- `isPredictionActive = true`

**Check QuickPurchase data:**
```sql
SELECT 
  COUNT(*) as total_active,
  COUNT(CASE WHEN "confidenceScore" >= 60 THEN 1 END) as with_confidence_60,
  COUNT(CASE WHEN "predictionData" IS NOT NULL THEN 1 END) as with_prediction_data,
  COUNT(CASE WHEN "isPredictionActive" = true THEN 1 END) as prediction_active,
  COUNT(CASE WHEN 
    "confidenceScore" >= 60 
    AND "predictionData" IS NOT NULL 
    AND "isPredictionActive" = true 
    AND "marketMatchId" IS NOT NULL
    THEN 1 END) as eligible
FROM "QuickPurchase"
WHERE "isActive" = true;
```

## Debug Queries

Run these to diagnose:

```sql
-- 1. Count MarketMatch records
SELECT COUNT(*) 
FROM "MarketMatch" 
WHERE "status" = 'UPCOMING' AND "isActive" = true;

-- 2. Count QuickPurchase records linked to MarketMatch
SELECT COUNT(DISTINCT qp."marketMatchId")
FROM "QuickPurchase" qp
INNER JOIN "MarketMatch" mm ON qp."marketMatchId" = mm."id"
WHERE 
  mm."status" = 'UPCOMING'
  AND mm."isActive" = true
  AND qp."isActive" = true
  AND qp."isPredictionActive" = true
  AND qp."confidenceScore" >= 60
  AND qp."predictionData" IS NOT NULL;

-- 3. Sample MarketMatch with QuickPurchases
SELECT 
  mm."id",
  mm."matchId",
  mm."homeTeam",
  mm."awayTeam",
  mm."status",
  COUNT(qp."id") as quick_purchase_count
FROM "MarketMatch" mm
LEFT JOIN "QuickPurchase" qp ON qp."marketMatchId" = mm."id"
  AND qp."isActive" = true
  AND qp."isPredictionActive" = true
  AND qp."confidenceScore" >= 60
  AND qp."predictionData" IS NOT NULL
WHERE 
  mm."status" = 'UPCOMING'
  AND mm."isActive" = true
GROUP BY mm."id", mm."matchId", mm."homeTeam", mm."awayTeam", mm."status"
HAVING COUNT(qp."id") > 0
LIMIT 5;
```

