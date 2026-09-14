import Redis from 'ioredis';
export declare const redis: Redis;
export declare const bullmqConnection: Redis;
export declare function setSession(token: string, userId: string, ttlSeconds?: number): Promise<void>;
export declare function getSession(token: string): Promise<string | null>;
export declare function deleteSession(token: string): Promise<void>;
export declare function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void>;
export declare function cacheGet<T>(key: string): Promise<T | null>;
export declare function cacheDelete(key: string): Promise<void>;
export declare function checkRateLimit(deviceId: string, maxRequests: number, windowMs: number): Promise<boolean>;
export declare function connectRedis(): Promise<void>;
//# sourceMappingURL=redis.d.ts.map