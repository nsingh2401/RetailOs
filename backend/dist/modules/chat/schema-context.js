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
FEW-SHOT EXAMPLES — Q → SQL (Hindi / English / Hinglish)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use these as reference patterns. Match date intent carefully.
CRITICAL — all-time/total/ab-tak: NO date filter, store_id only.

Q: Aaj kitni sale hui?
SQL:
  SELECT SUM(grand_total) AS total_sale, COUNT(*) AS invoice_count
  FROM invoices
  WHERE store_id = '${storeId}'
    AND DATE(invoice_date) = CURRENT_DATE
    AND status IN ('PAID','PARTIAL');

Q: Ab tak ki total sale
SQL:
  SELECT SUM(grand_total) AS total_sale, COUNT(*) AS total_invoices
  FROM invoices
  WHERE store_id = '${storeId}'
    AND status IN ('PAID','PARTIAL');

Q: Pichle hafte top 5 products
SQL:
  SELECT p.name, SUM(ili.quantity) AS units_sold
  FROM invoice_line_items ili
  JOIN product_variants pv ON pv.variant_id = ili.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  JOIN invoices i           ON i.invoice_id  = ili.invoice_id
  WHERE i.store_id = '${storeId}'
    AND i.invoice_date >= CURRENT_DATE - INTERVAL '7 days'
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY p.name
  ORDER BY units_sold DESC
  LIMIT 5;

Q: Is mahine GST kitna hua?
SQL:
  SELECT SUM(ili.taxable_amount) AS taxable, SUM(ili.tax_amount) AS gst_collected
  FROM invoice_line_items ili
  JOIN invoices i ON i.invoice_id = ili.invoice_id
  WHERE i.store_id = '${storeId}'
    AND DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
    AND i.status IN ('PAID','PARTIAL');

Q: Kitne customers ka credit pending hai?
SQL:
  SELECT COUNT(*) AS customer_count, SUM(outstanding_balance) AS total_pending
  FROM customers
  WHERE store_id = '${storeId}'
    AND outstanding_balance > 0;

Q: Low stock products dikhao
SQL:
  SELECT p.name, pv.variant_sku, i.quantity
  FROM inventory i
  JOIN product_variants pv ON pv.variant_id = i.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  WHERE i.store_id = '${storeId}'
    AND i.quantity < 10
  ORDER BY i.quantity ASC
  LIMIT 20;

Q: Yesterday sales
SQL:
  SELECT SUM(grand_total) AS total, COUNT(*) AS invoices
  FROM invoices
  WHERE store_id = '${storeId}'
    AND DATE(invoice_date) = CURRENT_DATE - 1
    AND status IN ('PAID','PARTIAL');

Q: This week cash vs UPI collection
SQL:
  SELECT payment_mode, SUM(grand_total) AS total
  FROM invoices
  WHERE store_id = '${storeId}'
    AND DATE_TRUNC('week', invoice_date) = DATE_TRUNC('week', CURRENT_DATE)
    AND status IN ('PAID','PARTIAL')
  GROUP BY payment_mode;

Q: Pichle 30 din mein kaunsa customer sabse zyada aaya?
SQL:
  SELECT c.name, COUNT(i.invoice_id) AS visit_count, SUM(i.grand_total) AS total_spent
  FROM invoices i
  JOIN customers c ON c.customer_id = i.customer_id
  WHERE i.store_id = '${storeId}'
    AND i.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY c.name
  ORDER BY visit_count DESC
  LIMIT 10;

Q: Is saal ki total purchase kitni hai?
SQL:
  SELECT SUM(total_amount) AS total_purchase
  FROM purchase_entries
  WHERE store_id = '${storeId}'
    AND DATE_TRUNC('year', purchase_date) = DATE_TRUNC('year', CURRENT_DATE);

Q: Which category sold most this month?
SQL:
  SELECT cat.name, SUM(ili.line_total) AS revenue
  FROM invoice_line_items ili
  JOIN product_variants pv ON pv.variant_id = ili.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  JOIN categories cat       ON cat.category_id = p.category_id
  JOIN invoices i           ON i.invoice_id  = ili.invoice_id
  WHERE i.store_id = '${storeId}'
    AND DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY cat.name
  ORDER BY revenue DESC
  LIMIT 5;

Q: Aaj UPI se kitna aaya?
SQL:
  SELECT SUM(grand_total) AS upi_collection
  FROM invoices
  WHERE store_id = '${storeId}'
    AND DATE(invoice_date) = CURRENT_DATE
    AND payment_mode = 'UPI'
    AND status IN ('PAID','PARTIAL');

Q: Stock value kitni hai abhi?
SQL:
  SELECT SUM(p.selling_price * i.quantity) AS stock_value
  FROM inventory i
  JOIN product_variants pv ON pv.variant_id = i.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  WHERE i.store_id = '${storeId}';

Q: Last month top customer
SQL:
  SELECT c.name, SUM(i.grand_total) AS total_spent
  FROM invoices i
  JOIN customers c ON c.customer_id = i.customer_id
  WHERE i.store_id = '${storeId}'
    AND DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY c.name
  ORDER BY total_spent DESC
  LIMIT 5;

Q: Expiry wale products dikhao
SQL:
  SELECT p.name, pv.variant_sku, pei.expiry_date
  FROM purchase_entry_items pei
  JOIN product_variants pv ON pv.variant_id  = pei.variant_id
  JOIN products p           ON p.product_id   = pv.product_id
  JOIN purchase_entries pe  ON pe.purchase_id = pei.purchase_id
  WHERE pe.store_id = '${storeId}'
    AND pei.expiry_date IS NOT NULL
    AND pei.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
  ORDER BY pei.expiry_date ASC;

Q: Aaj kitne bills bane?
SQL:
  SELECT COUNT(*) AS bill_count
  FROM invoices
  WHERE store_id = '${storeId}'
    AND DATE(invoice_date) = CURRENT_DATE;

Q: Is hafte average bill amount
SQL:
  SELECT AVG(grand_total) AS avg_bill
  FROM invoices
  WHERE store_id = '${storeId}'
    AND DATE_TRUNC('week', invoice_date) = DATE_TRUNC('week', CURRENT_DATE)
    AND status IN ('PAID','PARTIAL');

Q: New customers this month
SQL:
  SELECT COUNT(*) AS new_customers
  FROM customers
  WHERE store_id = '${storeId}'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);

Q: Sabse zyada credit wala customer
SQL:
  SELECT name, phone, outstanding_balance
  FROM customers
  WHERE store_id = '${storeId}'
  ORDER BY outstanding_balance DESC
  LIMIT 5;

Q: Daily sales last 7 days
SQL:
  SELECT DATE(invoice_date) AS date, SUM(grand_total) AS daily_total, COUNT(*) AS bills
  FROM invoices
  WHERE store_id = '${storeId}'
    AND invoice_date >= CURRENT_DATE - INTERVAL '7 days'
    AND status IN ('PAID','PARTIAL')
  GROUP BY DATE(invoice_date)
  ORDER BY date DESC;

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