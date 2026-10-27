-- Optional supplier and purchase records. Receipts remain in the inventory
-- movement ledger; each purchase line links to exactly one receipt movement.
CREATE TABLE "InventorySupplier" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventorySupplier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventorySupplier_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "InventoryPurchase" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "supplierId" TEXT,
  "createdById" TEXT,
  "invoiceNumber" TEXT,
  "notes" TEXT,
  "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "idempotencyKey" TEXT NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryPurchase_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryPurchase_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InventoryPurchase_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "InventoryPurchaseLine" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "movementId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "unitCost" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryPurchaseLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryPurchaseLine_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "InventoryPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryPurchaseLine_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryPurchaseLine_movementId_fkey"
    FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InventorySupplier_restaurantId_name_key" ON "InventorySupplier"("restaurantId", "name");
CREATE INDEX "InventorySupplier_restaurantId_isActive_name_idx" ON "InventorySupplier"("restaurantId", "isActive", "name");
CREATE UNIQUE INDEX "InventoryPurchase_restaurantId_idempotencyKey_key" ON "InventoryPurchase"("restaurantId", "idempotencyKey");
CREATE INDEX "InventoryPurchase_restaurantId_purchasedAt_idx" ON "InventoryPurchase"("restaurantId", "purchasedAt");
CREATE INDEX "InventoryPurchase_restaurantId_supplierId_purchasedAt_idx" ON "InventoryPurchase"("restaurantId", "supplierId", "purchasedAt");
CREATE UNIQUE INDEX "InventoryPurchaseLine_movementId_key" ON "InventoryPurchaseLine"("movementId");
CREATE UNIQUE INDEX "InventoryPurchaseLine_purchaseId_inventoryItemId_key" ON "InventoryPurchaseLine"("purchaseId", "inventoryItemId");
CREATE INDEX "InventoryPurchaseLine_inventoryItemId_createdAt_idx" ON "InventoryPurchaseLine"("inventoryItemId", "createdAt");
