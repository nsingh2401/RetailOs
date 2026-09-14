"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const redis_1 = require("./lib/redis");
const typesense_1 = require("./lib/typesense");
const goldRateWorker_1 = require("./jobs/goldRateWorker");
const PORT = parseInt(process.env.PORT ?? '3000', 10);
async function start() {
    const app = await (0, app_1.buildApp)();
    try {
        await (0, redis_1.connectRedis)();
        await (0, typesense_1.ensureCollections)();
        await app.listen({ port: PORT, host: '0.0.0.0' });
        app.log.info(`Server running on port ${PORT}`);
        (0, goldRateWorker_1.scheduleGoldRateFetch)();
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
    // ── Graceful shutdown ────────────────────────────────────
    const shutdown = async (signal) => {
        app.log.info(`Received ${signal}. Shutting down gracefully...`);
        await app.close();
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
start();
//# sourceMappingURL=server.js.map