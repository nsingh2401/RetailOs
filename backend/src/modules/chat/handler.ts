import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { randomUUID } from 'crypto';

const OLLAMA_URL   = process.env.OLLAMA_URL         ?? 'http://localhost:11434';
const CHAT_MODEL   = process.env.OLLAMA_CHAT_MODEL  ?? 'llama3.2';

// ── Schema context injected into SQL generation prompt ────────
const SCHEMA_CONTEXT = `
Database schema (PostgreSQL, snake_case columns):

invoices(invoice_id UUID PK, store_id UUID, customer_id UUID nullable, invoice_date TIMESTAMPTZ,
  grand_total DECIMAL, status TEXT -- values: PAID PARTIAL DRAFT CONFIRMED VOID,
  payment_mode TEXT -- values: CASH UPI CARD CREDIT)

invoice_line_items(line_item_id UUID PK, invoice_id UUID FK→invoices, variant_id UUID FK→product_variants,
  quantity DECIMAL, unit_price DECIMAL, taxable_amount DECIMAL, tax_amount DECIMAL, line_total DECIMAL)

products(product_id UUID PK, store_id UUID, name TEXT, category_id UUID FK→categories,
  internal_sku TEXT, pricing_type TEXT, is_active BOOLEAN)

product_variants(variant_id UUID PK, product_id UUID FK→products, store_id UUID,
  variant_sku TEXT, stock_quantity DECIMAL, barcode TEXT, is_active BOOLEAN)

inventory(inventory_id UUID PK, variant_id UUID FK→product_variants, store_id UUID,
  quantity DECIMAL, reorder_point DECIMAL)

customers(customer_id UUID PK, store_id UUID, name TEXT, phone TEXT,
  outstanding_balance DECIMAL, is_active BOOLEAN)

categories(category_id UUID PK, store_id UUID, name TEXT, parent_id UUID nullable)

purchases(purchase_id UUID PK, store_id UUID, total_amount DECIMAL,
  purchase_date TIMESTAMPTZ, status TEXT)

purchase_items(purchase_item_id UUID PK, purchase_id UUID FK→purchases,
  product_id UUID FK→products, quantity DECIMAL, unit_cost DECIMAL)
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
  // prefer ```sql ... ``` block
  const blockMatch = text.match(/```(?:sql)?\s*([\s\S]+?)```/i);
  if (blockMatch) return blockMatch[1].trim();

  // fallback: first SELECT...
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

  const sqlSystem = `You are a PostgreSQL expert for a retail POS system.

${SCHEMA_CONTEXT}

STRICT RULES:
1. Generate ONLY a SELECT query — never INSERT/UPDATE/DELETE/DROP/ALTER/CREATE.
2. Every query MUST filter by store_id = '${storeId}' directly, or join a table that already has store_id = '${storeId}'.
3. Always add LIMIT 100 unless the user asks for a single aggregate value.
4. If the question has nothing to do with store data, reply with exactly: NO_SQL
5. Reply with ONLY the SQL inside a \`\`\`sql block, or exactly NO_SQL — nothing else.`;

  const sqlPrompt = recentHistory
    ? `Previous conversation:\n${recentHistory}\n\nUser question: ${message}`
    : `User question: ${message}`;

  let generatedSQL: string | null = null;
  let sqlResult: Record<string, unknown>[] = [];
  let sqlError: string | null = null;

  try {
    const sqlResp = await ollamaGenerate(sqlPrompt, sqlSystem, 300);

    if (!sqlResp.includes('NO_SQL')) {
      const extracted = extractSQL(sqlResp);
      if (extracted) {
        generatedSQL = sanitizeSQL(extracted);

        // ── Step 2 — Execute SQL ─────────────────────────────
        if (generatedSQL) {
          try {
            const rows = await (prisma as any).$queryRawUnsafe(generatedSQL) as unknown[];
            sqlResult  = serializeRows(rows);
          } catch (err: unknown) {
            sqlError = (err as Error).message ?? 'SQL execution failed';
            request.log.warn({ err, sql: generatedSQL }, 'SQL execution error');
          }
        }
      }
    }
  } catch (err: unknown) {
    request.log.warn({ err }, 'Ollama SQL generation failed');
  }

  // ── Step 3 — Natural language response ────────────────────
  const nlSystem = `You are a helpful, friendly retail assistant for BillFlow POS.
Respond in the SAME language as the user (Hindi/English/Hinglish — match their style).
Use ₹ for rupees. Be concise. Do NOT mention SQL, databases, or technical terms.
If data is given, summarise it clearly in 1-3 sentences then list key facts.`;

  const dataNote =
    sqlResult.length > 0
      ? `\n\nData retrieved (${sqlResult.length} rows):\n${JSON.stringify(sqlResult.slice(0, 20), null, 2)}`
      : sqlError
      ? `\n\n(Note: data query had an error — give a helpful answer based on general knowledge of retail.)`
      : '';

  const nlPrompt = `User asked: "${message}"${dataNote}\n\nProvide a helpful response.`;

  let naturalResponse =
    'Sorry, abhi AI service available nahi hai. Thodi der baad try karein.';

  try {
    naturalResponse = await ollamaGenerate(nlPrompt, nlSystem, 400);
  } catch (err: unknown) {
    request.log.warn({ err }, 'Ollama NL response failed');
    if (sqlResult.length > 0) {
      // Fallback: basic summary from data
      naturalResponse =
        `Result mil gaya (${sqlResult.length} rows): ` +
        JSON.stringify(sqlResult.slice(0, 3));
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
