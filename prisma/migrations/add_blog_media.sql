-- Add BlogMedia table
CREATE TABLE "BlogMedia" (
    "id" TEXT NOT NULL,
    "blogPostId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogMedia_pkey" PRIMARY KEY ("id")
);

-- Add indexes for performance
CREATE INDEX "BlogMedia_blogPostId_idx" ON "BlogMedia"("blogPostId");
CREATE INDEX "BlogMedia_type_idx" ON "BlogMedia"("type");
CREATE INDEX "BlogMedia_uploadedAt_idx" ON "BlogMedia"("uploadedAt");

-- Add foreign key constraint
ALTER TABLE "BlogMedia" ADD CONSTRAINT "BlogMedia_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
