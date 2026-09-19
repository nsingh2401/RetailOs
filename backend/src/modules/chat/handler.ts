import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { randomUUID } from 'crypto';
import { buildSchemaContext } from './schema-context';

const OLLAMA_URL   = process.env.OLLAMA_URL         ?? 'http://localhost:11434';
const CHAT_MODEL   = process.env.OLLAMA_CHAT_MODEL  ?? 'llama3.2';

// Schema and SQL rules are in schema-context.ts → buildSchemaContext(storeId)

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

  // buildSchemaContext injects storeId into every WHERE example and SQL rule
  const sqlSystem = `You are a PostgreSQL expert for a retail POS system.\n\n${buildSchemaContext(storeId)}`;

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
