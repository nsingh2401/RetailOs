-- Make performed_by nullable on inventory_movements to support system-generated movements
ALTER TABLE "inventory_movements" ALTER COLUMN "performed_by" DROP NOT NULL;
