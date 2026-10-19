-- Add discount combination rule to stores
ALTER TABLE "public"."stores"
  ADD COLUMN IF NOT EXISTS "discount_combination_rule" VARCHAR(10) NOT NULL DEFAULT 'ALL';
