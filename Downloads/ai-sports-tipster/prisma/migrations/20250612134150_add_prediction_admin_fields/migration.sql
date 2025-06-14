-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN     "matchesInAccumulator" JSONB,
ADD COLUMN     "potentialReturn" DECIMAL(65,30),
ADD COLUMN     "showInDailyTips" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showInWeeklySpecials" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stake" DECIMAL(65,30),
ADD COLUMN     "totalOdds" DECIMAL(65,30),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'single';
