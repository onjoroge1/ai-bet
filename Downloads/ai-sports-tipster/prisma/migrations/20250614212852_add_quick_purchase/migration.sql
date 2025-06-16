-- CreateTable
CREATE TABLE "QuickPurchase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "originalPrice" DECIMAL(65,30),
    "description" TEXT NOT NULL,
    "features" TEXT[],
    "type" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "colorGradientFrom" TEXT NOT NULL,
    "colorGradientTo" TEXT NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "timeLeft" TEXT,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "discountPercentage" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "targetLink" TEXT,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickPurchase_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuickPurchase" ADD CONSTRAINT "QuickPurchase_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
