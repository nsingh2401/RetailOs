import { FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import { getSession } from '../../lib/redis';

// Store active connections: storeId → Set of WebSocket connections
const connections = new Map<string, Set<WebSocket>>();

export function getStoreConnections(storeId: string): Set<WebSocket> {
  return connections.get(storeId) ?? new Set();
}

/**
 * Broadcast an event to all active WebSocket connections for a store.
 */
export function broadcastToStore(storeId: string, event: { type: string; data: unknown }) {
  const storeConns = connections.get(storeId);
  if (!storeConns) return;
  const message = JSON.stringify(event);
  storeConns.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  });
}

/**
 * WebSocket route handler.
 * Connection URL: wss://api.yourdomain.com/v1/ws?storeId=<uuid>&token=<sessionToken>
 */
export default async function wsHandler(connection: { socket: WebSocket }, request: FastifyRequest) {
  const { socket } = connection;
  const query = request.query as { storeId?: string; token?: string };

  // ── Auth handshake ────────────────────────────────────────
  if (!query.token || !query.storeId) {
    socket.send(JSON.stringify({ type: 'AUTH_FAIL', error: 'token and storeId query params required' }));
    socket.close(1008, 'Auth required');
    return;
  }

  const userId = await getSession(query.token);
  if (!userId) {
    socket.send(JSON.stringify({ type: 'AUTH_FAIL', error: 'Invalid or expired token' }));
    socket.close(1008, 'Invalid token');
    return;
  }

  const storeId = query.storeId;

  // Register connection
  if (!connections.has(storeId)) connections.set(storeId, new Set());
  connections.get(storeId)!.add(socket);

  socket.send(JSON.stringify({ type: 'AUTH_OK', userId, storeId }));

  // ── Message handling ──────────────────────────────────────
  socket.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'PING') socket.send(JSON.stringify({ type: 'PONG' }));
    } catch { /* ignore malformed messages */ }
  });

  // ── Cleanup on disconnect ─────────────────────────────────
  socket.on('close', () => {
    connections.get(storeId)?.delete(socket);
    if (connections.get(storeId)?.size === 0) connections.delete(storeId);
  });

  socket.on('error', () => {
    connections.get(storeId)?.delete(socket);
  });
}
