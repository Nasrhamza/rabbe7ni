import type { Prisma, TenantTransaction } from "@rabbehni/database";

import type { PublishTechnicalEvent } from "./technical-event.publisher.js";

export async function appendTechnicalEvent(
  transaction: TenantTransaction,
  tenantId: string,
  correlationId: string,
  event: PublishTechnicalEvent,
): Promise<void> {
  await transaction.outboxEvent.create({
    data: {
      tenantId,
      eventType: event.type,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      correlationId,
      payload: event.payload as Prisma.InputJsonValue,
    },
  });
}
