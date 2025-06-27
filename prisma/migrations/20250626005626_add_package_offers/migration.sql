-- CreateTable
CREATE TABLE "PackageOffer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packageType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tipCount" INTEGER NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT[],
    "iconName" TEXT NOT NULL DEFAULT 'Gift',
    "colorGradientFrom" TEXT NOT NULL DEFAULT '#8B5CF6',
    "colorGradientTo" TEXT NOT NULL DEFAULT '#EC4899',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageOfferCountryPrice" (
    "id" TEXT NOT NULL,
    "packageOfferId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "originalPrice" DECIMAL(65,30),
    "currencyCode" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageOfferCountryPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPackage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageOfferId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "tipsRemaining" INTEGER NOT NULL,
    "totalTips" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "pricePaid" DECIMAL(65,30) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPackageTip" (
    "id" TEXT NOT NULL,
    "userPackageId" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPackageTip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageOfferCountryPrice_packageOfferId_countryId_key" ON "PackageOfferCountryPrice"("packageOfferId", "countryId");

-- CreateIndex
CREATE INDEX "UserPackage_userId_status_idx" ON "UserPackage"("userId", "status");

-- CreateIndex
CREATE INDEX "UserPackage_expiresAt_idx" ON "UserPackage"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPackageTip_userPackageId_predictionId_key" ON "UserPackageTip"("userPackageId", "predictionId");

-- AddForeignKey
ALTER TABLE "PackageOfferCountryPrice" ADD CONSTRAINT "PackageOfferCountryPrice_packageOfferId_fkey" FOREIGN KEY ("packageOfferId") REFERENCES "PackageOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageOfferCountryPrice" ADD CONSTRAINT "PackageOfferCountryPrice_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPackage" ADD CONSTRAINT "UserPackage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPackage" ADD CONSTRAINT "UserPackage_packageOfferId_fkey" FOREIGN KEY ("packageOfferId") REFERENCES "PackageOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPackageTip" ADD CONSTRAINT "UserPackageTip_userPackageId_fkey" FOREIGN KEY ("userPackageId") REFERENCES "UserPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPackageTip" ADD CONSTRAINT "UserPackageTip_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
