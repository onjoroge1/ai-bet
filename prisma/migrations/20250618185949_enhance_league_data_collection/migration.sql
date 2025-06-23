/*
  Warnings:

  - Added the required column `updatedAt` to the `League` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "League" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dataCollectionPriority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "externalLeagueId" TEXT,
ADD COLUMN     "isDataCollectionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isPredictionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastDataSync" TIMESTAMP(3),
ADD COLUMN     "matchLimit" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "syncFrequency" TEXT NOT NULL DEFAULT 'daily',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to set updatedAt to current timestamp
UPDATE "League" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- CreateIndex
CREATE INDEX "League_isDataCollectionEnabled_dataCollectionPriority_idx" ON "League"("isDataCollectionEnabled", "dataCollectionPriority");

-- CreateIndex
CREATE INDEX "League_externalLeagueId_idx" ON "League"("externalLeagueId");
