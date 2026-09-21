-- AddColumns: batch_number + factory_code to purchase_entry_items
ALTER TABLE "purchase_entry_items"
  ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "factory_code" VARCHAR(100);

-- AddColumn: factory_code to products
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "factory_code" VARCHAR(100);
