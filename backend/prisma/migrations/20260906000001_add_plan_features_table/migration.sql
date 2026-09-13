-- CreateTable
CREATE TABLE "plan_features" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "key"         VARCHAR(100) NOT NULL,
    "label"       VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category"    VARCHAR(50)  NOT NULL DEFAULT 'core',
    "sort_order"  INTEGER      NOT NULL DEFAULT 0,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_key_key" ON "plan_features"("key");

-- Seed 18 platform features
INSERT INTO "plan_features" ("key", "label", "category", "sort_order") VALUES
('billing',                'Billing & Invoicing',                'core',        1),
('inventory',              'Inventory Management',               'core',        2),
('customers',              'Customer Management',                'core',        3),
('reports_basic',          'Basic Reports',                      'reports',     1),
('reports_advanced',       'Advanced Reports',                   'reports',     2),
('gst_export',             'GST Export (GSTR-1/3B)',             'compliance',  1),
('tally_export',           'Tally Export',                       'compliance',  2),
('multi_store',            'Multi-Store Management',             'store',       1),
('staff_management',       'Staff & User Management',            'store',       2),
('barcode_scanner',        'Barcode Scanner',                    'ai',          1),
('ai_product_recognition', 'AI Product Recognition',            'ai',          2),
('nlp_reporting',          'NLP Chat Reporting',                 'ai',          3),
('jewelry_billing',        'Jewelry Billing (Gold/Silver Rates)','industry',   1),
('batch_expiry',           'Batch & Expiry Tracking',            'industry',    2),
('tally_bridge',           'Tally Bridge Agent',                 'integration', 1),
('api_access',             'API Access',                         'integration', 2),
('priority_support',       'Priority Support',                   'support',     1),
('dedicated_support',      'Dedicated Support Manager',          'support',     2);

-- Update existing plan feature seeds to feature key arrays
UPDATE "plans" SET "features" = '["billing","inventory","customers"]'::jsonb
  WHERE "name" = 'free';

UPDATE "plans" SET "features" = '["billing","inventory","customers","reports_basic","gst_export","barcode_scanner","batch_expiry"]'::jsonb
  WHERE "name" = 'starter';

UPDATE "plans" SET "features" = '["billing","inventory","customers","reports_basic","reports_advanced","gst_export","tally_export","multi_store","staff_management","barcode_scanner","batch_expiry"]'::jsonb
  WHERE "name" = 'pro';

UPDATE "plans" SET "features" = '["billing","inventory","customers","reports_basic","reports_advanced","gst_export","tally_export","multi_store","staff_management","barcode_scanner","ai_product_recognition","nlp_reporting","jewelry_billing","batch_expiry","tally_bridge","api_access","priority_support","dedicated_support"]'::jsonb
  WHERE "name" = 'enterprise';
