-- CreateEnum
CREATE TYPE "tax_regime_type" AS ENUM ('GST', 'VAT', 'SALES_TAX', 'EXEMPT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "user_type" AS ENUM ('OWNER', 'MANAGER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "store_role" AS ENUM ('OWNER', 'MANAGER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "industry_type" AS ENUM ('APPAREL', 'FOOTWEAR', 'GROCERY', 'PHARMACY', 'ELECTRONICS', 'HARDWARE', 'OPTICAL', 'KITCHENWARE', 'STATIONERY', 'TOYS', 'GIFT', 'BAKERY', 'PAINT', 'FURNITURE', 'JEWELRY', 'BAGS', 'TEA_CAFE', 'PAAN_CIGARETTE', 'GENERAL');

-- CreateEnum
CREATE TYPE "pricing_type" AS ENUM ('FIXED', 'WEIGHT', 'LOOSE', 'NEGOTIABLE', 'MRP');

-- CreateEnum
CREATE TYPE "barcode_type" AS ENUM ('EAN13', 'EAN8', 'QR', 'CODE128', 'UPC', 'GS1', 'INTERNAL');

-- CreateEnum
CREATE TYPE "unit_of_measure" AS ENUM ('PCS', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'BOX', 'PAIR', 'DOZEN', 'SQFT', 'PACK');

-- CreateEnum
CREATE TYPE "movement_type" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'AUDIT', 'RETURN', 'DAMAGE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'UPI', 'CREDIT', 'CARD', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "credit_entry_type" AS ENUM ('CREDIT_SALE', 'PAYMENT', 'ADJUSTMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'CONFLICT', 'FAILED');

-- CreateEnum
CREATE TYPE "sync_operation" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "sync_entity_type" AS ENUM ('INVOICE', 'INVENTORY_MOVEMENT', 'PAYMENT', 'CUSTOMER', 'PURCHASE_ENTRY');

-- CreateEnum
CREATE TYPE "platform_type" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "fx_source" AS ENUM ('RBI', 'ECB', 'OPEN_EXCHANGE', 'MANUAL');

-- CreateEnum
CREATE TYPE "camera_angle" AS ENUM ('FRONT', 'BACK', 'SIDE', 'BARCODE', 'LABEL', 'TOP');

-- CreateEnum
CREATE TYPE "lighting_condition" AS ENUM ('NATURAL', 'FLUORESCENT', 'POOR', 'BRIGHT');

-- CreateTable
CREATE TABLE "organizations" (
    "org_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan_id" VARCHAR(50) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "default_currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "tax_regime" "tax_regime_type" NOT NULL DEFAULT 'GST',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-IN',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("org_id")
);

-- CreateTable
CREATE TABLE "stores" (
    "store_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "store_code" VARCHAR(30) NOT NULL,
    "industry_type" "industry_type" NOT NULL DEFAULT 'GENERAL',
    "address" JSONB NOT NULL DEFAULT '{}',
    "phone" VARCHAR(20),
    "gstin" VARCHAR(20),
    "tax_id" VARCHAR(50),
    "currency_code" CHAR(3) NOT NULL DEFAULT 'INR',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("store_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "user_type" "user_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_store_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "role" "store_role" NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_store_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rules" (
    "tax_rule_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tax_regime" "tax_regime_type" NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "total_rate" DECIMAL(8,4) NOT NULL,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("tax_rule_id")
);

-- CreateTable
CREATE TABLE "tax_components" (
    "component_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tax_rule_id" UUID NOT NULL,
    "component_name" VARCHAR(50) NOT NULL,
    "rate" DECIMAL(8,4) NOT NULL,
    "ledger_account" VARCHAR(50),

    CONSTRAINT "tax_components_pkey" PRIMARY KEY ("component_id")
);

-- CreateTable
CREATE TABLE "hsn_codes" (
    "hsn_code" VARCHAR(20) NOT NULL,
    "description" TEXT NOT NULL,
    "default_gst_rate" DECIMAL(5,2) NOT NULL,
    "category" VARCHAR(100),
    "is_service" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "hsn_codes_pkey" PRIMARY KEY ("hsn_code")
);

-- CreateTable
CREATE TABLE "currencies" (
    "currency_code" CHAR(3) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(5) NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("currency_code")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "rate_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "base_currency" CHAR(3) NOT NULL,
    "quote_currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" "fx_source" NOT NULL DEFAULT 'MANUAL',
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("rate_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "category_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(150) NOT NULL,
    "industry_type" "industry_type",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "brands" (
    "brand_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "manufacturer" VARCHAR(200),
    "contact_info" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("brand_id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "category_id" UUID,
    "brand_id" UUID,
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "internal_sku" VARCHAR(100) NOT NULL,
    "barcode" VARCHAR(100),
    "barcode_type" "barcode_type",
    "hsn_code" VARCHAR(20),
    "tax_rule_id" UUID,
    "pricing_type" "pricing_type" NOT NULL DEFAULT 'FIXED',
    "selling_price" DECIMAL(15,4) NOT NULL,
    "purchase_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "mrp" DECIMAL(15,4),
    "unit_of_measure" "unit_of_measure" NOT NULL DEFAULT 'PCS',
    "has_variants" BOOLEAN NOT NULL DEFAULT false,
    "has_batches" BOOLEAN NOT NULL DEFAULT false,
    "low_stock_threshold" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" VARCHAR(500),
    "ai_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "variant_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "variant_sku" VARCHAR(150) NOT NULL,
    "barcode" VARCHAR(100),
    "variant_attributes" JSONB NOT NULL DEFAULT '{}',
    "price_override" DECIMAL(15,4),
    "purchase_price" DECIMAL(15,4),
    "stock_quantity" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("variant_id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "image_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "camera_angle" "camera_angle",
    "lighting" "lighting_condition",
    "capture_device" VARCHAR(50),
    "is_labeled" BOOLEAN NOT NULL DEFAULT false,
    "ai_labels" JSONB,
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("image_id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "inventory_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "reserved_qty" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "reorder_point" DECIMAL(15,4),
    "last_counted_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("inventory_id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "movement_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "movement_type" "movement_type" NOT NULL,
    "quantity_delta" DECIMAL(15,4) NOT NULL,
    "quantity_before" DECIMAL(15,4) NOT NULL,
    "quantity_after" DECIMAL(15,4) NOT NULL,
    "reference_type" VARCHAR(30),
    "reference_id" UUID,
    "batch_id" UUID,
    "notes" TEXT,
    "performed_by" UUID NOT NULL,
    "device_id" VARCHAR(100),
    "synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("movement_id")
);

-- CreateTable
CREATE TABLE "batches" (
    "batch_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "batch_number" VARCHAR(100) NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "remaining_qty" DECIMAL(15,4) NOT NULL,
    "manufacturing_date" DATE,
    "expiry_date" DATE,
    "purchase_price" DECIMAL(15,4) NOT NULL,
    "is_expired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "purchase_entries" (
    "purchase_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "brand_id" UUID,
    "invoice_number" VARCHAR(100),
    "purchase_date" DATE NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(15,6) NOT NULL DEFAULT 1,
    "total_amount" DECIMAL(15,4) NOT NULL,
    "total_amount_base" DECIMAL(15,4) NOT NULL,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_entries_pkey" PRIMARY KEY ("purchase_id")
);

-- CreateTable
CREATE TABLE "purchase_entry_items" (
    "item_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "batch_id" UUID,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit_cost" DECIMAL(15,4) NOT NULL,
    "total_cost" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "purchase_entry_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "address" JSONB,
    "credit_limit" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "outstanding_balance" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_purchases" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "invoice_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "customer_id" UUID,
    "invoice_number" VARCHAR(50) NOT NULL,
    "invoice_date" DATE NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(15,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(15,4) NOT NULL,
    "tax_total" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,4) NOT NULL,
    "grand_total_base" DECIMAL(15,4) NOT NULL,
    "paid_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "payment_mode" "payment_method",
    "notes" TEXT,
    "billed_by" UUID NOT NULL,
    "device_id" VARCHAR(100),
    "local_id" VARCHAR(100),
    "synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("invoice_id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "line_item_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "batch_id" UUID,
    "product_name" VARCHAR(300) NOT NULL,
    "variant_attrs" JSONB,
    "hsn_code" VARCHAR(20),
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit_price" DECIMAL(15,4) NOT NULL,
    "discount_pct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,4) NOT NULL,
    "tax_rule_id" UUID,
    "tax_breakdown" JSONB NOT NULL DEFAULT '{}',
    "tax_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("line_item_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "reference_no" VARCHAR(100),
    "payment_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID NOT NULL,
    "synced_at" TIMESTAMPTZ,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "customer_credit_ledger" (
    "ledger_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "entry_type" "credit_entry_type" NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL,
    "balance_after" DECIMAL(15,4) NOT NULL,
    "reference_type" VARCHAR(20),
    "reference_id" UUID,
    "notes" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credit_ledger_pkey" PRIMARY KEY ("ledger_id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40),
    "entity_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "device_id" VARCHAR(100),
    "ip_address" inet,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "sync_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" VARCHAR(100) NOT NULL,
    "store_id" UUID NOT NULL,
    "entity_type" "sync_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "operation" "sync_operation" NOT NULL,
    "payload" JSONB NOT NULL,
    "local_sequence" BIGINT NOT NULL,
    "status" "sync_status" NOT NULL DEFAULT 'PENDING',
    "conflict_data" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMPTZ,

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("sync_id")
);

-- CreateTable
CREATE TABLE "device_registry" (
    "device_id" VARCHAR(100) NOT NULL,
    "store_id" UUID NOT NULL,
    "user_id" UUID,
    "device_name" VARCHAR(100),
    "platform" "platform_type" NOT NULL,
    "app_version" VARCHAR(20),
    "last_sync_at" TIMESTAMPTZ,
    "last_seen_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "device_registry_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "user_id" UUID,
    "table_name" VARCHAR(60) NOT NULL,
    "record_id" UUID NOT NULL,
    "operation" VARCHAR(10) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "stores_store_code_key" ON "stores"("store_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_store_roles_user_id_store_id_key" ON "user_store_roles"("user_id", "store_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rules_org_id_name_key" ON "tax_rules"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_base_currency_quote_currency_effective_date_key" ON "fx_rates"("base_currency", "quote_currency", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "categories_store_id_name_parent_id_key" ON "categories"("store_id", "name", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_store_id_name_key" ON "brands"("store_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_store_id_internal_sku_key" ON "products"("store_id", "internal_sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_store_id_variant_sku_key" ON "product_variants"("store_id", "variant_sku");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_store_id_variant_id_key" ON "inventory"("store_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "batches_store_id_variant_id_batch_number_key" ON "batches"("store_id", "variant_id", "batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_store_id_invoice_number_key" ON "invoices"("store_id", "invoice_number");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_store_roles" ADD CONSTRAINT "user_store_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_store_roles" ADD CONSTRAINT "user_store_roles_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_store_roles" ADD CONSTRAINT "user_store_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_components" ADD CONSTRAINT "tax_components_tax_rule_id_fkey" FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("tax_rule_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("currency_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_quote_currency_fkey" FOREIGN KEY ("quote_currency") REFERENCES "currencies"("currency_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("brand_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_hsn_code_fkey" FOREIGN KEY ("hsn_code") REFERENCES "hsn_codes"("hsn_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tax_rule_id_fkey" FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("tax_rule_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_entries" ADD CONSTRAINT "purchase_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_entries" ADD CONSTRAINT "purchase_entries_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("brand_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_entries" ADD CONSTRAINT "purchase_entries_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("currency_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_entries" ADD CONSTRAINT "purchase_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_entry_items" ADD CONSTRAINT "purchase_entry_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchase_entries"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_entry_items" ADD CONSTRAINT "purchase_entry_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_entry_items" ADD CONSTRAINT "purchase_entry_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("currency_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billed_by_fkey" FOREIGN KEY ("billed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_tax_rule_id_fkey" FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("tax_rule_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("currency_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_ledger" ADD CONSTRAINT "customer_credit_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_ledger" ADD CONSTRAINT "customer_credit_ledger_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_ledger" ADD CONSTRAINT "customer_credit_ledger_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registry" ADD CONSTRAINT "device_registry_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registry" ADD CONSTRAINT "device_registry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
