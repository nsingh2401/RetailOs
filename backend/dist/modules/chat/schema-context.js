"use strict";
// ── NLP Chat — Schema Context ─────────────────────────────────
// Injected into the Llama SQL-generation system prompt on every request.
// Keep this file as the single source of truth for table/column names.
// The model frequently guesses wrong names — the WRONG NAMES section is
// the most important part: it actively tells the model what NOT to use.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSchemaContext = buildSchemaContext;
// ── Placeholder — replaced at call time with the real storeId ─
// Use buildSchemaContext(storeId) instead of importing SCHEMA_CONTEXT directly.
function buildSchemaContext(storeId) {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXACT TABLE NAMES — use only these, nothing else
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  invoices              ← NOT: sales, bills, orders, transactions
  invoice_line_items    ← NOT: line_items, order_items, sales_items, items
  purchase_entries      ← NOT: purchases, purchase_orders, stock_entries
  purchase_entry_items  ← NOT: purchase_items, purchase_details, stock_items
  product_variants      ← NOT: variants, skus, product_skus
  products              ← NOT: items, goods
  inventory             ← NOT: stock, stock_levels
  customers             ← NOT: clients, buyers
  categories            ← NOT: product_categories, cats

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FULL SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE invoices  (sales / billing records)
  invoice_id       uuid         PRIMARY KEY
  store_id         uuid         ← ALWAYS filter: WHERE store_id = '${storeId}'
  customer_id      uuid         nullable FK→customers
  invoice_number   text
  invoice_date     date
  subtotal         numeric
  tax_total        numeric
  discount_total   numeric
  grand_total      numeric
  paid_amount      numeric
  status           text         values (uppercase): 'PAID' 'PARTIAL' 'DRAFT' 'CANCELLED'
  payment_mode     text         values (uppercase): 'CASH' 'UPI' 'CARD' 'CREDIT' 'CHEQUE'
  created_at       timestamptz

TABLE invoice_line_items  (products inside each invoice)
  line_item_id     uuid         PRIMARY KEY
  invoice_id       uuid         FK→invoices
  variant_id       uuid         FK→product_variants
  quantity         numeric
  unit_price       numeric
  discount_amount  numeric
  taxable_amount   numeric
  tax_amount       numeric
  line_total       numeric
  hsn_code         text

TABLE products
  product_id       uuid         PRIMARY KEY
  store_id         uuid
  name             text
  internal_sku     text
  description      text
  category_id      uuid         FK→categories
  brand_id         uuid         nullable
  pricing_type     text         values: 'FIXED' 'WEIGHT' 'NEGOTIABLE' 'MRP'
  selling_price    numeric
  mrp              numeric
  unit_of_measure  text
  hsn_code         text
  tax_rule_id      uuid         nullable
  is_active        boolean

TABLE product_variants
  variant_id         uuid       PRIMARY KEY
  product_id         uuid       FK→products
  variant_sku        text
  stock_quantity     numeric
  variant_attributes jsonb      e.g. {"weight_gm": 10, "karat": "22K", "size": "M", "color": "red"}

TABLE inventory  (real-time stock levels)
  inventory_id     uuid         PRIMARY KEY
  variant_id       uuid         FK→product_variants
  store_id         uuid
  quantity         numeric
  reserved_qty     numeric
  last_updated     timestamptz

TABLE customers
  customer_id          uuid     PRIMARY KEY
  store_id             uuid
  name                 text
  phone                text
  email                text
  outstanding_balance  numeric
  total_purchases      numeric
  created_at           timestamptz

TABLE categories
  category_id      uuid         PRIMARY KEY
  store_id         uuid
  name             text
  parent_id        uuid         nullable (NULL = root category)
  industry_type    text
  is_custom        boolean

TABLE purchase_entries  (stock inward / supplier purchases — NOT sales)
  purchase_id      uuid         PRIMARY KEY
  store_id         uuid
  supplier_name    text
  total_amount     numeric
  purchase_date    date
  status           text
  notes            text

TABLE purchase_entry_items  (line items inside each purchase entry)
  item_id          uuid         PRIMARY KEY
  purchase_id      uuid         FK→purchase_entries
  variant_id       uuid         FK→product_variants
  quantity         numeric
  unit_cost        numeric
  total_cost       numeric
  expiry_date      date         nullable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMON QUERY PATTERNS — follow these exactly
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Today's sales:
  SELECT SUM(grand_total) AS total, COUNT(*) AS invoice_count
  FROM invoices
  WHERE store_id = '${storeId}'
    AND DATE(invoice_date) = CURRENT_DATE
    AND status IN ('PAID','PARTIAL');

Top products this week:
  SELECT p.name, SUM(ili.quantity) AS units_sold, SUM(ili.line_total) AS revenue
  FROM invoice_line_items ili
  JOIN product_variants pv ON pv.variant_id = ili.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  JOIN invoices i           ON i.invoice_id  = ili.invoice_id
  WHERE i.store_id = '${storeId}'
    AND i.status IN ('PAID','PARTIAL')
    AND i.invoice_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY p.product_id, p.name
  ORDER BY units_sold DESC
  LIMIT 10;

Pending credit (outstanding customers):
  SELECT name, phone, outstanding_balance
  FROM customers
  WHERE store_id = '${storeId}'
    AND outstanding_balance > 0
  ORDER BY outstanding_balance DESC
  LIMIT 100;

Low stock alert:
  SELECT p.name, pv.variant_sku, i.quantity
  FROM inventory i
  JOIN product_variants pv ON pv.variant_id = i.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  WHERE i.store_id = '${storeId}'
    AND i.quantity < 10
  ORDER BY i.quantity ASC
  LIMIT 100;

Monthly GST summary:
  SELECT SUM(ili.taxable_amount) AS taxable_value,
         SUM(ili.tax_amount)     AS gst_collected
  FROM invoice_line_items ili
  JOIN invoices i ON i.invoice_id = ili.invoice_id
  WHERE i.store_id = '${storeId}'
    AND DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
    AND i.status IN ('PAID','PARTIAL');

Daily sales trend (last 30 days):
  SELECT DATE(invoice_date) AS sale_date, SUM(grand_total) AS total
  FROM invoices
  WHERE store_id = '${storeId}'
    AND status IN ('PAID','PARTIAL')
    AND invoice_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(invoice_date)
  ORDER BY sale_date DESC
  LIMIT 30;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SQL RULES — mandatory, never violate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ALWAYS filter WHERE store_id = '${storeId}' — never query without it.
2. ONLY SELECT statements — never INSERT / UPDATE / DELETE / DROP / ALTER / CREATE.
3. ALWAYS add LIMIT 100 unless the query returns a single aggregate row.
4. GROUP BY rule: when using SUM/COUNT/AVG/MAX/MIN, every non-aggregated
   column in SELECT must appear in GROUP BY. Violating this causes a
   PostgreSQL error and the query will fail.
5. Date comparisons: use DATE(invoice_date) = CURRENT_DATE, not invoice_date::date.
6. status values are always UPPERCASE strings in single quotes:
   'PAID', 'PARTIAL', 'DRAFT', 'CANCELLED'
7. payment_mode values are always UPPERCASE:
   'CASH', 'UPI', 'CARD', 'CREDIT', 'CHEQUE'
8. If the question is unrelated to store data, respond with exactly: NO_SQL
9. Reply with ONLY the SQL in a \`\`\`sql block, or exactly NO_SQL.
`.trim();
}
//# sourceMappingURL=schema-context.js.map