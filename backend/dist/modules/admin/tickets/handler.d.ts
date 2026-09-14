import { FastifyRequest, FastifyReply } from 'fastify';
export declare function listAdminTickets(request: FastifyRequest<{
    Querystring: {
        page?: string;
        limit?: string;
        status?: string;
        priority?: string;
        search?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getTicketDetail(request: FastifyRequest<{
    Params: {
        ticketId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateTicket(request: FastifyRequest<{
    Params: {
        ticketId: string;
    };
    Body: {
        status?: string;
        priority?: string;
        assignedTo?: string | null;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function addAdminReply(request: FastifyRequest<{
    Params: {
        ticketId: string;
    };
    Body: {
        message: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map