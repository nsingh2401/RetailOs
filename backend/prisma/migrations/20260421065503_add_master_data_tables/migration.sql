/*
  Warnings:

  - You are about to alter the column `ip_address` on the `event_logs` table. The data in that column could be lost. The data in that column will be cast from `Inet` to `Unsupported("inet")`.

*/
-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "is_custom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "master_brand_id" UUID;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "is_custom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "master_category_id" UUID;

-- AlterTable
ALTER TABLE "event_logs" ALTER COLUMN "ip_address" SET DATA TYPE inet;

-- CreateTable
CREATE TABLE "app_config" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "master_industry_config" (
    "industry_type" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "batch_tracking_required" BOOLEAN NOT NULL DEFAULT false,
    "requires_batch_expiry" BOOLEAN NOT NULL DEFAULT false,
    "default_pricing_type" VARCHAR(30) NOT NULL,
    "allowed_pricing_types" JSONB NOT NULL,
    "default_unit" VARCHAR(20) NOT NULL,
    "allowed_units" JSONB NOT NULL,
    "variant_attributes" JSONB NOT NULL,
    "special_fields" JSONB NOT NULL,
    "data_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "master_industry_config_pkey" PRIMARY KEY ("industry_type")
);

-- CreateTable
CREATE TABLE "master_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "industry_type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "master_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_brands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "industries" JSONB NOT NULL,
    "is_popular" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "master_brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_categories_industry_type_idx" ON "master_categories"("industry_type");

-- CreateIndex
CREATE UNIQUE INDEX "master_categories_industry_type_name_parent_id_key" ON "master_categories"("industry_type", "name", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "master_brands_name_key" ON "master_brands"("name");

-- AddForeignKey
ALTER TABLE "master_categories" ADD CONSTRAINT "master_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "master_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
