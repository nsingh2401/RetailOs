import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { buildFocusedContext } from './schema-context';

const OLLAMA_URL   = process.env.OLLAMA_URL         ?? 'http://localhost:11434';
const CHAT_MODEL   = process.env.OLLAMA_CHAT_MODEL  ?? 'llama3.2';
const UPLOAD_DIR   = process.env.UPLOAD_DIR         ?? path.join(process.cwd(), 'uploads');

// Schema and SQL rules are in schema-context.ts → buildSchemaContext(storeId)

// ── Excel intent detection ─────────────────────────────────────
const EXCEL_INTENT_RE = /excel|download|export|sheet|file\s+chahiye|nikalo|bhejo/i;

function detectExcelIntent(message: string): boolean {
  return EXCEL_INTENT_RE.test(message);
}

// ── Generate Excel file from SQL result rows ───────────────────
async function generateExcel(
  rows:      Record<string, unknown>[],
  question:  string,
  storeId:   string,
): Promise<{ filename: string; filepath: string }> {
  // Sheet name: first 3 words of question, sanitised
  const sheetName = question
    .replace(/[^\w\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .slice(0, 31) || 'Report'; // Excel max sheet name = 31 chars

  const workbook  = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (rows.length === 0) {
    worksheet.addRow(['No data found']);
  } else {
    const columns = Object.keys(rows[0]);

    // ── Header row — bold, blue bg, white text ──────────────
    worksheet.columns = columns.map((col) => ({
      header:  col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      key:     col,
      width:   Math.max(col.length + 4, 14),
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 20;

    // ── Data rows ────────────────────────────────────────────
    rows.forEach((row) => worksheet.addRow(row));

    // ── Auto-width: expand columns based on content ──────────
    worksheet.columns.forEach((col) => {
      let maxLen = col.header ? String(col.header).length : 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 4, 60);
    });
  }

  // ── Save file ────────────────────────────────────────────────
  const exportDir = path.join(UPLOAD_DIR, 'chat-exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const filename = `${storeId}-${Date.now()}.xlsx`;
  const filepath = path.join(exportDir, filename);
  await workbook.xlsx.writeFile(filepath);

  return { filename, filepath };
}

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
    signal: AbortSignal.timeout(200_000),
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
// Also blocks boolean-literal SELECTs where the model hallucinates
// a YES/NO answer as SQL (e.g. SELECT 'YES', SELECT TRUE, SELECT FALSE).
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

  // Block hallucinated boolean answers: SELECT 'YES', SELECT 'NO',
  // SELECT TRUE, SELECT FALSE, SELECT 1 AS response, etc.
  const booleanHallucination = /^SELECT\s+('YES'|'NO'|TRUE|FALSE|1|0)\s*(?:AS\s+\w+)?\s*$/i;
  if (booleanHallucination.test(s)) return null;

  return s;
}

// ── Detect invalid/trivial result (boolean col, single RESPONSE col) ──
// Returns true when the result is meaningless data from a hallucinated query.
function isInvalidResult(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;

  const keys = Object.keys(rows[0]).map((k) => k.toLowerCase());

  // Single column named "response", "answer", "result", "?column?" → hallucination
  if (keys.length === 1 && ['response', 'answer', 'result', '?column?'].includes(keys[0])) {
    return true;
  }

  // All values are boolean-ish (true/false/yes/no/1/0) — hallucinated boolean answer
  const allBool = rows.every((row) =>
    Object.values(row).every((v) => {
      const s = String(v).toLowerCase().trim();
      return ['true','false','yes','no','1','0','t','f'].includes(s);
    }),
  );
  if (allBool) return true;

  return false;
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

  // buildFocusedContext sends only schemas + examples relevant to this message
  const sqlSystem = `You are a PostgreSQL expert for a retail POS system.\n\n${buildFocusedContext(message, storeId)}`;

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
          generatedSQL = result.finalSQL; // may be the fixed SQL
          sqlError     = result.sqlError;

          // Treat boolean/trivial results as empty — model hallucinated
          if (isInvalidResult(result.rows)) {
            request.log.warn({ rows: result.rows }, 'Invalid/boolean SQL result — treating as empty');
            sqlResult = [];
          } else {
            sqlResult = result.rows;
          }
        }
      }
    }
  } catch (err: unknown) {
    request.log.warn({ err }, 'Ollama SQL generation failed');
  }

  // ── Step 3 — Excel export (short-circuit if intent detected) ─
  const wantsExcel = detectExcelIntent(message);
  let hasExcel     = false;
  let downloadUrl  = '';

  if (wantsExcel && sqlResult.length > 0) {
    try {
      const { filename } = await generateExcel(sqlResult, message, storeId);
      hasExcel    = true;
      downloadUrl = `/v1/stores/${storeId}/chat/exports/${filename}`;

      // Short-circuit — no need for full NL generation
      history.push({ role: 'user',      content: message });
      history.push({ role: 'assistant', content: 'Aapki Excel file taiyaar hai!' });
      if (history.length > 20) history = history.slice(-20);
      try { await redis.setex(historyKey, 86400, JSON.stringify(history)); } catch { /* non-fatal */ }

      return reply.send({
        success: true,
        data: {
          response:       'Aapki Excel file taiyaar hai! ✅ Neeche download button se save karein.',
          sql:            generatedSQL,
          data:           sqlResult.slice(0, 100),
          chartData:      buildChartData(sqlResult),
          conversationId,
          hasExcel,
          downloadUrl,
        },
      });
    } catch (excelErr: unknown) {
      request.log.warn({ err: excelErr }, 'Excel generation failed — falling back to normal response');
      // Fall through to normal NL response
    }
  }

  // ── Step 4 — Natural language response ────────────────────
  const nlSystem =
`You are a helpful, friendly retail assistant for BillFlow POS.
Respond in the SAME language as the user (Hindi/English/Hinglish — match their style exactly).
Use ₹ for rupees. Be concise and clear. Do NOT mention SQL, databases, or technical terms.
If data is given, summarise it in 1-3 sentences, then list the key facts as bullet points.
If there was a data error, apologise briefly — do NOT guess or invent data.

EMPTY RESULTS RULE (most important):
If the query returned 0 rows or empty results, respond ONLY with a short honest message
saying no data was found. Examples:
  Hindi:   "Aaj koi sale nahi mili."
  English: "No sales found for today."
  Hinglish: "Aaj koi record nahi mila."
Do NOT make up numbers or business advice. Do NOT explain what the query does.
Do NOT give general tips about running a store. Simply state the data was not found,
then end with: "Aap koi aur sawaal pooch sakte hain." (or English equivalent).

CRITICAL: Do NOT write "Key facts", "Key points", "Key Facts:", or any section heading
like that. Do not use bullet points or dashes. Just plain sentences only.`;

  // Explicitly tell the model when results are empty so it doesn't hallucinate
  const dataNote =
    sqlResult.length > 0
      ? `\n\nQuery returned ${sqlResult.length} row(s):\n${JSON.stringify(sqlResult.slice(0, 20), null, 2)}`
      : sqlError
      ? `\n\n[DATA ERROR: ${sqlError}]\nDo NOT guess data. Briefly apologise and say to try again.`
      : `\n\n[EMPTY RESULT: The query ran successfully but returned 0 rows.]\nApply the EMPTY RESULTS RULE above.`;

  const nlPrompt = `User asked: "${message}"${dataNote}\n\nRespond now:`;

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

  // ── Post-process: strip noise + deduplicate sentences ────────
  const deduped = (() => {
    // Split on sentence-ending punctuation, deduplicate, rejoin
    const sentences = naturalResponse
      .split(/(?<=[.!?।])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen  = new Set<string>();
    const uniq: string[] = [];
    for (const s of sentences) {
      const key = s.toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(key)) { seen.add(key); uniq.push(s); }
    }
    return uniq.join(' ');
  })();

  const cleanResponse = deduped
    .replace(/Key\s+facts?[\s\S]*/gi, '')   // remove "Key facts:" and everything after
    .replace(/^\s*[-•]\s+/gm, '')           // strip leading bullet/dash on each line
    .trim();

  // ── Save updated history to Redis (keep last 20 msgs) ─────
  history.push({ role: 'user',      content: message });
  history.push({ role: 'assistant', content: cleanResponse });
  if (history.length > 20) history = history.slice(-20);

  try {
    await redis.setex(historyKey, 86400, JSON.stringify(history));
  } catch { /* non-fatal */ }

  // ── Build chart data ───────────────────────────────────────
  const chartData = buildChartData(sqlResult);

  return reply.send({
    success: true,
    data: {
      response:       cleanResponse,
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

// ─────────────────────────────────────────────────────────────────
// GET /v1/stores/:storeId/chat/exports/:filename
// Serves a previously generated Excel file as a download.
// ─────────────────────────────────────────────────────────────────
export async function getExcelExport(
  request: FastifyRequest<{
    Params: { storeId: string; filename: string };
  }>,
  reply: FastifyReply,
) {
  const { storeId, filename } = request.params;

  // Validate filename — must be <storeId>-<timestamp>.xlsx, no path traversal
  const safe = /^[a-f0-9-]+-\d+\.xlsx$/i.test(filename);
  if (!safe || !filename.startsWith(storeId)) {
    return reply.status(400).send({
      success: false,
      error: { code: 'INVALID_FILENAME', message: 'Invalid file name', statusCode: 400 },
    });
  }

  const filepath = path.join(UPLOAD_DIR, 'chat-exports', filename);
  if (!fs.existsSync(filepath)) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'File not found', statusCode: 404 },
    });
  }

  const stream = fs.createReadStream(filepath);
  reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  return reply.send(stream);
}
