-- Add invoice start number and financial year to stores
ALTER TABLE "stores"
  ADD COLUMN "invoice_start_number"    INTEGER,
  ADD COLUMN "invoice_financial_year"  VARCHAR(10);
