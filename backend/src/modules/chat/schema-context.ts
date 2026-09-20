// ── NLP Chat — Schema Context ─────────────────────────────────
// Single source of truth for table/column names and SQL examples.
//
// Two exports:
//   buildFocusedContext(message, storeId) — smart: only relevant tables
//                                           + 3-5 matching examples
//   buildSchemaContext(storeId)           — full context (fallback)

// ─────────────────────────────────────────────────────────────────
// SECTION 1 — TABLE NAMES HEADER (always included)
// ─────────────────────────────────────────────────────────────────
const TABLE_NAMES_HEADER = `\
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
  categories            ← NOT: product_categories, cats`;

// ─────────────────────────────────────────────────────────────────
// SECTION 2 — PER-TABLE SCHEMA STRINGS
// ─────────────────────────────────────────────────────────────────
function schemaInvoices(storeId: string): string {
  return `TABLE invoices  (sales / billing records)
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
  created_at       timestamptz`;
}

const SCHEMA_INVOICE_LINE_ITEMS = `TABLE invoice_line_items  (products inside each invoice)
  line_item_id     uuid         PRIMARY KEY
  invoice_id       uuid         FK→invoices
  variant_id       uuid         FK→product_variants
  quantity         numeric
  unit_price       numeric
  discount_amount  numeric
  taxable_amount   numeric
  tax_amount       numeric
  line_total       numeric
  hsn_code         text`;

const SCHEMA_PRODUCTS = `TABLE products
  product_id       uuid         PRIMARY KEY
  store_id         uuid
  name             text
  internal_sku     text
  category_id      uuid         FK→categories
  brand_id         uuid         nullable
  pricing_type     text         values: 'FIXED' 'WEIGHT' 'NEGOTIABLE' 'MRP'
  selling_price    numeric
  mrp              numeric
  unit_of_measure  text
  hsn_code         text
  is_active        boolean`;

const SCHEMA_PRODUCT_VARIANTS = `TABLE product_variants
  variant_id         uuid       PRIMARY KEY
  product_id         uuid       FK→products
  variant_sku        text
  stock_quantity     numeric
  variant_attributes jsonb      e.g. {"weight_gm": 10, "karat": "22K", "size": "M"}`;

const SCHEMA_INVENTORY = `TABLE inventory  (real-time stock levels)
  inventory_id     uuid         PRIMARY KEY
  variant_id       uuid         FK→product_variants
  store_id         uuid
  quantity         numeric
  reserved_qty     numeric
  last_updated     timestamptz`;

const SCHEMA_CUSTOMERS = `TABLE customers
  customer_id          uuid     PRIMARY KEY
  store_id             uuid
  name                 text
  phone                text
  email                text
  outstanding_balance  numeric
  total_purchases      numeric
  created_at           timestamptz`;

const SCHEMA_CATEGORIES = `TABLE categories
  category_id      uuid         PRIMARY KEY
  store_id         uuid
  name             text
  parent_id        uuid         nullable (NULL = root category)
  industry_type    text
  is_custom        boolean`;

const SCHEMA_PURCHASE_ENTRIES = `TABLE purchase_entries  (stock inward / supplier purchases — NOT sales)
  purchase_id      uuid         PRIMARY KEY
  store_id         uuid
  supplier_name    text
  total_amount     numeric
  purchase_date    date
  status           text
  notes            text`;

const SCHEMA_PURCHASE_ENTRY_ITEMS = `TABLE purchase_entry_items  (line items inside each purchase)
  item_id          uuid         PRIMARY KEY
  purchase_id      uuid         FK→purchase_entries
  variant_id       uuid         FK→product_variants
  quantity         numeric
  unit_cost        numeric
  total_cost       numeric
  expiry_date      date         nullable`;

// ─────────────────────────────────────────────────────────────────
// SECTION 3 — FEW-SHOT EXAMPLES (tagged by topic)
// ─────────────────────────────────────────────────────────────────
type ExTopic = 'sales' | 'gst' | 'customer' | 'inventory' | 'purchase' | 'category';

// NOTE: text() receives (storeId, clientDate) — clientDate replaces CURRENT_DATE
//       so the model sees a concrete date and learns to copy the pattern.
interface Example {
  topics: ExTopic[];
  text:   (storeId: string, clientDate: string) => string;
}

