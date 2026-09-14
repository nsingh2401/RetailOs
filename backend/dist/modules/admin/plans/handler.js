"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPlanFeatures = listPlanFeatures;
exports.listPlans = listPlans;
exports.createPlan = createPlan;
exports.updatePlan = updatePlan;
exports.deletePlan = deletePlan;
const prisma_1 = require("../../../lib/prisma");
function serializePlan(p) {
    return {
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        price: Number(p.price),
        billingCycle: p.billingCycle,
        maxStores: p.maxStores,
        maxUsersPerStore: p.maxUsersPerStore,
        features: p.features,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    };
}
// ── GET /v1/admin/plans/features ─────────────────────────────────
async function listPlanFeatures(_request, reply) {
    const features = await prisma_1.prisma.planFeature.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        select: { key: true, label: true, description: true, category: true, sortOrder: true },
    });
    const grouped = features.reduce((acc, f) => {
        if (!acc[f.category])
            acc[f.category] = [];
        acc[f.category].push(f);
        return acc;
    }, {});
    return reply.send({ success: true, data: { features, grouped } });
}
// ── GET /v1/admin/plans ───────────────────────────────────────────
async function listPlans(_request, reply) {
    const plans = await prisma_1.prisma.plan.findMany({
        orderBy: { price: 'asc' },
    });
    return reply.send({
        success: true,
        data: plans.map(serializePlan),
    });
}
// ── POST /v1/admin/plans ──────────────────────────────────────────
async function createPlan(request, reply) {
    const { name, displayName, price, billingCycle = 'MONTHLY', maxStores = 1, maxUsersPerStore = 5, features = [], isActive = true, } = request.body ?? {};
    if (!name || !displayName || price === undefined) {
        return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_FIELDS', message: 'name, displayName, and price are required', statusCode: 400 },
        });
    }
    try {
        const plan = await prisma_1.prisma.plan.create({
            data: {
                name: name.toLowerCase().trim(),
                displayName: displayName.trim(),
                price,
                billingCycle: billingCycle,
                maxStores,
                maxUsersPerStore,
                features,
                isActive,
            },
        });
        return reply.status(201).send({ success: true, data: serializePlan(plan) });
    }
    catch (err) {
        if (err.code === 'P2002') {
            return reply.status(409).send({
                success: false,
                error: { code: 'CONFLICT', message: `Plan name '${name}' already exists`, statusCode: 409 },
            });
        }
        throw err;
    }
}
// ── PATCH /v1/admin/plans/:planId ────────────────────────────────
async function updatePlan(request, reply) {
    const { planId } = request.params;
    const body = request.body ?? {};
    const data = {};
    if (body.displayName !== undefined)
        data.displayName = body.displayName.trim();
    if (body.price !== undefined)
        data.price = body.price;
    if (body.billingCycle !== undefined)
        data.billingCycle = body.billingCycle;
    if (body.maxStores !== undefined)
        data.maxStores = body.maxStores;
    if (body.maxUsersPerStore !== undefined)
        data.maxUsersPerStore = body.maxUsersPerStore;
    if (body.features !== undefined)
        data.features = body.features;
    if (body.isActive !== undefined)
        data.isActive = body.isActive;
    if (Object.keys(data).length === 0) {
        return reply.status(400).send({
            success: false,
            error: { code: 'NO_FIELDS', message: 'No fields to update', statusCode: 400 },
        });
    }
    try {
        const plan = await prisma_1.prisma.plan.update({
            where: { id: planId },
            data,
        });
        return reply.send({ success: true, data: serializePlan(plan) });
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Plan not found', statusCode: 404 },
            });
        }
        throw err;
    }
}
// ── DELETE /v1/admin/plans/:planId (soft delete) ─────────────────
async function deletePlan(request, reply) {
    const { planId } = request.params;
    try {
        await prisma_1.prisma.plan.update({
            where: { id: planId },
            data: { isActive: false },
        });
        return reply.status(204).send();
    }
    catch (err) {
        if (err.code === 'P2025') {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Plan not found', statusCode: 404 },
            });
        }
        throw err;
    }
}
//# sourceMappingURL=handler.js.map