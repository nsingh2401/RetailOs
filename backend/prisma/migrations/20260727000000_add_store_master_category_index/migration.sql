-- Partial unique index: one store-category row per master_category_id per store.
-- Partial so it only applies when master_category_id is set (custom categories unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_master_category
  ON categories(store_id, master_category_id)
  WHERE master_category_id IS NOT NULL;