const EXAMPLES: Example[] = [
  {
    topics: ['sales'],
    text: (s, d) => `Q: Aaj kitni sale hui?
SQL:
  SELECT SUM(grand_total) AS total_sale, COUNT(*) AS invoice_count
  FROM invoices
  WHERE store_id = '${s}'
    AND DATE(invoice_date) = '${d}'::date
    AND status IN ('PAID','PARTIAL');`,
  },
  {
    topics: ['sales'],
    text: (s) => `Q: Ab tak ki total sale
SQL:
  SELECT SUM(grand_total) AS total_sale, COUNT(*) AS total_invoices
  FROM invoices
  WHERE store_id = '${s}'
    AND status IN ('PAID','PARTIAL');`,
  },
  {
    topics: ['sales', 'inventory'],
    text: (s, d) => `Q: Pichle hafte top 5 products
SQL:
  SELECT p.name, SUM(ili.quantity) AS units_sold
  FROM invoice_line_items ili
  JOIN product_variants pv ON pv.variant_id = ili.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  JOIN invoices i           ON i.invoice_id  = ili.invoice_id
  WHERE i.store_id = '${s}'
    AND i.invoice_date >= '${d}'::date - INTERVAL '7 days'
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY p.name
  ORDER BY units_sold DESC
  LIMIT 5;`,
  },
  {
    topics: ['gst'],
    text: (s, d) => `Q: Is mahine GST kitna hua?
SQL:
  SELECT SUM(ili.taxable_amount) AS taxable, SUM(ili.tax_amount) AS gst_collected
  FROM invoice_line_items ili
  JOIN invoices i ON i.invoice_id = ili.invoice_id
  WHERE i.store_id = '${s}'
    AND DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', '${d}'::date)
    AND i.status IN ('PAID','PARTIAL');`,
  },
  {
    topics: ['customer'],
    text: (s) => `Q: Kitne customers ka credit pending hai?
SQL:
  SELECT COUNT(*) AS customer_count, SUM(outstanding_balance) AS total_pending
  FROM customers
  WHERE store_id = '${s}'
    AND outstanding_balance > 0;`,
  },
  {
    topics: ['inventory'],
    text: (s) => `Q: Low stock products dikhao
SQL:
  SELECT p.name, pv.variant_sku, i.quantity
  FROM inventory i
  JOIN product_variants pv ON pv.variant_id = i.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  WHERE i.store_id = '${s}'
    AND i.quantity < 10
  ORDER BY i.quantity ASC
  LIMIT 20;`,
  },
  {
    topics: ['sales'],
    text: (s, d) => `Q: Yesterday sales
SQL:
  SELECT SUM(grand_total) AS total, COUNT(*) AS invoices
  FROM invoices
  WHERE store_id = '${s}'
    AND DATE(invoice_date) = '${d}'::date - 1
    AND status IN ('PAID','PARTIAL');`,
  },
  {
    topics: ['sales'],
    text: (s, d) => `Q: This week cash vs UPI collection
SQL:
  SELECT payment_mode, SUM(grand_total) AS total
  FROM invoices
  WHERE store_id = '${s}'
    AND DATE_TRUNC('week', invoice_date) = DATE_TRUNC('week', '${d}'::date)
    AND status IN ('PAID','PARTIAL')
  GROUP BY payment_mode;`,
  },
  {
    topics: ['customer'],
    text: (s, d) => `Q: Pichle 30 din mein kaunsa customer sabse zyada aaya?
SQL:
  SELECT c.name, COUNT(i.invoice_id) AS visit_count, SUM(i.grand_total) AS total_spent
  FROM invoices i
  JOIN customers c ON c.customer_id = i.customer_id
  WHERE i.store_id = '${s}'
    AND i.invoice_date >= '${d}'::date - INTERVAL '30 days'
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY c.name
  ORDER BY visit_count DESC
  LIMIT 10;`,
  },
  {
    topics: ['purchase'],
    text: (s, d) => `Q: Is saal ki total purchase kitni hai?
SQL:
  SELECT SUM(total_amount) AS total_purchase
  FROM purchase_entries
  WHERE store_id = '${s}'
    AND DATE_TRUNC('year', purchase_date) = DATE_TRUNC('year', '${d}'::date);`,
  },
  {
    topics: ['category', 'sales'],
    text: (s, d) => `Q: Which category sold most this month?
SQL:
  SELECT cat.name, SUM(ili.line_total) AS revenue
  FROM invoice_line_items ili
  JOIN product_variants pv ON pv.variant_id = ili.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  JOIN categories cat       ON cat.category_id = p.category_id
  JOIN invoices i           ON i.invoice_id  = ili.invoice_id
  WHERE i.store_id = '${s}'
    AND DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', '${d}'::date)
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY cat.name
  ORDER BY revenue DESC
  LIMIT 5;`,
  },
  {
    topics: ['sales'],
    text: (s, d) => `Q: Aaj UPI se kitna aaya?
SQL:
  SELECT SUM(grand_total) AS upi_collection
  FROM invoices
  WHERE store_id = '${s}'
    AND DATE(invoice_date) = '${d}'::date
    AND payment_mode = 'UPI'
    AND status IN ('PAID','PARTIAL');`,
  },
  {
    topics: ['inventory'],
    text: (s) => `Q: Stock value kitni hai abhi?
SQL:
  SELECT SUM(p.selling_price * i.quantity) AS stock_value
  FROM inventory i
  JOIN product_variants pv ON pv.variant_id = i.variant_id
  JOIN products p           ON p.product_id  = pv.product_id
  WHERE i.store_id = '${s}';`,
  },
  {
    topics: ['customer'],
    text: (s, d) => `Q: Last month top customer
SQL:
  SELECT c.name, SUM(i.grand_total) AS total_spent
  FROM invoices i
  JOIN customers c ON c.customer_id = i.customer_id
  WHERE i.store_id = '${s}'
    AND DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', '${d}'::date - INTERVAL '1 month')
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY c.name
  ORDER BY total_spent DESC
  LIMIT 5;`,
  },
  {
    topics: ['purchase'],
    text: (s, d) => `Q: Expiry wale products dikhao
SQL:
  SELECT p.name, pv.variant_sku, pei.expiry_date
  FROM purchase_entry_items pei
  JOIN product_variants pv ON pv.variant_id  = pei.variant_id
  JOIN products p           ON p.product_id   = pv.product_id
  JOIN purchase_entries pe  ON pe.purchase_id = pei.purchase_id
  WHERE pe.store_id = '${s}'
    AND pei.expiry_date IS NOT NULL
    AND pei.expiry_date <= '${d}'::date + INTERVAL '30 days'
  ORDER BY pei.expiry_date ASC;`,
  },
  {
    topics: ['sales'],
    text: (s, d) => `Q: Aaj kitne bills bane?
SQL:
  SELECT COUNT(*) AS bill_count
  FROM invoices
  WHERE store_id = '${s}'
    AND DATE(invoice_date) = '${d}'::date;`,
  },
  {
    topics: ['sales'],
    text: (s, d) => `Q: Is hafte average bill amount
SQL:
  SELECT AVG(grand_total) AS avg_bill
  FROM invoices
  WHERE store_id = '${s}'
    AND DATE_TRUNC('week', invoice_date) = DATE_TRUNC('week', '${d}'::date)
    AND status IN ('PAID','PARTIAL');`,
  },
  {
    topics: ['customer'],
    text: (s, d) => `Q: New customers this month
SQL:
  SELECT COUNT(*) AS new_customers
  FROM customers
  WHERE store_id = '${s}'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', '${d}'::date);`,
  },
  {
    topics: ['customer'],
    text: (s) => `Q: Sabse zyada credit wala customer
SQL:
  SELECT name, phone, outstanding_balance
  FROM customers
  WHERE store_id = '${s}'
  ORDER BY outstanding_balance DESC
  LIMIT 5;`,
  },
  {
    topics: ['sales'],
    text: (s, d) => `Q: Daily sales last 7 days
SQL:
  SELECT DATE(invoice_date) AS date, SUM(grand_total) AS daily_total, COUNT(*) AS bills
  FROM invoices
  WHERE store_id = '${s}'
    AND invoice_date >= '${d}'::date - INTERVAL '7 days'
    AND status IN ('PAID','PARTIAL')
  GROUP BY DATE(invoice_date)
  ORDER BY date DESC;`,
  },
  {
    // CUSTOMER JOIN pattern — teaches model to never return raw customer_id UUID
    topics: ['customer', 'sales'],
    text: (s, d) => `Q: Kal kaun se customers aaye?
SQL:
  SELECT DISTINCT c.name, c.phone, SUM(i.grand_total) AS total_spent
  FROM invoices i
  JOIN customers c ON c.customer_id = i.customer_id
  WHERE i.store_id = '${s}'
    AND DATE(i.invoice_date) = '${d}'::date - 1
    AND i.status IN ('PAID','PARTIAL')
  GROUP BY c.name, c.phone
  ORDER BY total_spent DESC;`,
  },
];

