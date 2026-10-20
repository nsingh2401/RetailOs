-- Pharmacy dispensing fields on product_variants
ALTER TABLE "public"."product_variants"
  ADD COLUMN IF NOT EXISTS "tablets_per_unit"    INTEGER,
  ADD COLUMN IF NOT EXISTS "allow_loose_selling" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "loose_unit"          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "pack_size"           VARCHAR(20);

-- Loose-selling tracking on invoice_line_items
ALTER TABLE "public"."invoice_line_items"
  ADD COLUMN IF NOT EXISTS "selling_unit"       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "strips_equivalent"  NUMERIC(15,4);
