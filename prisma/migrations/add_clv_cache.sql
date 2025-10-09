-- CreateTable for CLV Opportunity Cache
-- This stores CLV opportunities for low-bandwidth users

CREATE TABLE IF NOT EXISTS "CLVOpportunityCache" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "marketType" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "entryOdds" DECIMAL(65,30) NOT NULL,
    "closeOdds" DECIMAL(65,30) NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "timeBucket" TEXT NOT NULL,
    "windowFilter" TEXT NOT NULL DEFAULT 'all',
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CLVOpportunityCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CLVOpportunityCache_cachedAt_idx" ON "CLVOpportunityCache"("cachedAt");
CREATE INDEX IF NOT EXISTS "CLVOpportunityCache_windowFilter_idx" ON "CLVOpportunityCache"("windowFilter");
CREATE INDEX IF NOT EXISTS "CLVOpportunityCache_matchDate_idx" ON "CLVOpportunityCache"("matchDate");
CREATE UNIQUE INDEX IF NOT EXISTS "CLVOpportunityCache_matchId_marketType_selection_windowFilter_key" ON "CLVOpportunityCache"("matchId", "marketType", "selection", "windowFilter");

