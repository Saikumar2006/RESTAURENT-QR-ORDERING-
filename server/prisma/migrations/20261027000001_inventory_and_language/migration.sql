-- Additive tenant-scoped inventory, recipe mapping, and user language preference.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "baseUnit" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lowStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryItem_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InventoryUnitConversion" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "unitName" TEXT NOT NULL,
  "multiplierToBase" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryUnitConversion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryUnitConversion_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InventoryMovement" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "createdById" TEXT,
  "type" TEXT NOT NULL,
  "quantityDelta" DOUBLE PRECISION NOT NULL,
  "quantityBefore" DOUBLE PRECISION NOT NULL,
  "quantityAfter" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryMovement_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryMovement_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryMovement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RecipeComponent" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantityPerItem" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecipeComponent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecipeComponent_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecipeComponent_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecipeComponent_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_restaurantId_sku_key"
  ON "InventoryItem"("restaurantId", "sku");
CREATE INDEX IF NOT EXISTS "InventoryItem_restaurantId_isActive_name_idx"
  ON "InventoryItem"("restaurantId", "isActive", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryUnitConversion_inventoryItemId_unitName_key"
  ON "InventoryUnitConversion"("inventoryItemId", "unitName");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryMovement_restaurantId_idempotencyKey_key"
  ON "InventoryMovement"("restaurantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "InventoryMovement_restaurantId_inventoryItemId_createdAt_idx"
  ON "InventoryMovement"("restaurantId", "inventoryItemId", "createdAt");
CREATE INDEX IF NOT EXISTS "InventoryMovement_restaurantId_referenceId_type_idx"
  ON "InventoryMovement"("restaurantId", "referenceId", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "RecipeComponent_restaurantId_menuItemId_inventoryItemId_key"
  ON "RecipeComponent"("restaurantId", "menuItemId", "inventoryItemId");
CREATE INDEX IF NOT EXISTS "RecipeComponent_restaurantId_menuItemId_idx"
  ON "RecipeComponent"("restaurantId", "menuItemId");
