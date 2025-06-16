-- CreateTable
CREATE TABLE "PackageCountryPrice" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "packageType" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PackageCountryPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageCountryPrice_countryId_packageType_key" ON "PackageCountryPrice"("countryId", "packageType");

-- AddForeignKey
ALTER TABLE "PackageCountryPrice" ADD CONSTRAINT "PackageCountryPrice_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
