import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

// ── POST /v1/tickets ──────────────────────────────────────────────
export async function createTicket(
  request: FastifyRequest<{
    Body: {
      title:        string;
      description:  string;
      category?:    string;
      priority?:    string;
    };
  }>,
  reply: FastifyReply,
) {
  const { orgId, userId } = request.authUser;
  const storeId = (request.headers['x-store-id'] as string) || undefined;
  const { title, description, category = 'GENERAL', priority = 'MEDIUM' } = request.body ?? {};

  if (!title?.trim() || !description?.trim()) {
    return reply.status(400).send({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'title and description are required', statusCode: 400 },
    });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      orgId,
      userId,
      storeId: storeId || null,
      title:        title.trim(),
      description:  description.trim(),
      category:     category as any,
      priority:     priority as any,
    },
  });

  return reply.status(201).send({
    success: true,
    data: {
      id:          ticket.id,
      title:       ticket.title,
      category:    ticket.category,
      priority:    ticket.priority,
      status:      ticket.status,
      createdAt:   ticket.createdAt,
    },
  });
}

// ── GET /v1/tickets ───────────────────────────────────────────────
export async function listTickets(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { userId } = request.authUser;

  const tickets = await prisma.supportTicket.findMany({
    where:   { userId },
    include: {
      replies: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return reply.send({ success: true, data: tickets });
}

// ── POST /v1/tickets/:ticketId/replies ────────────────────────────
export async function addReply(
  request: FastifyRequest<{
    Params: { ticketId: string };
    Body:   { message: string };
  }>,
  reply: FastifyReply,
) {
  const { ticketId } = request.params;
  const { orgId, userId } = request.authUser;
  const { message } = request.body ?? {};

  if (!message?.trim()) {
    return reply.status(400).send({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'message is required', statusCode: 400 },
    });
  }

  const ticket = await prisma.supportTicket.findFirst({
    where:  { id: ticketId, orgId },
    select: { id: true, status: true },
  });

  if (!ticket) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Ticket not found', statusCode: 404 },
    });
  }

  if (ticket.status === 'CLOSED') {
    return reply.status(400).send({
      success: false,
      error: { code: 'TICKET_CLOSED', message: 'Cannot reply to a closed ticket', statusCode: 400 },
    });
  }

  const ticketReply = await prisma.ticketReply.create({
    data: {
      ticketId,
      authorType: 'STORE_USER',
      authorId:   userId,
      message:    message.trim(),
    },
  });

  // Reopen resolved ticket when user replies
  if (ticket.status === 'RESOLVED') {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data:  { status: 'OPEN' },
    });
  }

  return reply.status(201).send({ success: true, data: ticketReply });
}
