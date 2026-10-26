-- Add tenant-scoped, versioned website appearance configuration.
-- Existing restaurants start at version 0 and receive the default theme in
-- application code until an owner saves or publishes a revision.
ALTER TABLE "Restaurant"
  ADD COLUMN IF NOT EXISTS "websiteThemeVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "WebsiteThemeVersion" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "config" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "WebsiteThemeVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteThemeVersion_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteThemeVersion_restaurantId_version_key"
  ON "WebsiteThemeVersion"("restaurantId", "version");
CREATE INDEX IF NOT EXISTS "WebsiteThemeVersion_restaurantId_status_version_idx"
  ON "WebsiteThemeVersion"("restaurantId", "status", "version");
