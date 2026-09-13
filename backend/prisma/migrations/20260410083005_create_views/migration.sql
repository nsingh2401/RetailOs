/*
  Warnings:

  - You are about to alter the column `ip_address` on the `event_logs` table. The data in that column could be lost. The data in that column will be cast from `Inet` to `Unsupported("inet")`.

*/
-- AlterTable
ALTER TABLE "event_logs" ALTER COLUMN "ip_address" SET DATA TYPE inet;

-- Current stock levels with product info
CREATE VIEW v_stock_levels AS
SELECT
    i.store_id,
    i.variant_id,
    p.product_id,
    p.name                          AS product_name,
    p.internal_sku                  AS product_sku,
    pv.variant_sku,
    pv.variant_attributes,
    p.unit_of_measure,
    i.quantity                      AS current_stock,
    i.reserved_qty,
    (i.quantity - i.reserved_qty)   AS available_stock,
    COALESCE(i.reorder_point, s.low_stock_threshold) AS reorder_point,
    CASE
        WHEN i.quantity <= COALESCE(i.reorder_point, s.low_stock_threshold) THEN TRUE
        ELSE FALSE
    END                             AS is_low_stock,
    i.last_counted_at,
    i.updated_at
FROM inventory i
JOIN product_variants pv ON pv.variant_id = i.variant_id
JOIN products p          ON p.product_id  = pv.product_id
JOIN stores s            ON s.store_id    = i.store_id
WHERE p.is_active = TRUE AND pv.is_active = TRUE;

COMMENT ON VIEW v_stock_levels IS 'Current stock levels with product details and low-stock flag. Use for inventory dashboard.';


-- Daily sales summary per store
CREATE VIEW v_daily_sales AS
SELECT
    i.store_id,
    i.invoice_date,
    COUNT(*)                        AS invoice_count,
    SUM(i.grand_total_base)         AS total_revenue_base,
    SUM(i.tax_total)                AS total_tax,
    SUM(i.discount_total)           AS total_discount,
    COUNT(DISTINCT i.customer_id)   AS unique_customers
FROM invoices i
WHERE i.status IN ('PAID', 'PARTIAL')
GROUP BY i.store_id, i.invoice_date;

COMMENT ON VIEW v_daily_sales IS 'Daily sales aggregation per store. Use for dashboard analytics.';


-- Expiring batches within next 30 days
CREATE VIEW v_expiring_batches AS
SELECT
    b.store_id,
    b.batch_id,
    b.batch_number,
    pv.variant_sku,
    p.name          AS product_name,
    b.remaining_qty,
    b.expiry_date,
    (b.expiry_date - CURRENT_DATE) AS days_to_expiry
FROM batches b
JOIN product_variants pv ON pv.variant_id = b.variant_id
JOIN products p          ON p.product_id  = pv.product_id
WHERE b.is_expired = FALSE
  AND b.remaining_qty > 0
  AND b.expiry_date IS NOT NULL
  AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY b.expiry_date ASC;

COMMENT ON VIEW v_expiring_batches IS 'Batches expiring within 30 days with remaining stock. Use for pharmacy/grocery alerts.';


-- Customer outstanding balances
CREATE VIEW v_customer_outstanding AS
SELECT
    c.store_id,
    c.customer_id,
    c.name          AS customer_name,
    c.phone,
    c.outstanding_balance,
    c.credit_limit,
    (c.credit_limit - c.outstanding_balance) AS available_credit,
    c.total_purchases,
    c.loyalty_points
FROM customers c
WHERE c.outstanding_balance > 0
  AND c.is_active = TRUE
ORDER BY c.outstanding_balance DESC;

COMMENT ON VIEW v_customer_outstanding IS 'Customers with outstanding credit balances. Use for collections dashboard.';
