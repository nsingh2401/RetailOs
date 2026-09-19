// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { authMiddleware }  from '../../middleware/auth';
import { storeMiddleware } from '../../middleware/store';
import * as handler from './handler';

// Registered at prefix /v1/stores in app.ts
// → POST /v1/stores/:storeId/chat
// → GET  /v1/stores/:storeId/chat/history
// → GET  /v1/stores/:storeId/chat/exports/:filename  (Excel file download)
export default async function chatRoutes(app: FastifyInstance) {
  const pre = [authMiddleware, storeMiddleware];

  app.post('/:storeId/chat', { preHandler: pre }, handler.chat);

  app.get('/:storeId/chat/history', { preHandler: pre }, handler.getChatHistory);

  // Excel export download — auth required so strangers can't pull other stores' files
  app.get('/:storeId/chat/exports/:filename', { preHandler: pre }, handler.getExcelExport);
}
