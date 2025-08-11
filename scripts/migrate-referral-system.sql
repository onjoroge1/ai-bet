-- Migration script for enhanced referral system
-- Run this script to update your existing database

-- 1. Create ReferralCode table
CREATE TABLE IF NOT EXISTS "ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsage" INTEGER,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- 2. Create unique index on referral code
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCode_code_key" ON "ReferralCode"("code");

-- 3. Create unique index on userId (one referral code per user)
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCode_userId_key" ON "ReferralCode"("userId");

-- 4. Add foreign key constraint
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Update existing Referral table to add new fields
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "rewardCredits" INTEGER DEFAULT 0;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "rewardPoints" INTEGER DEFAULT 0;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "metadata" TEXT; -- JSON field for additional data
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "referralType" TEXT DEFAULT 'quiz';

-- 6. Update existing Referral table to add new fields (if they don't exist)
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "commissionAmount" DECIMAL(10,2) DEFAULT 0;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'pending';
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "completedAt" DATETIME;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "expiresAt" DATETIME;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "packageRewardId" TEXT;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "pointsEarned" INTEGER DEFAULT 0;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "creditsEarned" INTEGER DEFAULT 0;
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "quizParticipationId" TEXT;

-- 7. Add foreign key constraints for new fields
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_packageRewardId_fkey" FOREIGN KEY ("packageRewardId") REFERENCES "PackageReward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_quizParticipationId_fkey" FOREIGN KEY ("quizParticipationId") REFERENCES "QuizParticipation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. Update User table to add new fields (if they don't exist)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalCreditsEarned" INTEGER DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalPointsEarned" INTEGER DEFAULT 0;

-- 9. Create UserPoints table if it doesn't exist
CREATE TABLE IF NOT EXISTS "UserPoints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPoints_pkey" PRIMARY KEY ("id")
);

-- 10. Create unique index on userId for UserPoints
CREATE UNIQUE INDEX IF NOT EXISTS "UserPoints_userId_key" ON "UserPoints"("userId");

-- 11. Add foreign key constraint for UserPoints
ALTER TABLE "UserPoints" ADD CONSTRAINT "UserPoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 12. Update existing referrals to have proper status
UPDATE "Referral" SET "status" = 'completed' WHERE "status" IS NULL AND "pointsEarned" > 0;
UPDATE "Referral" SET "status" = 'pending' WHERE "status" IS NULL;

-- 13. Set default expiration dates for existing referrals (30 days from creation)
UPDATE "Referral" SET "expiresAt" = datetime("createdAt", '+30 days') WHERE "expiresAt" IS NULL;

-- 14. Create indexes for better performance
CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx" ON "Referral"("referrerId");
CREATE INDEX IF NOT EXISTS "Referral_status_idx" ON "Referral"("status");
CREATE INDEX IF NOT EXISTS "Referral_createdAt_idx" ON "Referral"("createdAt");
CREATE INDEX IF NOT EXISTS "ReferralCode_isActive_idx" ON "ReferralCode"("isActive");
CREATE INDEX IF NOT EXISTS "ReferralCode_expiresAt_idx" ON "ReferralCode"("expiresAt");

-- 15. Insert sample referral codes for existing users (optional)
-- This will generate referral codes for users who don't have them yet
INSERT OR IGNORE INTO "ReferralCode" ("id", "userId", "code", "isActive", "createdAt", "updatedAt")
SELECT 
    'rc_' || substr(hex(randomblob(16)), 1, 24),
    u.id,
    upper(substr(hex(randomblob(8)), 1, 8)),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM "ReferralCode" rc WHERE rc."userId" = u.id
);

-- 16. Update existing referrals to use the new structure
-- Convert old referralCode field to use the new ReferralCode table
UPDATE "Referral" r
SET "referralCode" = (
    SELECT rc.code 
    FROM "ReferralCode" rc 
    WHERE rc."userId" = r."referrerId"
)
WHERE r."referralCode" IS NULL OR r."referralCode" = '';

-- 17. Clean up any orphaned referrals
DELETE FROM "Referral" 
WHERE "referrerId" NOT IN (SELECT "id" FROM "User");

-- 18. Set default values for new fields
UPDATE "Referral" SET "rewardCredits" = 50 WHERE "rewardCredits" = 0 AND "status" = 'completed';
UPDATE "Referral" SET "rewardPoints" = 100 WHERE "rewardPoints" = 0 AND "status" = 'completed';

-- 19. Update user statistics
UPDATE "User" u
SET "totalReferrals" = (
    SELECT COUNT(*) FROM "Referral" r WHERE r."referrerId" = u.id
);

UPDATE "User" u
SET "totalReferralEarnings" = (
    SELECT COALESCE(SUM(r."rewardCredits"), 0) 
    FROM "Referral" r 
    WHERE r."referrerId" = u.id AND r."status" = 'completed'
);

-- 20. Create initial UserPoints records for users who don't have them
INSERT OR IGNORE INTO "UserPoints" ("id", "userId", "points", "totalEarned", "totalSpent", "lastUpdated")
SELECT 
    'up_' || substr(hex(randomblob(16)), 1, 24),
    u.id,
    COALESCE(u."totalReferralEarnings", 0),
    COALESCE(u."totalReferralEarnings", 0),
    0,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM "UserPoints" up WHERE up."userId" = u.id
);

-- 21. Update UserPoints with existing referral earnings
UPDATE "UserPoints" up
SET 
    "points" = (
        SELECT COALESCE(SUM(r."rewardPoints"), 0) 
        FROM "Referral" r 
        WHERE r."referrerId" = up."userId" AND r."status" = 'completed'
    ),
    "totalEarned" = (
        SELECT COALESCE(SUM(r."rewardPoints"), 0) 
        FROM "Referral" r 
        WHERE r."referrerId" = up."userId" AND r."status" = 'completed'
    )
WHERE EXISTS (
    SELECT 1 FROM "Referral" r WHERE r."referrerId" = up."userId" AND r."status" = 'completed'
);

-- Migration completed successfully!
-- The referral system is now enhanced with:
-- - Unique referral codes per user
-- - Better tracking and statistics
-- - Proper reward distribution
-- - Enhanced user experience 