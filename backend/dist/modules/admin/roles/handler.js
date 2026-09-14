"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoles = listRoles;
exports.createRole = createRole;
exports.updateRole = updateRole;
exports.deleteRole = deleteRole;
const prisma_1 = require("../../../lib/prisma");
const ALLOWED_PERMISSIONS = [
    'can_manage_orgs',
    'can_manage_stores',
    'can_manage_users',
    'can_manage_plans',
    'can_view_analytics',
    'can_manage_master_data',
    'can_manage_tickets',
    'can_manage_roles',
];
function buildPermissions(raw = {}) {
    const perms = {};
    for (const key of ALLOWED_PERMISSIONS) {
        perms[key] = raw[key] === true;
    }
    return perms;
}
// ── GET /v1/admin/roles ───────────────────────────────────────────
async function listRoles(_request, reply) {
    const roles = await prisma_1.prisma.platformRole.findMany({
        orderBy: { name: 'asc' },
        include: {
            _count: { select: { userRoles: true } },
        },
    });
    return reply.send({
        success: true,
        data: roles.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            permissions: r.permissions,
            userCount: r._count.userRoles,
            createdAt: r.createdAt,
        })),
    });
}
// ── POST /v1/admin/roles ──────────────────────────────────────────
async function createRole(request, reply) {
    const { name, description, permissions = {} } = request.body ?? {};
    if (!name?.trim()) {
        return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_FIELDS', message: 'name is required', statusCode: 400 },
        });
    }
    try {
        const role = await prisma_1.prisma.platformRole.create({
            data: {
                name: name.trim(),
                description: description?.trim(),
                permissions: buildPermissions(permissions),
            },
        });
        return reply.status(201).send({
            success: true,
            data: { id: role.id, name: role.name, description: role.description, permissions: role.permissions },
        });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'CONFLICT', message: `Role '${name}' already exists`, statusCode: 409 },
            });
        }
        throw err;
    }
}
// ── PATCH /v1/admin/roles/:roleId ────────────────────────────────
async function updateRole(request, reply) {
    const { roleId } = request.params;
    const { name, description, permissions } = request.body ?? {};
    const data = {};
    if (name !== undefined)
        data.name = name.trim();
    if (description !== undefined)
        data.description = description.trim();
    if (permissions !== undefined)
        data.permissions = buildPermissions(permissions);
    if (Object.keys(data).length === 0) {
        return reply.status(400).send({
            success: false,
            error: { code: 'NO_FIELDS', message: 'No fields to update', statusCode: 400 },
        });
    }
    try {
        const role = await prisma_1.prisma.platformRole.update({
            where: { id: roleId },
            data,
        });
        return reply.send({
            success: true,
            data: { id: role.id, name: role.name, description: role.description, permissions: role.permissions },
        });
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Role not found', statusCode: 404 },
            });
        }
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'CONFLICT', message: `Role name '${name}' already exists`, statusCode: 409 },
            });
        }
        throw err;
    }
}
// ── DELETE /v1/admin/roles/:roleId ────────────────────────────────
async function deleteRole(request, reply) {
    const { roleId } = request.params;
    // Check if any users have this role
    const count = await prisma_1.prisma.platformUserRole.count({ where: { roleId } });
    if (count > 0) {
        return reply.status(409).send({
            success: false,
            error: {
                code: 'ROLE_IN_USE',
                message: `Cannot delete role — ${count} user(s) are assigned to it`,
                statusCode: 409,
            },
        });
    }
    try {
        await prisma_1.prisma.platformRole.delete({ where: { id: roleId } });
        return reply.status(204).send();
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Role not found', statusCode: 404 },
            });
        }
        throw err;
    }
}
//# sourceMappingURL=handler.js.map