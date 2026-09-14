import { FastifyRequest, FastifyReply } from 'fastify';
import type { SyncPushInput, SyncPullQuery, ResolveConflictInput, RegisterDeviceInput, UpdateDeviceInput } from './schema';
export declare function syncPush(request: FastifyRequest<{
    Body: SyncPushInput;
}>, reply: FastifyReply): Promise<never>;
export declare function syncPull(request: FastifyRequest<{
    Querystring: SyncPullQuery;
}>, reply: FastifyReply): Promise<never>;
export declare function getSyncStatus(request: FastifyRequest<{
    Params: {
        deviceId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function resolveConflict(request: FastifyRequest<{
    Body: ResolveConflictInput;
}>, reply: FastifyReply): Promise<never>;
export declare function registerDevice(request: FastifyRequest<{
    Body: RegisterDeviceInput;
}>, reply: FastifyReply): Promise<never>;
export declare function updateDevice(request: FastifyRequest<{
    Params: {
        deviceId: string;
    };
    Body: UpdateDeviceInput;
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map