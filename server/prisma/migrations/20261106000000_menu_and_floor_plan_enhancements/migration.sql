-- AlterTable: Table additions for 2D Floor Plan
ALTER TABLE "Table" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Table" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'Indoor';
ALTER TABLE "Table" ADD COLUMN "shape" TEXT NOT NULL DEFAULT 'round';
ALTER TABLE "Table" ADD COLUMN "posX" DOUBLE PRECISION NOT NULL DEFAULT 120;
ALTER TABLE "Table" ADD COLUMN "posY" DOUBLE PRECISION NOT NULL DEFAULT 120;
ALTER TABLE "Table" ADD COLUMN "width" DOUBLE PRECISION NOT NULL DEFAULT 90;
ALTER TABLE "Table" ADD COLUMN "height" DOUBLE PRECISION NOT NULL DEFAULT 90;
ALTER TABLE "Table" ADD COLUMN "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Table" ADD COLUMN "chairCount" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Table" ADD COLUMN "chairPositions" JSONB;
ALTER TABLE "Table" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable: MenuItem additions for Variants, Addons, Bestseller and Soft-delete
ALTER TABLE "MenuItem" ADD COLUMN "isBestseller" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MenuItem" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MenuItem" ADD COLUMN "variants" JSONB;
ALTER TABLE "MenuItem" ADD COLUMN "addons" JSONB;

-- CreateTable: FloorLayout for visual canvas elements per section
CREATE TABLE "FloorLayout" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'Indoor',
    "objects" JSONB,
    "gridSnap" BOOLEAN NOT NULL DEFAULT true,
    "gridSize" INTEGER NOT NULL DEFAULT 20,
    "canvasWidth" DOUBLE PRECISION NOT NULL DEFAULT 1600,
    "canvasHeight" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "zoom" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "panX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "panY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "Table_restaurantId_section_idx" ON "Table"("restaurantId", "section");
CREATE INDEX "MenuItem_restaurantId_isDeleted_idx" ON "MenuItem"("restaurantId", "isDeleted");
CREATE UNIQUE INDEX "FloorLayout_restaurantId_section_key" ON "FloorLayout"("restaurantId", "section");
CREATE INDEX "FloorLayout_restaurantId_idx" ON "FloorLayout"("restaurantId");

-- AddForeignKey
ALTER TABLE "FloorLayout" ADD CONSTRAINT "FloorLayout_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
