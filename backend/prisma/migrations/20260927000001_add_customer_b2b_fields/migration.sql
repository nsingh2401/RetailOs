-- Add B2B/B2C customer type and GST fields to customers table
ALTER TABLE "customers"
  ADD COLUMN "customer_type"     VARCHAR(3)   NOT NULL DEFAULT 'B2C',
  ADD COLUMN "gstin"             VARCHAR(15),
  ADD COLUMN "legal_name"        VARCHAR(200),
  ADD COLUMN "business_address"  TEXT,
  ADD COLUMN "state_code"        VARCHAR(2);
