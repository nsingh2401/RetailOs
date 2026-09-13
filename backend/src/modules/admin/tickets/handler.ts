import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../../lib/prisma';

// ── GET /v1/admin/tickets ─────────────────────────────────────────
export async function listAdminTickets(
  request: FastifyRequest<{
    Querystring: {
      page?:     string;
      limit?:    string;
      status?:   string;
      priority?: string;
      search?:   string;
    };
  }>,
  reply: FastifyReply,
) {
  const page   = Math.max(1, parseInt(request.query.page  ?? '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10)));
  const search = (request.query.search ?? '').trim();

  const where: Record<string, unknown> = {};
  if (request.query.status   && request.query.status   !== 'ALL') where.status   = request.query.status   as any;
  if (request.query.priority && request.query.priority !== 'ALL') where.priority = request.query.priority as any;
  if (search) {
    where.OR = [
      { title:        { contains: search, mode: 'insensitive' } },
      { organization: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        organization:  { select: { name: true } },
        store:         { select: { name: true } },
        raisedBy:      { select: { name: true, phone: true } },
        assignedAdmin: { select: { name: true, email: true } },
        _count:        { select: { replies: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return reply.send({
    success: true,
    data: {
      items: tickets.map((t: typeof tickets[number]) => ({
        id:           t.id,
        title:        t.title,
        category:     t.category,
        priority:     t.priority,
        status:       t.status,
        orgName:      t.organization.name,
        storeName:    t.store?.name ?? null,
        raisedBy:     t.raisedBy.name,
        assignedTo:   t.assignedAdmin?.name ?? null,
        replyCount:   t._count.replies,
        createdAt:    t.createdAt,
        updatedAt:    t.updatedAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

// ── GET /v1/admin/tickets/:ticketId ───────────────────────────────
export async function getTicketDetail(
  request: FastifyRequest<{ Params: { ticketId: string } }>,
  reply: FastifyReply,
) {
  const { ticketId } = request.params;

  const ticket = await prisma.supportTicket.findUnique({
    where:   { id: ticketId },
    include: {
      organization:  { select: { orgId: true, name: true } },
      store:         { select: { storeId: true, name: true } },
      raisedBy:      { select: { userId: true, name: true, phone: true } },
      assignedAdmin: { select: { id: true, name: true, email: true } },
      replies:       { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!ticket) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Ticket not found', statusCode: 404 },
    });
  }

  return reply.send({ success: true, data: ticket });
}

// ── PATCH /v1/admin/tickets/:ticketId ────────────────────────────
export async function updateTicket(
  request: FastifyRequest<{
    Params: { ticketId: string };
    Body:   { status?: string; priority?: string; assignedTo?: string | null };
  }>,
  reply: FastifyReply,
) {
  const { ticketId } = request.params;
  const { status, priority, assignedTo } = request.body ?? {};

  const data: Record<string, unknown> = {};
  if (status     !== undefined) data.status     = status     as any;
  if (priority   !== undefined) data.priority   = priority   as any;
  if (assignedTo !== undefined) {
    data.assignedTo = assignedTo ?? null;
  }

  if (Object.keys(data).length === 0) {
    return reply.status(400).send({
      success: false,
      error: { code: 'NO_FIELDS', message: 'No fields to update', statusCode: 400 },
    });
  }

  try {
    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data,
      select: { id: true, status: true, priority: true, assignedTo: true, updatedAt: true },
    });
    return reply.send({ success: true, data: ticket });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ticket not found', statusCode: 404 },
      });
    }
    throw err;
  }
}

// ── POST /v1/admin/tickets/:ticketId/replies ─────────────────────
export async function addAdminReply(
  request: FastifyRequest<{
    Params: { ticketId: string };
    Body:   { message: string };
  }>,
  reply: FastifyReply,
) {
  const { ticketId }    = request.params;
  const { message }     = request.body ?? {};
  const platformUserId  = request.platformUser.platformUserId;

  if (!message?.trim()) {
    return reply.status(400).send({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'message is required', statusCode: 400 },
    });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where:  { id: ticketId },
    select: { id: true, status: true },
  });

  if (!ticket) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Ticket not found', statusCode: 404 },
    });
  }

  const [ticketReply] = await prisma.$transaction([
    prisma.ticketReply.create({
      data: {
        ticketId,
        authorType: 'PLATFORM_ADMIN',
        authorId:   platformUserId,
        message:    message.trim(),
      },
    }),
    // Move OPEN tickets to IN_PROGRESS when admin first replies
    ...(ticket.status === 'OPEN'
      ? [prisma.supportTicket.update({
          where: { id: ticketId },
          data:  { status: 'IN_PROGRESS' },
        })]
      : []
    ),
  ]);

  return reply.status(201).send({ success: true, data: ticketReply });
}
