import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
});

// Separate connection for BullMQ — requires maxRetriesPerRequest: null
// for blocking worker commands (BRPOP etc.)
export const bullmqConnection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err) => console.error('Redis error:', err));

// ── Session helpers ───────────────────────────────────────────
export async function setSession(token: string, userId: string, ttlSeconds = 604800) {
  await redis.setex(`session:${token}`, ttlSeconds, userId);
}

export async function getSession(token: string): Promise<string | null> {
  return redis.get(`session:${token}`);
}

export async function deleteSession(token: string) {
  await redis.del(`session:${token}`);
}

// ── Cache helpers ─────────────────────────────────────────────
export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function cacheDelete(key: string) {
  await redis.del(key);
}

// ── Rate limit helpers ────────────────────────────────────────
export async function checkRateLimit(deviceId: string, maxRequests: number, windowMs: number): Promise<boolean> {
  const key = `ratelimit:${deviceId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.pexpire(key, windowMs);
  return count <= maxRequests;
}

export async function connectRedis(): Promise<void> {
  await redis.ping();
  console.log('Redis connected');
}
