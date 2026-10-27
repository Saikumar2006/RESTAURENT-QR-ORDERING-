-- Store only token hashes for restaurant staff onboarding and password resets.
CREATE TABLE "RestaurantStaffAccessLink" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "purpose" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RestaurantStaffAccessLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RestaurantStaffAccessLink_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RestaurantStaffAccessLink_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RestaurantStaffAccessLink_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RestaurantStaffAccessLink_tokenHash_key" ON "RestaurantStaffAccessLink"("tokenHash");
CREATE UNIQUE INDEX "RestaurantStaffAccessLink_userId_purpose_key" ON "RestaurantStaffAccessLink"("userId", "purpose");
CREATE INDEX "RestaurantStaffAccessLink_userId_purpose_consumedAt_expiresAt_idx" ON "RestaurantStaffAccessLink"("userId", "purpose", "consumedAt", "expiresAt");
CREATE INDEX "RestaurantStaffAccessLink_restaurantId_userId_purpose_consumedAt_idx" ON "RestaurantStaffAccessLink"("restaurantId", "userId", "purpose", "consumedAt");
