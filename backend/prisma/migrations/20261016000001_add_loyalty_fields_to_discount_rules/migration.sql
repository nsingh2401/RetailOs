-- Add loyalty points fields to discount_rules
ALTER TABLE "public"."discount_rules"
  ADD COLUMN IF NOT EXISTS "points_per_100" INTEGER,
  ADD COLUMN IF NOT EXISTS "min_points_to_redeem" INTEGER,
  ADD COLUMN IF NOT EXISTS "points_redemption_value" NUMERIC(10,4);
