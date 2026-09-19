"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
exports.getChatHistory = getChatHistory;
const prisma_1 = require("../../lib/prisma");
const redis_1 = require("../../lib/redis");
const crypto_1 = require("crypto");
const schema_context_1 = require("./schema-context");
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? 'llama3.2';
// Schema and SQL rules are in schema-context.ts → buildSchemaContext(storeId)
// ── Ollama generate call ────────────────────────────────────────
async function ollamaGenerate(prompt, system, maxTokens = 512) {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: CHAT_MODEL,
            prompt,
            system,
            stream: false,
            options: { temperature: 0.05, num_predict: maxTokens },
        }),
        signal: AbortSignal.timeout(90_000),
    });
    if (!resp.ok)
        throw new Error(`Ollama HTTP ${resp.status}`);
    const body = (await resp.json());
    return (body.response ?? '').trim();
}
// ── Extract SQL from LLM output ────────────────────────────────
function extractSQL(text) {
    const blockMatch = text.match(/```(?:sql)?\s*([\s\S]+?)```/i);
    if (blockMatch)
        return blockMatch[1].trim();
    const inlineMatch = text.match(/SELECT[\s\S]+/i);
    if (inlineMatch)
        return inlineMatch[0].split(';')[0].trim();
    return null;
}
// ── Safety: SELECT-only, no dangerous keywords ─────────────────
function sanitizeSQL(sql) {
    const s = sql.trim().replace(/;+$/, '').trim();
    const up = s.toUpperCase();
    if (!up.startsWith('SELECT'))
        return null;
    const blocked = [
        'INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'TRUNCATE ',
        'ALTER ', 'CREATE ', 'GRANT ', 'REVOKE ', 'EXECUTE ',
        'EXEC ', 'CALL ', 'COPY ',
    ];
    for (const kw of blocked) {
        if (up.includes(kw))
            return null;
    }
    return s;
}
// ── Detect chartable result (label col + numeric col) ──────────
function buildChartData(rows) {
    if (rows.length < 2)
        return null;
    const keys = Object.keys(rows[0]);
    if (keys.length < 2)
        return null;
    const labelKey = keys[0];
    const valueKey = keys.find((k) => k !== labelKey && !isNaN(Number(rows[0][k])));
    if (!valueKey)
        return null;
    return {
        labels: rows.slice(0, 10).map((r) => String(r[labelKey] ?? '')),
        values: rows.slice(0, 10).map((r) => Number(r[valueKey]) || 0),
    };
}
// ── Serialise BigInt / Decimal returned by Prisma ─────────────
function serializeRows(rows) {
    return rows.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
            if (typeof v === 'bigint')
                out[k] = Number(v);
            else if (v !== null && typeof v.toFixed === 'function')
                out[k] = Number(v);
            else
                out[k] = v;
        }
        return out;
    });
}
// ── Execute SQL with one auto-retry on failure ─────────────────
// On failure, sends SQL + error back to Llama to generate a fix,
// then executes the corrected SQL. Returns { rows, sql, error }.
async function executeWithRetry(sql, storeId, sqlSystem, log) {
    // ── First attempt ─────────────────────────────────────────
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(sql);
        return { rows: serializeRows(rows), finalSQL: sql, sqlError: null };
    }
    catch (firstErr) {
        const firstErrMsg = firstErr.message ?? 'SQL execution failed';
        log.warn({ err: firstErr, sql }, 'SQL first attempt failed — retrying with LLM fix');
        // ── Retry: ask Llama to fix the SQL ──────────────────────
        const fixPrompt = `The following PostgreSQL query failed with this error:\n\n` +
            `Error: ${firstErrMsg}\n\n` +
            `Failed SQL:\n\`\`\`sql\n${sql}\n\`\`\`\n\n` +
            `Fix the SQL so it runs correctly. Remember:\n` +
            `- store_id must equal '${storeId}'\n` +
            `- All non-aggregated SELECT columns must be in GROUP BY\n` +
            `- Only SELECT statements allowed\n\n` +
            `Return ONLY the corrected SQL in a \`\`\`sql block.`;
        try {
            const fixResp = await ollamaGenerate(fixPrompt, sqlSystem, 400);
            const extracted = extractSQL(fixResp);
            const fixedSQL = extracted ? sanitizeSQL(extracted) : null;
            if (!fixedSQL) {
                return { rows: [], finalSQL: sql, sqlError: `Auto-fix produced no valid SQL. Original error: ${firstErrMsg}` };
            }
            // ── Second attempt ──────────────────────────────────────
            try {
                const rows2 = await prisma_1.prisma.$queryRawUnsafe(fixedSQL);
                log.warn({ fixedSQL }, 'SQL retry succeeded after LLM fix');
                return { rows: serializeRows(rows2), finalSQL: fixedSQL, sqlError: null };
            }
            catch (secondErr) {
                const secondErrMsg = secondErr.message ?? 'Retry failed';
                log.warn({ err: secondErr, fixedSQL }, 'SQL retry also failed');
                return {
                    rows: [],
                    finalSQL: fixedSQL,
                    sqlError: `Could not retrieve data after two attempts. (${secondErrMsg})`,
                };
            }
        }
        catch (fixErr) {
            log.warn({ err: fixErr }, 'LLM SQL fix generation failed');
            return { rows: [], finalSQL: sql, sqlError: firstErrMsg };
        }
    }
}
// ─────────────────────────────────────────────────────────────────
// POST /v1/stores/:storeId/chat
// ─────────────────────────────────────────────────────────────────
async function chat(request, reply) {
    const { storeId } = request.params;
    const { message, conversationId: incomingId } = request.body;
    if (!message?.trim()) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'message required', statusCode: 400 },
        });
    }
    const conversationId = incomingId ?? (0, crypto_1.randomUUID)();
    const historyKey = `chat:${storeId}:${conversationId}`;
    // ── Load conversation history from Redis ───────────────────
    let history = [];
    try {
        const raw = await redis_1.redis.get(historyKey);
        if (raw)
            history = JSON.parse(raw);
    }
    catch { /* non-fatal */ }
    // ── Step 1 — SQL generation ────────────────────────────────
    const recentHistory = history.slice(-6)
        .map((h) => `${h.role}: ${h.content}`)
        .join('\n');
    // buildSchemaContext injects storeId into every WHERE example and SQL rule
    const sqlSystem = `You are a PostgreSQL expert for a retail POS system.\n\n${(0, schema_context_1.buildSchemaContext)(storeId)}`;
    const sqlPrompt = recentHistory
        ? `Previous conversation:\n${recentHistory}\n\nUser question: ${message}`
        : `User question: ${message}`;
    let generatedSQL = null;
    let sqlResult = [];
    let sqlError = null;
    try {
        const sqlResp = await ollamaGenerate(sqlPrompt, sqlSystem, 400);
        if (!sqlResp.includes('NO_SQL')) {
            const extracted = extractSQL(sqlResp);
            if (extracted) {
                generatedSQL = sanitizeSQL(extracted);
                // ── Step 2 — Execute SQL (with auto-retry) ──────────
                if (generatedSQL) {
                    const result = await executeWithRetry(generatedSQL, storeId, sqlSystem, request.log);
                    sqlResult = result.rows;
                    generatedSQL = result.finalSQL; // may be the fixed SQL
                    sqlError = result.sqlError;
                }
            }
        }
    }
    catch (err) {
        request.log.warn({ err }, 'Ollama SQL generation failed');
    }
    // ── Step 3 — Natural language response ────────────────────
    const nlSystem = `You are a helpful, friendly retail assistant for BillFlow POS.
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
then end with: "Aap koi aur sawaal pooch sakte hain." (or English equivalent).`;
    // Explicitly tell the model when results are empty so it doesn't hallucinate
    const dataNote = sqlResult.length > 0
        ? `\n\nQuery returned ${sqlResult.length} row(s):\n${JSON.stringify(sqlResult.slice(0, 20), null, 2)}`
        : sqlError
            ? `\n\n[DATA ERROR: ${sqlError}]\nDo NOT guess data. Briefly apologise and say to try again.`
            : `\n\n[EMPTY RESULT: The query ran successfully but returned 0 rows.]\nApply the EMPTY RESULTS RULE above.`;
    const nlPrompt = `User asked: "${message}"${dataNote}\n\nRespond now:`;
    let naturalResponse = 'Sorry, abhi AI service available nahi hai. Thodi der baad try karein.';
    try {
        naturalResponse = await ollamaGenerate(nlPrompt, nlSystem, 500);
    }
    catch (err) {
        request.log.warn({ err }, 'Ollama NL response failed');
        if (sqlResult.length > 0) {
            naturalResponse =
                `Result mil gaya (${sqlResult.length} rows): ` +
                    JSON.stringify(sqlResult.slice(0, 3));
        }
        else if (sqlError) {
            naturalResponse = `Data fetch mein problem aayi. Please dobara try karein.`;
        }
    }
    // ── Save updated history to Redis (keep last 20 msgs) ─────
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: naturalResponse });
    if (history.length > 20)
        history = history.slice(-20);
    try {
        await redis_1.redis.setex(historyKey, 86400, JSON.stringify(history));
    }
    catch { /* non-fatal */ }
    // ── Build chart data ───────────────────────────────────────
    const chartData = buildChartData(sqlResult);
    return reply.send({
        success: true,
        data: {
            response: naturalResponse,
            sql: generatedSQL,
            data: sqlResult.slice(0, 100),
            chartData,
            conversationId,
        },
    });
}
// ─────────────────────────────────────────────────────────────────
// GET /v1/stores/:storeId/chat/history?conversationId=
// ─────────────────────────────────────────────────────────────────
async function getChatHistory(request, reply) {
    const { storeId } = request.params;
    const { conversationId } = request.query;
    if (!conversationId) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'conversationId required', statusCode: 400 },
        });
    }
    let history = [];
    try {
        const raw = await redis_1.redis.get(`chat:${storeId}:${conversationId}`);
        if (raw)
            history = JSON.parse(raw);
    }
    catch { /* non-fatal */ }
    return reply.send({ success: true, data: { history, conversationId } });
}
//# sourceMappingURL=handler.js.map