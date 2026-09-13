import { FastifyRequest, FastifyReply } from 'fastify';
import { checkRateLimit } from '../lib/redis';

const STANDARD_MAX = parseInt(process.env.RATE_LIMIT_STANDARD ?? '200', 10);
const SYNC_MAX     = parseInt(process.env.RATE_LIMIT_SYNC     ?? '600', 10);
const WINDOW_MS    = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);

const SYNC_PATHS = ['/v1/sync/push', '/v1/sync/pull'];

export async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const deviceId = (request.headers['x-device-id'] as string) ?? request.ip;
  const isSync   = SYNC_PATHS.some(p => request.url.startsWith(p));
  const maxReq   = isSync ? SYNC_MAX : STANDARD_MAX;

  const allowed = await checkRateLimit(deviceId, maxReq, WINDOW_MS);
  if (!allowed) {
    return reply.status(429).send({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.', statusCode: 429 },
    });
  }
}
