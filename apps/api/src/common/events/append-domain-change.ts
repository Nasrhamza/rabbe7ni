import type { Prisma, TenantTransaction } from "@rabbehni/database";

import type { TenantRequestContext } from "../../tenancy/tenant-context.store.js";
import { appendTechnicalEvent } from "./append-technical-event.js";

export interface DomainChange {
  readonly action: string;
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export async function appendDomainChange(
  transaction: TenantTransaction,
  tenantId: string,
  context: TenantRequestContext,
  change: DomainChange,
): Promise<void> {
  const metadata = change.payload ?? {};
  await Promise.all([
    transaction.auditLog.create({
      data: {
        tenantId,
        action: change.action,
        entityType: change.entityType,
        entityId: change.entityId,
        correlationId: context.correlationId,
        requestId: context.requestId,
        ...(context.actorId ? { actorUserId: context.actorId } : {}),
        metadata: metadata as Prisma.InputJsonValue,
      },
    }),
    appendTechnicalEvent(transaction, tenantId, context.correlationId, {
      type: change.eventType,
      aggregateType: change.entityType,
      aggregateId: change.entityId,
      payload: metadata,
    }),
  ]);
}
