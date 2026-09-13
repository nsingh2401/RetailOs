import 'dotenv/config';
import { buildApp } from './app';
import { connectRedis } from './lib/redis';
import { ensureCollections } from './lib/typesense';
import { scheduleGoldRateFetch } from './jobs/goldRateWorker';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function start() {
  const app = await buildApp();

  try {
    await connectRedis();
    await ensureCollections();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Server running on port ${PORT}`);
    scheduleGoldRateFetch();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // ── Graceful shutdown ────────────────────────────────────
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start();
