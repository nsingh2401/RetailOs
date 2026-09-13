import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from '../../../middleware/adminAuth';
import {
  listAdminTickets,
  getTicketDetail,
  updateTicket,
  addAdminReply,
} from './handler';

export default async function adminTicketRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminAuthMiddleware);

  app.get('/',                         listAdminTickets);
  app.get('/:ticketId',                getTicketDetail);
  app.patch('/:ticketId',              updateTicket);
  app.post('/:ticketId/replies',       addAdminReply);
}
