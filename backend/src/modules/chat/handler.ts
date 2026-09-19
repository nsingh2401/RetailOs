import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { randomUUID } from 'crypto';

const OLLAMA_URL   = process.env.OLLAMA_URL         ?? 'http://localhost:11434';
const CHAT_MODEL   = process.env.OLLAMA_CHAT_MODEL  ?? 'llama3.2';

// ── Schema context injected into SQL generation prompt ────────
const SCHEMA_CONTEXT = `
Database schema (PostgreSQL, all columns snake_case):

TABLE invoices                          -- sales / billing records
  invoice_id       UUID        PRIMARY KEY
  store_id         UUID        (always filter on this)
  customer_id      UUID        nullable FK→customers
  invoice_date     TIMESTAMPTZ
  grand_total      DECIMAL
  paid_amount      DECIMAL
  status           TEXT        values: 'PAID' | 'PARTIAL' | 'DRAFT' | 'CONFIRMED' | 'VOID'
  payment_mode     TEXT        values: 'CASH' | 'UPI' | 'CARD' | 'CREDIT'

TABLE invoice_line_items                -- individual products in each invoice
  line_item_id     UUID        PRIMARY KEY
  invoice_id       UUID        FK→invoices
  variant_id       UUID        FK→product_variants
  quantity         DECIMAL
  unit_price       DECIMAL
  taxable_amount   DECIMAL
  tax_amount       DECIMAL
  line_total       DECIMAL

TABLE products
  product_id       UUID        PRIMARY KEY
  store_id         UUID
  name             TEXT
  internal_sku     TEXT
  category_id      UUID        FK→categories
  pricing_type     TEXT

TABLE product_variants
  variant_id       UUID        PRIMARY KEY
  product_id       UUID        FK→products
  variant_sku      TEXT
  stock_quantity   DECIMAL
  variant_attributes JSONB

TABLE inventory                         -- real-time stock levels
  inventory_id     UUID        PRIMARY KEY
  variant_id       UUID        FK→product_variants
  store_id         UUID
  quantity         DECIMAL

TABLE customers
  customer_id      UUID        PRIMARY KEY
  store_id         UUID
  name             TEXT
  phone            TEXT
  outstanding_balance DECIMAL

TABLE categories
  category_id      UUID        PRIMARY KEY
  store_id         UUID
  name             TEXT
  parent_id        UUID        nullable (NULL = root category)
  industry_type    TEXT

TABLE purchase_entries                  -- stock purchase / inward records (NOT invoices)
  purchase_id      UUID        PRIMARY KEY
  store_id         UUID
  supplier_name    TEXT
  total_amount     DECIMAL
  purchase_date    TIMESTAMPTZ
  status           TEXT

TABLE purchase_entry_items              -- line items inside each purchase entry
  item_id          UUID        PRIMARY KEY
  purchase_id      UUID        FK→purchase_entries
  variant_id       UUID        FK→product_variants
  quantity         DECIMAL
  unit_cost        DECIMAL
`.trim();

// ── GROUP BY rules appended to every SQL prompt ───────────────
const GROUP_BY_RULES = `
GROUP BY RULES (critical — PostgreSQL enforces these strictly):
- When using ANY aggregate function (SUM, COUNT, AVG, MAX, MIN), every non-aggregated
  column in the SELECT list MUST appear in the GROUP BY clause.
- NEVER select a raw column alongside an aggregate without grouping it.
- Correct daily sales:
    SELECT DATE(invoice_date) AS date, SUM(grand_total) AS total
    FROM invoices
    WHERE store_id = '<id>' AND status IN ('PAID','PARTIAL')
    GROUP BY DATE(invoice_date)
    ORDER BY date DESC
    LIMIT 30;
- Correct top products:
    SELECT p.name, SUM(ili.quantity) AS total_qty, SUM(ili.line_total) AS revenue
    FROM invoice_line_items ili
    JOIN product_variants pv ON pv.variant_id = ili.variant_id
    JOIN products p           ON p.product_id  = pv.product_id
    JOIN invoices i           ON i.invoice_id  = ili.invoice_id
    WHERE i.store_id = '<id>' AND i.status IN ('PAID','PARTIAL')
    GROUP BY p.product_id, p.name
    ORDER BY total_qty DESC
    LIMIT 10;
- Purchase entries (stock inward) use table purchase_entries (NOT purchases):
    SELECT supplier_name, SUM(total_amount) AS total
    FROM purchase_entries
    WHERE store_id = '<id>'
    GROUP BY supplier_name
    ORDER BY total DESC
    LIMIT 10;
- When in doubt: if you aggregate, GROUP BY all non-aggregate SELECTs.
`.trim();

