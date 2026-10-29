-- Invoice Discount Math Verification Checklist
-- Run against mpos_ai_bot DB to spot calculation errors
-- Replace :invoice_id with the actual invoice UUID to test

-- 1. Grand total = subtotal - discountTotal + taxTotal
SELECT
  invoice_id,
  subtotal,
  discount_total,
  tax_total,
  grand_total,
  ROUND((subtotal - discount_total + tax_total)::numeric, 2) AS computed_grand_total,
  ABS(grand_total - (subtotal - discount_total + tax_total)) AS drift
FROM invoices
WHERE ABS(grand_total - (subtotal - discount_total + tax_total)) > 1
ORDER BY drift DESC
LIMIT 20;

-- 2. discountTotal = sum of line discountAmounts
SELECT
  i.invoice_id,
  i.discount_total AS header_discount,
  ROUND(SUM(li.discount_amount)::numeric, 2) AS lines_discount_sum,
  ABS(i.discount_total - SUM(li.discount_amount)) AS drift
FROM invoices i
JOIN invoice_line_items li USING (invoice_id)
GROUP BY i.invoice_id, i.discount_total
HAVING ABS(i.discount_total - SUM(li.discount_amount)) > 1
ORDER BY drift DESC
LIMIT 20;

-- 3. Subtotal = sum of (unitPrice * quantity)
SELECT
  i.invoice_id,
  i.subtotal AS header_subtotal,
  ROUND(SUM(li.unit_price * li.quantity)::numeric, 2) AS lines_subtotal,
  ABS(i.subtotal - SUM(li.unit_price * li.quantity)) AS drift
FROM invoices i
JOIN invoice_line_items li USING (invoice_id)
GROUP BY i.invoice_id, i.subtotal
HAVING ABS(i.subtotal - SUM(li.unit_price * li.quantity)) > 1
ORDER BY drift DESC
LIMIT 20;

-- 4. Inspect single invoice (replace UUID)
-- SELECT
--   i.invoice_id, i.invoice_number, i.grand_total, i.discount_total,
--   li.product_name, li.quantity, li.unit_price,
--   li.discount_amount, li.taxable_amount, li.tax_amount, li.line_total,
--   i.notes
-- FROM invoices i
-- JOIN invoice_line_items li USING (invoice_id)
-- WHERE i.invoice_id = '<UUID>';

-- 5. Recent invoices with festive/loyalty discounts (notes contains __DISC__)
SELECT
  invoice_id, invoice_number, grand_total, discount_total, notes,
  created_at AT TIME ZONE 'Asia/Kolkata' AS created_ist
FROM invoices
WHERE notes LIKE '%__DISC__%'
ORDER BY created_at DESC
LIMIT 10;
