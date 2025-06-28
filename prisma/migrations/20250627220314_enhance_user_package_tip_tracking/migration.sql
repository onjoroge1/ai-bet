-- AlterTable
ALTER TABLE "UserPackageTip" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'claimed',
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TipUsage" (
    "id" TEXT NOT NULL,
    "userPackageTipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stakeAmount" DECIMAL(65,30),
    "actualReturn" DECIMAL(65,30),
    "notes" TEXT,

    CONSTRAINT "TipUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipUsage_userPackageTipId_key" ON "TipUsage"("userPackageTipId");

-- CreateIndex
CREATE INDEX "TipUsage_userId_idx" ON "TipUsage"("userId");

-- CreateIndex
CREATE INDEX "TipUsage_usedAt_idx" ON "TipUsage"("usedAt");

-- CreateIndex
CREATE INDEX "UserPackageTip_status_idx" ON "UserPackageTip"("status");

-- CreateIndex
CREATE INDEX "UserPackageTip_expiresAt_idx" ON "UserPackageTip"("expiresAt");

-- AddForeignKey
ALTER TABLE "TipUsage" ADD CONSTRAINT "TipUsage_userPackageTipId_fkey" FOREIGN KEY ("userPackageTipId") REFERENCES "UserPackageTip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipUsage" ADD CONSTRAINT "TipUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
