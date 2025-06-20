/*
  Warnings:

  - A unique constraint covering the columns `[matchId]` on the table `QuickPurchase` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "QuickPurchase_matchId_key" ON "QuickPurchase"("matchId");
