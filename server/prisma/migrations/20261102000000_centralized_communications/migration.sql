-- AlterTable Restaurant: add notificationPhone and ownerAlertsEnabled
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "notificationPhone" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ownerAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable NotificationLog: add provider, delivery tracking, and idempotency
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'twilio';
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable CommunicationTemplate
CREATE TABLE IF NOT EXISTS "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'both',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationLog_idempotencyKey_key" ON "NotificationLog"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "NotificationLog_phone_createdAt_idx" ON "NotificationLog"("phone", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationLog_status_idx" ON "NotificationLog"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "CommunicationTemplate_key_key" ON "CommunicationTemplate"("key");
