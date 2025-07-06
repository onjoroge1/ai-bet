/*
  Warnings:

  - You are about to drop the column `referenceId` on the `PointTransaction` table. All the data in the column will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `PointTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PackageCountryPrice" ADD COLUMN     "originalPrice" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "PointTransaction" DROP COLUMN "referenceId",
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "QuizParticipation" ADD COLUMN     "bonusPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditsClaimed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quizReferralCode" TEXT,
ADD COLUMN     "referralBonus" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificationSettings" JSONB,
ADD COLUMN     "pushNotifications" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "Notification";

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "isPushSent" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "actionUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "variables" TEXT[],
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePurchase" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "packageOfferId" TEXT,
    "packageType" TEXT NOT NULL,
    "countryId" TEXT,

    CONSTRAINT "PackagePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNotification_userId_isRead_idx" ON "UserNotification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "UserNotification_userId_type_idx" ON "UserNotification"("userId", "type");

-- CreateIndex
CREATE INDEX "UserNotification_userId_category_idx" ON "UserNotification"("userId", "category");

-- CreateIndex
CREATE INDEX "UserNotification_createdAt_idx" ON "UserNotification"("createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_expiresAt_idx" ON "UserNotification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_name_key" ON "NotificationTemplate"("name");

-- CreateIndex
CREATE INDEX "PackagePurchase_userId_idx" ON "PackagePurchase"("userId");

-- CreateIndex
CREATE INDEX "PackagePurchase_packageOfferId_idx" ON "PackagePurchase"("packageOfferId");

-- CreateIndex
CREATE INDEX "PackagePurchase_packageType_countryId_idx" ON "PackagePurchase"("packageType", "countryId");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_idx" ON "PointTransaction"("userId");

-- CreateIndex
CREATE INDEX "QuizParticipation_quizReferralCode_idx" ON "QuizParticipation"("quizReferralCode");

-- CreateIndex
CREATE INDEX "QuizParticipation_creditsClaimed_idx" ON "QuizParticipation"("creditsClaimed");

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
