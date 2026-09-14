import { FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
export declare function getStoreConnections(storeId: string): Set<WebSocket>;
/**
 * Broadcast an event to all active WebSocket connections for a store.
 */
export declare function broadcastToStore(storeId: string, event: {
    type: string;
    data: unknown;
}): void;
/**
 * WebSocket route handler.
 * Connection URL: wss://api.yourdomain.com/v1/ws?storeId=<uuid>&token=<sessionToken>
 */
export default function wsHandler(connection: {
    socket: WebSocket;
}, request: FastifyRequest): Promise<void>;
//# sourceMappingURL=handler.d.ts.map