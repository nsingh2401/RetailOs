-- Add discount_rule_type enum
CREATE TYPE "discount_rule_type" AS ENUM ('PRODUCT', 'CATEGORY', 'LOYALTY', 'FESTIVE');

-- Add discount_value_type enum
CREATE TYPE "discount_value_type" AS ENUM ('PERCENTAGE', 'FIXED');

-- Create discount_rules table
CREATE TABLE "discount_rules" (
    "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    "store_id"            UUID        NOT NULL,
    "type"                "discount_rule_type" NOT NULL,
    "name"                VARCHAR(200) NOT NULL,
    "discount_type"       "discount_value_type" NOT NULL,
    "discount_value"      DECIMAL(10,2) NOT NULL,
    "min_purchase_amount" DECIMAL(15,4),
    "product_id"          UUID,
    "category_id"         UUID,
    "start_date"          DATE,
    "end_date"            DATE,
    "is_active"           BOOLEAN     NOT NULL DEFAULT true,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discount_rules_store_id_fkey"
        FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE CASCADE,
    CONSTRAINT "discount_rules_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE SET NULL,
    CONSTRAINT "discount_rules_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE SET NULL
);

CREATE INDEX "discount_rules_store_id_type_idx"    ON "discount_rules"("store_id", "type");
CREATE INDEX "discount_rules_store_id_active_idx"  ON "discount_rules"("store_id", "is_active");
