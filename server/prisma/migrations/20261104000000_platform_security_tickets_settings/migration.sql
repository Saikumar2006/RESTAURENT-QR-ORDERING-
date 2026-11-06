-- AlterTable
ALTER TABLE "PlatformAdmin" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformAdmin" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "PlatformAdmin" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "PlatformAdmin" ADD COLUMN "lastLoginIp" TEXT;

-- CreateTable
CREATE TABLE "PlatformSupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" SERIAL NOT NULL,
    "restaurantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "assignedAdminId" TEXT,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformSupportTicket_status_priority_idx" ON "PlatformSupportTicket"("status", "priority");

-- CreateIndex
CREATE INDEX "PlatformSupportTicket_restaurantId_idx" ON "PlatformSupportTicket"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

-- CreateIndex
CREATE INDEX "PlatformSetting_category_idx" ON "PlatformSetting"("category");

-- AddForeignKey
ALTER TABLE "PlatformSupportTicket" ADD CONSTRAINT "PlatformSupportTicket_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSupportTicket" ADD CONSTRAINT "PlatformSupportTicket_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
