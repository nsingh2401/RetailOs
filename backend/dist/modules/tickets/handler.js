"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicket = createTicket;
exports.listTickets = listTickets;
exports.addReply = addReply;
const prisma_1 = require("../../lib/prisma");
// ── POST /v1/tickets ──────────────────────────────────────────────
async function createTicket(request, reply) {
    const { orgId, userId } = request.authUser;
    const storeId = request.headers['x-store-id'] || undefined;
    const { title, description, category = 'GENERAL', priority = 'MEDIUM' } = request.body ?? {};
    if (!title?.trim() || !description?.trim()) {
        return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_FIELDS', message: 'title and description are required', statusCode: 400 },
        });
    }
    const ticket = await prisma_1.prisma.supportTicket.create({
        data: {
            orgId,
            userId,
            storeId: storeId || null,
            title: title.trim(),
            description: description.trim(),
            category: category,
            priority: priority,
        },
    });
    return reply.status(201).send({
        success: true,
        data: {
            id: ticket.id,
            title: ticket.title,
            category: ticket.category,
            priority: ticket.priority,
            status: ticket.status,
            createdAt: ticket.createdAt,
        },
    });
}
// ── GET /v1/tickets ───────────────────────────────────────────────
async function listTickets(request, reply) {
    const { userId } = request.authUser;
    const tickets = await prisma_1.prisma.supportTicket.findMany({
        where: { userId },
        include: {
            replies: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: tickets });
}
// ── POST /v1/tickets/:ticketId/replies ────────────────────────────
async function addReply(request, reply) {
    const { ticketId } = request.params;
    const { orgId, userId } = request.authUser;
    const { message } = request.body ?? {};
    if (!message?.trim()) {
        return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_FIELDS', message: 'message is required', statusCode: 400 },
        });
    }
    const ticket = await prisma_1.prisma.supportTicket.findFirst({
        where: { id: ticketId, orgId },
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
    const ticketReply = await prisma_1.prisma.ticketReply.create({
        data: {
            ticketId,
            authorType: 'STORE_USER',
            authorId: userId,
            message: message.trim(),
        },
    });
    // Reopen resolved ticket when user replies
    if (ticket.status === 'RESOLVED') {
        await prisma_1.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status: 'OPEN' },
        });
    }
    return reply.status(201).send({ success: true, data: ticketReply });
}
//# sourceMappingURL=handler.js.map