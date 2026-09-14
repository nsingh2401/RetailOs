import { FastifyRequest, FastifyReply } from 'fastify';
import type { VerifyTokenInput, InviteUserInput, AssignStoreRoleInput, UpdateStoreRoleInput, UpdateUserInput, CreateStoreInput, UpdateStoreInput, UpdateOrgSettingsInput, LoginInput, SetPasswordInput, ForgotPasswordInput, ResetPasswordInput, SignupInput } from './schema';
export declare function verifyToken(request: FastifyRequest<{
    Body: VerifyTokenInput;
}>, reply: FastifyReply): Promise<never>;
export declare function getMe(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function logout(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function inviteUser(request: FastifyRequest<{
    Body: InviteUserInput;
}>, reply: FastifyReply): Promise<never>;
export declare function getStoreStaff(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function assignStoreRole(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: AssignStoreRoleInput;
}>, reply: FastifyReply): Promise<never>;
export declare function updateStoreRole(request: FastifyRequest<{
    Params: {
        storeId: string;
        userId: string;
    };
    Body: UpdateStoreRoleInput;
}>, reply: FastifyReply): Promise<never>;
export declare function listUsers(request: FastifyRequest<{
    Querystring: {
        page?: string;
        limit?: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function updateUser(request: FastifyRequest<{
    Params: {
        userId: string;
    };
    Body: UpdateUserInput;
}>, reply: FastifyReply): Promise<never>;
export declare function deactivateUser(request: FastifyRequest<{
    Params: {
        userId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function getOrgDetails(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function updateOrgSettings(request: FastifyRequest<{
    Body: UpdateOrgSettingsInput;
}>, reply: FastifyReply): Promise<never>;
export declare function listOrgStores(request: FastifyRequest, reply: FastifyReply): Promise<never>;
export declare function createStore(request: FastifyRequest<{
    Body: CreateStoreInput;
}>, reply: FastifyReply): Promise<never>;
export declare function updateStore(request: FastifyRequest<{
    Params: {
        storeId: string;
    };
    Body: UpdateStoreInput;
}>, reply: FastifyReply): Promise<never>;
export declare function login(request: FastifyRequest<{
    Body: LoginInput;
}>, reply: FastifyReply): Promise<never>;
export declare function setPassword(request: FastifyRequest<{
    Body: SetPasswordInput;
}>, reply: FastifyReply): Promise<never>;
export declare function forgotPassword(request: FastifyRequest<{
    Body: ForgotPasswordInput;
}>, reply: FastifyReply): Promise<never>;
export declare function resetPassword(request: FastifyRequest<{
    Body: ResetPasswordInput;
}>, reply: FastifyReply): Promise<never>;
export declare function signup(request: FastifyRequest<{
    Body: SignupInput;
}>, reply: FastifyReply): Promise<never>;
export declare function removeStoreRole(request: FastifyRequest<{
    Params: {
        storeId: string;
        userId: string;
    };
}>, reply: FastifyReply): Promise<never>;
export declare function refreshDevToken(request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=handler.d.ts.map