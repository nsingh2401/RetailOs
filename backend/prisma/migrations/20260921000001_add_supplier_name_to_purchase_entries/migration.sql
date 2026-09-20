-- AddColumn supplier_name to purchase_entries
ALTER TABLE "purchase_entries" ADD COLUMN IF NOT EXISTS "supplier_name" VARCHAR(200);
