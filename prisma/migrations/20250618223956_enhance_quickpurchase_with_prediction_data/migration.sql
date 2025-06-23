-- AlterTable
ALTER TABLE "QuickPurchase" ADD COLUMN     "analysisSummary" TEXT,
ADD COLUMN     "confidenceScore" INTEGER,
ADD COLUMN     "isPredictionActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "matchData" JSONB,
ADD COLUMN     "matchId" TEXT,
ADD COLUMN     "odds" DECIMAL(65,30),
ADD COLUMN     "predictionData" JSONB,
ADD COLUMN     "predictionType" TEXT,
ADD COLUMN     "valueRating" TEXT;
