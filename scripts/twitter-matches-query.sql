-- SQL Query equivalent to TwitterGenerator.getEligibleMatches()
-- This query finds UPCOMING matches with predictionData in QuickPurchase

-- Main query (what's actually executed by Prisma)
SELECT 
  "MarketMatch"."id",
  "MarketMatch"."matchId",
  "MarketMatch"."homeTeam",
  "MarketMatch"."awayTeam",
  "MarketMatch"."league",
  "MarketMatch"."kickoffDate"
FROM "MarketMatch"
WHERE 
  "MarketMatch"."status" = 'UPCOMING'
  AND "MarketMatch"."isActive" = true
  AND EXISTS (
    SELECT "t0"."marketMatchId"
    FROM "QuickPurchase" AS "t0"
    WHERE 
      "t0"."isActive" = true
      AND "t0"."isPredictionActive" = true
      AND "t0"."predictionData"::jsonb <> 'null'::jsonb
      AND "MarketMatch"."id" = "t0"."marketMatchId"
      AND "t0"."marketMatchId" IS NOT NULL
  )
ORDER BY "MarketMatch"."kickoffDate" ASC
LIMIT 50;


-- Alternative: More readable version with JOIN
SELECT DISTINCT
  mm.id,
  mm."matchId",
  mm."homeTeam",
  mm."awayTeam",
  mm.league,
  mm."kickoffDate",
  mm.status,
  mm."isActive"
FROM "MarketMatch" mm
INNER JOIN "QuickPurchase" qp ON mm.id = qp."marketMatchId"
WHERE 
  mm.status = 'UPCOMING'
  AND mm."isActive" = true
  AND qp."isActive" = true
  AND qp."isPredictionActive" = true
  AND qp."predictionData" IS NOT NULL
  AND qp."predictionData"::jsonb <> 'null'::jsonb
ORDER BY mm."kickoffDate" ASC
LIMIT 50;


-- Diagnostic query: Count matches at each filter level
SELECT 
  'Total UPCOMING matches' AS description,
  COUNT(*) AS count
FROM "MarketMatch"
WHERE status = 'UPCOMING' AND "isActive" = true

UNION ALL

SELECT 
  'With ANY QuickPurchase' AS description,
  COUNT(DISTINCT mm.id) AS count
FROM "MarketMatch" mm
INNER JOIN "QuickPurchase" qp ON mm.id = qp."marketMatchId"
WHERE mm.status = 'UPCOMING' AND mm."isActive" = true

UNION ALL

SELECT 
  'With active QuickPurchase' AS description,
  COUNT(DISTINCT mm.id) AS count
FROM "MarketMatch" mm
INNER JOIN "QuickPurchase" qp ON mm.id = qp."marketMatchId"
WHERE 
  mm.status = 'UPCOMING' 
  AND mm."isActive" = true
  AND qp."isActive" = true

UNION ALL

SELECT 
  'With predictionActive QuickPurchase' AS description,
  COUNT(DISTINCT mm.id) AS count
FROM "MarketMatch" mm
INNER JOIN "QuickPurchase" qp ON mm.id = qp."marketMatchId"
WHERE 
  mm.status = 'UPCOMING' 
  AND mm."isActive" = true
  AND qp."isActive" = true
  AND qp."isPredictionActive" = true

UNION ALL

SELECT 
  'With predictionData (FINAL COUNT)' AS description,
  COUNT(DISTINCT mm.id) AS count
FROM "MarketMatch" mm
INNER JOIN "QuickPurchase" qp ON mm.id = qp."marketMatchId"
WHERE 
  mm.status = 'UPCOMING' 
  AND mm."isActive" = true
  AND qp."isActive" = true
  AND qp."isPredictionActive" = true
  AND qp."predictionData" IS NOT NULL
  AND qp."predictionData"::jsonb <> 'null'::jsonb;


-- Query to see matches WITHOUT predictionData (that should have it)
SELECT 
  mm.id,
  mm."matchId",
  mm."homeTeam",
  mm."awayTeam",
  mm.league,
  mm."kickoffDate",
  COUNT(qp.id) AS quickpurchase_count,
  COUNT(CASE WHEN qp."predictionData" IS NOT NULL AND qp."predictionData"::jsonb <> 'null'::jsonb THEN 1 END) AS with_prediction_data
FROM "MarketMatch" mm
LEFT JOIN "QuickPurchase" qp ON mm.id = qp."marketMatchId" 
  AND qp."isActive" = true 
  AND qp."isPredictionActive" = true
WHERE 
  mm.status = 'UPCOMING' 
  AND mm."isActive" = true
GROUP BY mm.id, mm."matchId", mm."homeTeam", mm."awayTeam", mm.league, mm."kickoffDate"
HAVING COUNT(CASE WHEN qp."predictionData" IS NOT NULL AND qp."predictionData"::jsonb <> 'null'::jsonb THEN 1 END) = 0
ORDER BY mm."kickoffDate" ASC
LIMIT 20;

