import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { createTicket, listTickets, addReply } from './handler';

export default async function ticketRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/',                         listTickets);
  app.post('/',                        createTicket);
  app.post('/:ticketId/replies',       addReply);
}
