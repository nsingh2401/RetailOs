-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "plans" (
    "id"                   UUID            NOT NULL DEFAULT gen_random_uuid(),
    "name"                 VARCHAR(100)    NOT NULL,
    "display_name"         VARCHAR(150)    NOT NULL,
    "price"                DECIMAL(10,2)   NOT NULL DEFAULT 0,
    "billing_cycle"        "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "max_stores"           INTEGER         NOT NULL DEFAULT 1,
    "max_users_per_store"  INTEGER         NOT NULL DEFAULT 5,
    "features"             JSONB           NOT NULL DEFAULT '[]',
    "is_active"            BOOLEAN         NOT NULL DEFAULT true,
    "created_at"           TIMESTAMPTZ     NOT NULL DEFAULT now(),
    "updated_at"           TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- Seed default plans
INSERT INTO "plans" ("name", "display_name", "price", "billing_cycle", "max_stores", "max_users_per_store", "features") VALUES
('free',       'Free',       0,    'MONTHLY', 1,  2,  '["1 store","2 users","Basic inventory","Basic billing"]'::jsonb),
('starter',    'Starter',    999,  'MONTHLY', 2,  5,  '["2 stores","5 users/store","Inventory","GST billing","Customer ledger","Basic reports"]'::jsonb),
('pro',        'Pro',        2499, 'MONTHLY', 5,  15, '["5 stores","15 users/store","Advanced reports","Purchase management","Barcode scanning","PDF export"]'::jsonb),
('enterprise', 'Enterprise', 9999, 'MONTHLY', -1, -1, '["Unlimited stores","Unlimited users","Priority support","Tally integration","Custom branding","API access"]'::jsonb);
