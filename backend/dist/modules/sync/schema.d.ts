import { z } from 'zod';
export declare const SyncRecordSchema: z.ZodObject<{
    localId: z.ZodString;
    entityType: z.ZodEnum<["INVOICE", "INVENTORY_MOVEMENT", "PAYMENT", "CUSTOMER", "PURCHASE_ENTRY"]>;
    operation: z.ZodEnum<["INSERT", "UPDATE", "DELETE"]>;
    localSequence: z.ZodNumber;
    storeId: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    storeId: string;
    localId: string;
    entityType: "PURCHASE_ENTRY" | "INVOICE" | "PAYMENT" | "INVENTORY_MOVEMENT" | "CUSTOMER";
    payload: Record<string, unknown>;
    operation: "INSERT" | "UPDATE" | "DELETE";
    localSequence: number;
}, {
    storeId: string;
    localId: string;
    entityType: "PURCHASE_ENTRY" | "INVOICE" | "PAYMENT" | "INVENTORY_MOVEMENT" | "CUSTOMER";
    payload: Record<string, unknown>;
    operation: "INSERT" | "UPDATE" | "DELETE";
    localSequence: number;
}>;
export declare const SyncPushSchema: z.ZodObject<{
    deviceId: z.ZodString;
    records: z.ZodArray<z.ZodObject<{
        localId: z.ZodString;
        entityType: z.ZodEnum<["INVOICE", "INVENTORY_MOVEMENT", "PAYMENT", "CUSTOMER", "PURCHASE_ENTRY"]>;
        operation: z.ZodEnum<["INSERT", "UPDATE", "DELETE"]>;
        localSequence: z.ZodNumber;
        storeId: z.ZodString;
        payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        storeId: string;
        localId: string;
        entityType: "PURCHASE_ENTRY" | "INVOICE" | "PAYMENT" | "INVENTORY_MOVEMENT" | "CUSTOMER";
        payload: Record<string, unknown>;
        operation: "INSERT" | "UPDATE" | "DELETE";
        localSequence: number;
    }, {
        storeId: string;
        localId: string;
        entityType: "PURCHASE_ENTRY" | "INVOICE" | "PAYMENT" | "INVENTORY_MOVEMENT" | "CUSTOMER";
        payload: Record<string, unknown>;
        operation: "INSERT" | "UPDATE" | "DELETE";
        localSequence: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    records: {
        storeId: string;
        localId: string;
        entityType: "PURCHASE_ENTRY" | "INVOICE" | "PAYMENT" | "INVENTORY_MOVEMENT" | "CUSTOMER";
        payload: Record<string, unknown>;
        operation: "INSERT" | "UPDATE" | "DELETE";
        localSequence: number;
    }[];
}, {
    deviceId: string;
    records: {
        storeId: string;
        localId: string;
        entityType: "PURCHASE_ENTRY" | "INVOICE" | "PAYMENT" | "INVENTORY_MOVEMENT" | "CUSTOMER";
        payload: Record<string, unknown>;
        operation: "INSERT" | "UPDATE" | "DELETE";
        localSequence: number;
    }[];
}>;
export declare const SyncPullQuerySchema: z.ZodObject<{
    since: z.ZodString;
    storeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    storeId: string;
    since: string;
}, {
    storeId: string;
    since: string;
}>;
export declare const ResolveConflictSchema: z.ZodObject<{
    syncId: z.ZodString;
    resolution: z.ZodEnum<["CLIENT_WINS", "SERVER_WINS"]>;
    resolvedPayload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    syncId: string;
    resolution: "CLIENT_WINS" | "SERVER_WINS";
    resolvedPayload?: Record<string, unknown> | undefined;
}, {
    syncId: string;
    resolution: "CLIENT_WINS" | "SERVER_WINS";
    resolvedPayload?: Record<string, unknown> | undefined;
}>;
export declare const RegisterDeviceSchema: z.ZodObject<{
    deviceId: z.ZodString;
    storeId: z.ZodString;
    platform: z.ZodEnum<["ANDROID", "IOS"]>;
    appVersion: z.ZodString;
    deviceName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    storeId: string;
    deviceId: string;
    platform: "ANDROID" | "IOS";
    appVersion: string;
    deviceName?: string | undefined;
}, {
    storeId: string;
    deviceId: string;
    platform: "ANDROID" | "IOS";
    appVersion: string;
    deviceName?: string | undefined;
}>;
export declare const UpdateDeviceSchema: z.ZodObject<{
    appVersion: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId?: string | undefined;
    appVersion?: string | undefined;
}, {
    userId?: string | undefined;
    appVersion?: string | undefined;
}>;
export type SyncRecord = z.infer<typeof SyncRecordSchema>;
export type SyncPushInput = z.infer<typeof SyncPushSchema>;
export type SyncPullQuery = z.infer<typeof SyncPullQuerySchema>;
export type ResolveConflictInput = z.infer<typeof ResolveConflictSchema>;
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof UpdateDeviceSchema>;
//# sourceMappingURL=schema.d.ts.map