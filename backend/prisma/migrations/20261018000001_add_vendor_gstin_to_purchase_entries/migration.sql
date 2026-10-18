-- Add vendor GSTIN to purchase_entries
ALTER TABLE "public"."purchase_entries"
  ADD COLUMN IF NOT EXISTS "vendor_gstin" VARCHAR(15);
