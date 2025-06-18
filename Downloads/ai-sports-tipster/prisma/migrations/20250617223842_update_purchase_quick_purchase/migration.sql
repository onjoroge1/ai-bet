/*
  Warnings:

  - You are about to drop the column `predictionId` on the `Purchase` table. All the data in the column will be lost.
  - You are about to drop the column `tipSnapshot` on the `Purchase` table. All the data in the column will be lost.
  - Added the required column `quickPurchaseId` to the `Purchase` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_predictionId_fkey";

-- DropIndex
DROP INDEX "Purchase_predictionId_idx";

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "predictionId",
DROP COLUMN "tipSnapshot",
ADD COLUMN     "quickPurchaseId" TEXT NOT NULL,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "status" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Purchase_quickPurchaseId_idx" ON "Purchase"("quickPurchaseId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_quickPurchaseId_fkey" FOREIGN KEY ("quickPurchaseId") REFERENCES "QuickPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
