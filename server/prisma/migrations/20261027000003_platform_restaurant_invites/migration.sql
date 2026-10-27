-- Platform-created accounts start with a non-expiring platform grant.
-- NULL represents an indefinite end date; existing subscription dates remain intact.
ALTER TABLE "Subscription" ALTER COLUMN "endsAt" DROP NOT NULL;

-- Store only a hash of each one-time account setup token.
CREATE TABLE "PlatformRestaurantInvite" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdByAdminId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformRestaurantInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformRestaurantInvite_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformRestaurantInvite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformRestaurantInvite_createdByAdminId_fkey"
    FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlatformRestaurantInvite_tokenHash_key" ON "PlatformRestaurantInvite"("tokenHash");
CREATE INDEX "PlatformRestaurantInvite_userId_consumedAt_expiresAt_idx" ON "PlatformRestaurantInvite"("userId", "consumedAt", "expiresAt");
CREATE INDEX "PlatformRestaurantInvite_restaurantId_createdAt_idx" ON "PlatformRestaurantInvite"("restaurantId", "createdAt");
