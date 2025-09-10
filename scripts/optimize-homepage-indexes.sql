-- Database Index Optimization for Homepage Performance
-- Run this script to add missing indexes for homepage API performance

-- Indexes for Prediction queries (homepage/predictions API)
CREATE INDEX IF NOT EXISTS idx_prediction_show_daily_tips ON "Prediction"("showInDailyTips") WHERE "showInDailyTips" = true;
CREATE INDEX IF NOT EXISTS idx_prediction_is_featured ON "Prediction"("isFeatured") WHERE "isFeatured" = true;
CREATE INDEX IF NOT EXISTS idx_prediction_confidence_score ON "Prediction"("confidenceScore" DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_value_rating ON "Prediction"("valueRating");
CREATE INDEX IF NOT EXISTS idx_prediction_created_at ON "Prediction"("createdAt" DESC);

-- Composite index for homepage predictions query
CREATE INDEX IF NOT EXISTS idx_prediction_homepage_composite ON "Prediction"("showInDailyTips", "isFeatured", "confidenceScore" DESC, "createdAt" DESC);

-- Indexes for Match queries (used in prediction includes)
CREATE INDEX IF NOT EXISTS idx_match_date_status ON "Match"("matchDate", "status");
CREATE INDEX IF NOT EXISTS idx_match_status ON "Match"("status") WHERE "status" IN ('upcoming', 'live');

-- Indexes for UserPrediction queries (homepage/stats API)
CREATE INDEX IF NOT EXISTS idx_user_prediction_status ON "UserPrediction"("status");
CREATE INDEX IF NOT EXISTS idx_user_prediction_status_won ON "UserPrediction"("status") WHERE "status" = 'won';

-- Indexes for UserPackage queries (homepage/stats API)
CREATE INDEX IF NOT EXISTS idx_user_package_status ON "UserPackage"("status") WHERE "status" = 'active';

-- Indexes for User queries (homepage/stats API)
CREATE INDEX IF NOT EXISTS idx_user_is_active ON "User"("isActive") WHERE "isActive" = true;

-- Indexes for Country queries (homepage/stats API)
CREATE INDEX IF NOT EXISTS idx_country_is_active ON "Country"("isActive") WHERE "isActive" = true;

-- Indexes for QuickPurchase queries (live-ticker API)
CREATE INDEX IF NOT EXISTS idx_quick_purchase_active ON "QuickPurchase"("isActive", "isPredictionActive") WHERE "isActive" = true AND "isPredictionActive" = true;
CREATE INDEX IF NOT EXISTS idx_quick_purchase_created_at ON "QuickPurchase"("createdAt" DESC);
-- Note: Cannot index predictionData JSON field directly due to size, using functional index instead
CREATE INDEX IF NOT EXISTS idx_quick_purchase_has_prediction_data ON "QuickPurchase"((("predictionData" IS NOT NULL)::boolean)) WHERE "predictionData" IS NOT NULL;

-- Composite index for live ticker query
CREATE INDEX IF NOT EXISTS idx_quick_purchase_live_ticker ON "QuickPurchase"("isActive", "isPredictionActive", "createdAt" DESC) WHERE "isActive" = true AND "isPredictionActive" = true;

-- Indexes for Team and League queries (used in includes)
CREATE INDEX IF NOT EXISTS idx_team_name ON "Team"("name");
CREATE INDEX IF NOT EXISTS idx_league_name ON "League"("name");

-- Analyze tables to update statistics
ANALYZE "Prediction";
ANALYZE "Match";
ANALYZE "UserPrediction";
ANALYZE "UserPackage";
ANALYZE "User";
ANALYZE "Country";
ANALYZE "QuickPurchase";
ANALYZE "Team";
ANALYZE "League";

-- Display index creation results
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('Prediction', 'Match', 'UserPrediction', 'UserPackage', 'User', 'Country', 'QuickPurchase', 'Team', 'League')
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