// ── Ollama generate call ────────────────────────────────────────
async function ollamaGenerate(
  prompt: string,
  system: string,
  maxTokens = 512,
): Promise<string> {
  const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:   CHAT_MODEL,
      prompt,
      system,
      stream:  false,
      options: { temperature: 0.05, num_predict: maxTokens },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
  const body = (await resp.json()) as { response?: string };
  return (body.response ?? '').trim();
}

// ── Extract SQL from LLM output ────────────────────────────────
function extractSQL(text: string): string | null {
  const blockMatch = text.match(/```(?:sql)?\s*([\s\S]+?)```/i);
  if (blockMatch) return blockMatch[1].trim();

  const inlineMatch = text.match(/SELECT[\s\S]+/i);
  if (inlineMatch) return inlineMatch[0].split(';')[0].trim();

  return null;
}

// ── Safety: SELECT-only, no dangerous keywords ─────────────────
function sanitizeSQL(sql: string): string | null {
  const s = sql.trim().replace(/;+$/, '').trim();
  const up = s.toUpperCase();

  if (!up.startsWith('SELECT')) return null;

  const blocked = [
    'INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'TRUNCATE ',
    'ALTER ', 'CREATE ', 'GRANT ', 'REVOKE ', 'EXECUTE ',
    'EXEC ', 'CALL ', 'COPY ',
  ];
  for (const kw of blocked) {
    if (up.includes(kw)) return null;
  }
  return s;
}

// ── Detect chartable result (label col + numeric col) ──────────
function buildChartData(
  rows: Record<string, unknown>[],
): { labels: string[]; values: number[] } | null {
  if (rows.length < 2) return null;

  const keys = Object.keys(rows[0]);
  if (keys.length < 2) return null;

  const labelKey = keys[0];
  const valueKey = keys.find(
    (k) => k !== labelKey && !isNaN(Number(rows[0][k])),
  );
  if (!valueKey) return null;

  return {
    labels: rows.slice(0, 10).map((r) => String(r[labelKey] ?? '')),
    values: rows.slice(0, 10).map((r) => Number(r[valueKey]) || 0),
  };
}

// ── Serialise BigInt / Decimal returned by Prisma ─────────────
function serializeRows(rows: unknown[]): Record<string, unknown>[] {
  return (rows as Record<string, unknown>[]).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'bigint') out[k] = Number(v);
      else if (v !== null && typeof (v as any).toFixed === 'function') out[k] = Number(v);
      else out[k] = v;
    }
    return out;
  });
}

