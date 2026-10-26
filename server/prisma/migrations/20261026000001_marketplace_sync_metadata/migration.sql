-- Additive marketplace source state and durable provider event dedupe keys.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "sourceStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "syncError" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceMetadata" TEXT;

CREATE TABLE IF NOT EXISTS "MarketplaceWebhookEvent" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "externalOrderId" TEXT,
  "orderId" TEXT,
  "sourceUpdatedAt" TIMESTAMP(3),
  "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "errorCode" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "MarketplaceWebhookEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceWebhookEvent_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceWebhookEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceWebhookEvent_restaurantId_source_eventId_key"
  ON "MarketplaceWebhookEvent"("restaurantId", "source", "eventId");
CREATE INDEX IF NOT EXISTS "MarketplaceWebhookEvent_restaurantId_source_receivedAt_idx"
  ON "MarketplaceWebhookEvent"("restaurantId", "source", "receivedAt");
CREATE INDEX IF NOT EXISTS "MarketplaceWebhookEvent_orderId_idx"
  ON "MarketplaceWebhookEvent"("orderId");