// ─────────────────────────────────────────────────────────────────
// SECTION 4 — SQL RULES (always included)
// ─────────────────────────────────────────────────────────────────
function sqlRules(storeId: string, clientDate: string, timezone: string): string {
  return `\
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SQL RULES — mandatory, never violate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ALWAYS filter WHERE store_id = '${storeId}' — never query without it.
2. ONLY SELECT statements — never INSERT / UPDATE / DELETE / DROP / ALTER / CREATE.
3. ALWAYS add LIMIT 100 unless the query returns a single aggregate row.
4. GROUP BY rule: every non-aggregated SELECT column must be in GROUP BY.
   Violating this causes a PostgreSQL error.
5. DATE RULES — critical:
   - Today's date is '${clientDate}' (device local, ${timezone}).
   - NEVER use CURRENT_DATE or NOW() — always use '${clientDate}'::date.
   - today      → DATE(invoice_date) = '${clientDate}'::date
   - yesterday  → DATE(invoice_date) = '${clientDate}'::date - 1
   - this week  → DATE_TRUNC('week',  '${clientDate}'::date)
   - last 7d    → invoice_date >= '${clientDate}'::date - INTERVAL '7 days'
   - this month → DATE_TRUNC('month', '${clientDate}'::date)
   - last month → DATE_TRUNC('month', '${clientDate}'::date - INTERVAL '1 month')
   - this year  → DATE_TRUNC('year',  '${clientDate}'::date)
   - last year  → DATE_TRUNC('year',  '${clientDate}'::date - INTERVAL '1 year')
   - all-time / ab tak / total / overall → NO date filter, store_id only.
6. status values are UPPERCASE: 'PAID', 'PARTIAL', 'DRAFT', 'CANCELLED'
7. payment_mode values are UPPERCASE: 'CASH', 'UPI', 'CARD', 'CREDIT', 'CHEQUE'
8. CUSTOMER JOIN RULE - critical:
   - NEVER return raw customer_id UUID from invoices.
   - When query needs customer name or phone from invoices, ALWAYS JOIN customers:
       JOIN customers c ON c.customer_id = i.customer_id
     Then SELECT c.name, c.phone - NOT i.customer_id.
   - Example (customers who bought yesterday):
       SELECT DISTINCT c.name, c.phone, SUM(i.grand_total) AS total_spent
       FROM invoices i
       JOIN customers c ON c.customer_id = i.customer_id
       WHERE i.store_id = '${storeId}'
         AND DATE(i.invoice_date) = '${clientDate}'::date - 1
         AND i.status IN ('PAID','PARTIAL')
       GROUP BY c.name, c.phone
       ORDER BY total_spent DESC;
9. DATE DISPLAY FORMAT RULE - critical:
   - NEVER return raw timestamps like '2024-01-15T00:00:00.000Z' or '2024-01-15 00:00:00'.
   - When SELECTing any date/datetime column for display, ALWAYS wrap with TO_CHAR:
       invoice_date  → TO_CHAR(invoice_date  AT TIME ZONE '${timezone}', 'DD-Mon-YYYY') AS date
       purchase_date → TO_CHAR(purchase_date AT TIME ZONE '${timezone}', 'DD-Mon-YYYY') AS date
       created_at    → TO_CHAR(created_at    AT TIME ZONE '${timezone}', 'DD-Mon-YYYY HH24:MI') AS created_at
       expiry_date   → TO_CHAR(expiry_date, 'DD-Mon-YYYY') AS expiry_date
   - Exception: DATE() in WHERE clauses stays as-is — formatting only applies to SELECT output.
10. If the question is unrelated to store data, respond with exactly: NO_SQL
11. Reply with ONLY the SQL in a \`\`\`sql block, or exactly NO_SQL.`;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 5 — TOPIC DETECTION
// ─────────────────────────────────────────────────────────────────
function detectTopics(message: string): ExTopic[] {
  const m = message.toLowerCase();
  const topics: ExTopic[] = [];

  if (/sale|bill|invoice|collection|payment|upi|cash|card|cheque|revenue|kamai|kitni.*aa|aaya|bana|bani/.test(m))
    topics.push('sales');
  if (/gst|tax|hsn|taxable/.test(m))
    topics.push('gst');
  if (/customer|client|credit|pending|bakaya|udhar|outstanding/.test(m))
    topics.push('customer');
  if (/stock|inventory|product|item|low|available|kitna.*h|saman/.test(m))
    topics.push('inventory');
  if (/purchase|supplier|kharida|expiry|expire|batch|inward/.test(m))
    topics.push('purchase');
  if (/categor|type|category/.test(m))
    topics.push('category');

  // Default fallback — most queries are about sales
  if (topics.length === 0) topics.push('sales');
  return [...new Set(topics)];
}

// ─────────────────────────────────────────────────────────────────
// EXPORT 1 — buildFocusedContext  (smart, message-aware)
// ─────────────────────────────────────────────────────────────────
export function buildFocusedContext(
  message:    string,
  storeId:    string,
  clientDate: string = new Date().toISOString().slice(0, 10),
  timezone:   string = 'Asia/Kolkata',
): string {
  const topics = detectTopics(message);

  // ── Select relevant table schemas ─────────────────────────────
  const schemaParts: string[] = [];
  const addedSchemas = new Set<string>();

  const addSchema = (key: string, text: string) => {
    if (!addedSchemas.has(key)) { addedSchemas.add(key); schemaParts.push(text); }
  };

  if (topics.includes('sales') || topics.includes('gst')) {
    addSchema('invoices',             schemaInvoices(storeId));
    addSchema('invoice_line_items',   SCHEMA_INVOICE_LINE_ITEMS);
  }
  if (topics.includes('customer')) {
    addSchema('customers', SCHEMA_CUSTOMERS);
    // customer queries often join invoices
    addSchema('invoices',  schemaInvoices(storeId));
  }
  if (topics.includes('inventory')) {
    addSchema('products',          SCHEMA_PRODUCTS);
    addSchema('product_variants',  SCHEMA_PRODUCT_VARIANTS);
    addSchema('inventory',         SCHEMA_INVENTORY);
  }
  if (topics.includes('purchase')) {
    addSchema('purchase_entries',      SCHEMA_PURCHASE_ENTRIES);
    addSchema('purchase_entry_items',  SCHEMA_PURCHASE_ENTRY_ITEMS);
    addSchema('products',              SCHEMA_PRODUCTS);
    addSchema('product_variants',      SCHEMA_PRODUCT_VARIANTS);
  }
  if (topics.includes('category')) {
    addSchema('categories',        SCHEMA_CATEGORIES);
    addSchema('products',          SCHEMA_PRODUCTS);
    addSchema('invoices',          schemaInvoices(storeId));
    addSchema('invoice_line_items', SCHEMA_INVOICE_LINE_ITEMS);
  }
  // Inventory queries that join products need product_variants
  if (topics.includes('sales') && !addedSchemas.has('inventory')) {
    // top-products queries need these joins
    addSchema('products',         SCHEMA_PRODUCTS);
    addSchema('product_variants', SCHEMA_PRODUCT_VARIANTS);
  }

  // ── Pick 3-5 most relevant examples ───────────────────────────
  const relevant = EXAMPLES
    .filter((e) => e.topics.some((t) => topics.includes(t)))
    .slice(0, 5)
    .map((e) => e.text(storeId, clientDate))
    .join('\n\n');

  return [
    TABLE_NAMES_HEADER,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'RELEVANT SCHEMA',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    schemaParts.join('\n\n'),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'FEW-SHOT EXAMPLES',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    relevant,
    '',
    sqlRules(storeId, clientDate, timezone),
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────
// EXPORT 2 — buildSchemaContext  (full context, fallback)
// ─────────────────────────────────────────────────────────────────
export function buildSchemaContext(
  storeId:    string,
  clientDate: string = new Date().toISOString().slice(0, 10),
  timezone:   string = 'Asia/Kolkata',
): string {
  const allSchemas = [
    schemaInvoices(storeId),
    SCHEMA_INVOICE_LINE_ITEMS,
    SCHEMA_PRODUCTS,
    SCHEMA_PRODUCT_VARIANTS,
    SCHEMA_INVENTORY,
    SCHEMA_CUSTOMERS,
    SCHEMA_CATEGORIES,
    SCHEMA_PURCHASE_ENTRIES,
    SCHEMA_PURCHASE_ENTRY_ITEMS,
  ].join('\n\n');

  const allExamples = EXAMPLES.map((e) => e.text(storeId, clientDate)).join('\n\n');

  return [
    TABLE_NAMES_HEADER,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'FULL SCHEMA',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    allSchemas,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'FEW-SHOT EXAMPLES — Q → SQL (Hindi / English / Hinglish)',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Use these as reference patterns. CRITICAL — all-time/total/ab-tak: NO date filter, store_id only.',
    '',
    allExamples,
    '',
    sqlRules(storeId, clientDate, timezone),
  ].join('\n');
}