// ── Execute SQL with one auto-retry on failure ─────────────────
// On failure, sends SQL + error back to Llama to generate a fix,
// then executes the corrected SQL. Returns { rows, sql, error }.
async function executeWithRetry(
  sql: string,
  storeId: string,
  sqlSystem: string,
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<{ rows: Record<string, unknown>[]; finalSQL: string; sqlError: string | null }> {
  // ── First attempt ─────────────────────────────────────────
  try {
    const rows = await (prisma as any).$queryRawUnsafe(sql) as unknown[];
    return { rows: serializeRows(rows), finalSQL: sql, sqlError: null };
  } catch (firstErr: unknown) {
    const firstErrMsg = (firstErr as Error).message ?? 'SQL execution failed';
    log.warn({ err: firstErr, sql }, 'SQL first attempt failed — retrying with LLM fix');

    // ── Retry: ask Llama to fix the SQL ──────────────────────
    const fixPrompt =
      `The following PostgreSQL query failed with this error:\n\n` +
      `Error: ${firstErrMsg}\n\n` +
      `Failed SQL:\n\`\`\`sql\n${sql}\n\`\`\`\n\n` +
      `Fix the SQL so it runs correctly. Remember:\n` +
      `- store_id must equal '${storeId}'\n` +
      `- All non-aggregated SELECT columns must be in GROUP BY\n` +
      `- Only SELECT statements allowed\n\n` +
      `Return ONLY the corrected SQL in a \`\`\`sql block.`;

    try {
      const fixResp   = await ollamaGenerate(fixPrompt, sqlSystem, 400);
      const extracted = extractSQL(fixResp);
      const fixedSQL  = extracted ? sanitizeSQL(extracted) : null;

      if (!fixedSQL) {
        return { rows: [], finalSQL: sql, sqlError: `Auto-fix produced no valid SQL. Original error: ${firstErrMsg}` };
      }

      // ── Second attempt ──────────────────────────────────────
      try {
        const rows2 = await (prisma as any).$queryRawUnsafe(fixedSQL) as unknown[];
        log.warn({ fixedSQL }, 'SQL retry succeeded after LLM fix');
        return { rows: serializeRows(rows2), finalSQL: fixedSQL, sqlError: null };
      } catch (secondErr: unknown) {
        const secondErrMsg = (secondErr as Error).message ?? 'Retry failed';
        log.warn({ err: secondErr, fixedSQL }, 'SQL retry also failed');
        return {
          rows:     [],
          finalSQL: fixedSQL,
          sqlError: `Could not retrieve data after two attempts. (${secondErrMsg})`,
        };
      }
    } catch (fixErr: unknown) {
      log.warn({ err: fixErr }, 'LLM SQL fix generation failed');
      return { rows: [], finalSQL: sql, sqlError: firstErrMsg };
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /v1/stores/:storeId/chat
// ─────────────────────────────────────────────────────────────────
export async function chat(
  request: FastifyRequest<{
    Params:  { storeId: string };
    Body:    { message: string; conversationId?: string };
  }>,
  reply: FastifyReply,
) {
  const { storeId } = request.params;
  const { message, conversationId: incomingId } = request.body;

  if (!message?.trim()) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'message required', statusCode: 400 },
    });
  }

  const conversationId = incomingId ?? randomUUID();
  const historyKey     = `chat:${storeId}:${conversationId}`;

  // ── Load conversation history from Redis ───────────────────
  let history: { role: string; content: string }[] = [];
  try {
    const raw = await redis.get(historyKey);
    if (raw) history = JSON.parse(raw) as typeof history;
  } catch { /* non-fatal */ }

  // ── Step 1 — SQL generation ────────────────────────────────
  const recentHistory = history.slice(-6)
    .map((h) => `${h.role}: ${h.content}`)
    .join('\n');

  const sqlSystem =
`You are a PostgreSQL expert for a retail POS system.

${SCHEMA_CONTEXT}

${GROUP_BY_RULES}

STRICT RULES:
1. Generate ONLY a SELECT query — never INSERT/UPDATE/DELETE/DROP/ALTER/CREATE.
2. Every query MUST filter by store_id = '${storeId}' directly, or JOIN a table that already filters by store_id = '${storeId}'.
3. Always add LIMIT 100 unless the user asks for a single aggregate value (like total sales today).
4. If the question has nothing to do with store data, reply with exactly: NO_SQL
5. Reply with ONLY the SQL inside a \`\`\`sql block, or exactly NO_SQL — nothing else.
6. Always follow GROUP BY rules above — PostgreSQL will reject queries that violate them.`;

  const sqlPrompt = recentHistory
    ? `Previous conversation:\n${recentHistory}\n\nUser question: ${message}`
    : `User question: ${message}`;

  let generatedSQL:  string | null                 = null;
  let sqlResult:     Record<string, unknown>[]      = [];
  let sqlError:      string | null                  = null;

  try {
    const sqlResp = await ollamaGenerate(sqlPrompt, sqlSystem, 400);

    if (!sqlResp.includes('NO_SQL')) {
      const extracted = extractSQL(sqlResp);
      if (extracted) {
        generatedSQL = sanitizeSQL(extracted);

        // ── Step 2 — Execute SQL (with auto-retry) ──────────
        if (generatedSQL) {
          const result = await executeWithRetry(
            generatedSQL,
            storeId,
            sqlSystem,
            request.log,
          );
          sqlResult    = result.rows;
          generatedSQL = result.finalSQL; // may be the fixed SQL
          sqlError     = result.sqlError;
        }
      }
    }
  } catch (err: unknown) {
    request.log.warn({ err }, 'Ollama SQL generation failed');
  }

  // ── Step 3 — Natural language response ────────────────────
  const nlSystem =
`You are a helpful, friendly retail assistant for BillFlow POS.
Respond in the SAME language as the user (Hindi/English/Hinglish — match their style exactly).
Use ₹ for rupees. Be concise and clear. Do NOT mention SQL, databases, or technical terms.
If data is given, summarise it in 1-3 sentences, then list the key facts as bullet points.
If there was a data error, apologise briefly and answer from your knowledge of retail.`;

  const dataNote =
    sqlResult.length > 0
      ? `\n\nData retrieved (${sqlResult.length} rows):\n${JSON.stringify(sqlResult.slice(0, 20), null, 2)}`
      : sqlError
      ? `\n\n(Data retrieval failed: ${sqlError} — answer helpfully from general retail knowledge.)`
      : '';

  const nlPrompt = `User asked: "${message}"${dataNote}\n\nProvide a helpful response.`;

  let naturalResponse =
    'Sorry, abhi AI service available nahi hai. Thodi der baad try karein.';

  try {
    naturalResponse = await ollamaGenerate(nlPrompt, nlSystem, 500);
  } catch (err: unknown) {
    request.log.warn({ err }, 'Ollama NL response failed');
    if (sqlResult.length > 0) {
      naturalResponse =
        `Result mil gaya (${sqlResult.length} rows): ` +
        JSON.stringify(sqlResult.slice(0, 3));
    } else if (sqlError) {
      naturalResponse = `Data fetch mein problem aayi. Please dobara try karein.`;
    }
  }

  // ── Save updated history to Redis (keep last 20 msgs) ─────
  history.push({ role: 'user',      content: message });
  history.push({ role: 'assistant', content: naturalResponse });
  if (history.length > 20) history = history.slice(-20);

  try {
    await redis.setex(historyKey, 86400, JSON.stringify(history));
  } catch { /* non-fatal */ }

  // ── Build chart data ───────────────────────────────────────
  const chartData = buildChartData(sqlResult);

  return reply.send({
    success: true,
    data: {
      response:       naturalResponse,
      sql:            generatedSQL,
      data:           sqlResult.slice(0, 100),
      chartData,
      conversationId,
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// GET /v1/stores/:storeId/chat/history?conversationId=
// ─────────────────────────────────────────────────────────────────
export async function getChatHistory(
  request: FastifyRequest<{
    Params:      { storeId: string };
    Querystring: { conversationId?: string };
  }>,
  reply: FastifyReply,
) {
  const { storeId }        = request.params;
  const { conversationId } = request.query;

  if (!conversationId) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'conversationId required', statusCode: 400 },
    });
  }

  let history: unknown[] = [];
  try {
    const raw = await redis.get(`chat:${storeId}:${conversationId}`);
    if (raw) history = JSON.parse(raw) as unknown[];
  } catch { /* non-fatal */ }

  return reply.send({ success: true, data: { history, conversationId } });
}
