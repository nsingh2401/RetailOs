-- Widen v_daily_sales to include CONFIRMED invoices.
-- confirmInvoice marks non-credit sales PAID and credit sales CONFIRMED;
-- both represent completed sales and must show in dashboard revenue.
-- Column list/order is unchanged, so CREATE OR REPLACE is safe.
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
    i.store_id,
    i.invoice_date,
    COUNT(*)                        AS invoice_count,
    SUM(i.grand_total_base)         AS total_revenue_base,
    SUM(i.tax_total)                AS total_tax,
    SUM(i.discount_total)           AS total_discount,
    COUNT(DISTINCT i.customer_id)   AS unique_customers
FROM invoices i
WHERE i.status IN ('PAID', 'PARTIAL', 'CONFIRMED')
GROUP BY i.store_id, i.invoice_date;
