import { FastifyRequest, FastifyReply } from 'fastify';
export declare function createTicket(request: FastifyRequest<{
    Body: {
        title: string;
        description: string;
        category?: string;
        priority?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function listTickets(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function addReply(request: FastifyRequest<{
    Params: {
        ticketId: string;
    };
    Body: {
        message: string;
    };
}>, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map