-- Additive unified order metadata; existing orders are classified as Svaadya QR.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'SVAADYA_QR';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "externalOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyFingerprint" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "settlementStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';

CREATE INDEX IF NOT EXISTS "Order_restaurantId_source_createdAt_idx"
  ON "Order"("restaurantId", "source", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_restaurantId_source_externalOrderId_key"
  ON "Order"("restaurantId", "source", "externalOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_restaurantId_idempotencyKey_key"
  ON "Order"("restaurantId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_providerPaymentId_key"
  ON "Payment"("provider", "providerPaymentId");
