-- CreateTable
CREATE TABLE "SystemHealth" (
    "id" TEXT NOT NULL,
    "serverStatus" TEXT NOT NULL,
    "apiResponseTime" INTEGER NOT NULL,
    "databaseStatus" TEXT NOT NULL,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "activeConnections" INTEGER NOT NULL,
    "cpuUsage" DOUBLE PRECISION NOT NULL,
    "memoryUsage" DOUBLE PRECISION NOT NULL,
    "diskUsage" DOUBLE PRECISION NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemHealth_pkey" PRIMARY KEY ("id")
);
