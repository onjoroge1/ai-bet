-- SQL queries to check match 1379152 score data in database

-- 1. Check basic match info and status
SELECT 
  "matchId",
  status,
  "homeTeam",
  "awayTeam",
  "kickoffDate",
  "lastSyncedAt",
  EXTRACT(EPOCH FROM (NOW() - "kickoffDate")) / 3600 as hours_since_kickoff
FROM "MarketMatch"
WHERE "matchId" = '1379152';

-- 2. Check finalResult field (JSON)
SELECT 
  "matchId",
  status,
  "finalResult",
  "finalResult"->>'score' as final_result_score,
  "finalResult"->'score'->>'home' as final_result_home,
  "finalResult"->'score'->>'away' as final_result_away
FROM "MarketMatch"
WHERE "matchId" = '1379152';

-- 3. Check currentScore field (JSON)
SELECT 
  "matchId",
  status,
  "currentScore",
  "currentScore"->>'home' as current_score_home,
  "currentScore"->>'away' as current_score_away
FROM "MarketMatch"
WHERE "matchId" = '1379152';

-- 4. Check all score-related fields
SELECT 
  "matchId",
  status,
  "finalResult",
  "currentScore",
  "liveScore",
  "elapsed",
  "minute",
  "period"
FROM "MarketMatch"
WHERE "matchId" = '1379152';

-- 5. Update match to FINISHED and populate finalResult from currentScore (if needed)
-- UNCOMMENT TO RUN:
/*
UPDATE "MarketMatch"
SET 
  status = 'FINISHED',
  "finalResult" = jsonb_build_object(
    'score', jsonb_build_object(
      'home', ("currentScore"->>'home')::int,
      'away', ("currentScore"->>'away')::int
    ),
    'outcome', CASE 
      WHEN ("currentScore"->>'home')::int > ("currentScore"->>'away')::int THEN 'home'
      WHEN ("currentScore"->>'away')::int > ("currentScore"->>'home')::int THEN 'away'
      ELSE 'draw'
    END,
    'outcome_text', CASE 
      WHEN ("currentScore"->>'home')::int > ("currentScore"->>'away")::int THEN 'Home Win'
      WHEN ("currentScore"->>'away")::int > ("currentScore"->>'home")::int THEN 'Away Win'
      ELSE 'Draw'
    END
  )
WHERE "matchId" = '1379152'
  AND status = 'LIVE'
  AND "currentScore" IS NOT NULL
  AND "finalResult" IS NULL;
*/

