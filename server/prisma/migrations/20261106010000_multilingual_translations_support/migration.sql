-- AlterTable: Restaurant default language
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "defaultLanguage" TEXT NOT NULL DEFAULT 'en';

-- AlterTable: Category translations
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "translations" JSONB;

-- AlterTable: MenuItem translations
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "translations" JSONB;
