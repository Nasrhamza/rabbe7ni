import { Inject, Injectable } from "@nestjs/common";
import { GamificationEventStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { ConsumeGamificationEvent } from "./dto.js";

@Injectable()
export class GamificationEventsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  begin(input: ConsumeGamificationEvent) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const existing = await transaction.gamificationEventReceipt.findUnique({
        where: { tenantId_eventId: { tenantId, eventId: input.eventId } },
      });
      if (existing?.status === GamificationEventStatus.PROCESSED) {
        return { receipt: existing, processed: true };
      }
      if (existing) {
        const receipt = await transaction.gamificationEventReceipt.update({
          where: { id: existing.id },
          data: {
            status: GamificationEventStatus.PROCESSING,
            attempts: { increment: 1 },
            failureReason: null,
          },
        });
        return { receipt, processed: false };
      }
      const receipt = await transaction.gamificationEventReceipt.create({
        data: {
          tenantId,
          eventId: input.eventId,
          eventType: input.eventType,
          payload: {
            ...input.payload,
            customerId: input.customerId,
            occurredAt: input.occurredAt.toISOString(),
            delta: input.delta,
          } as Prisma.InputJsonValue,
        },
      });
      return { receipt, processed: false };
    });
  }

  complete(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.gamificationEventReceipt.update({
        where: { id },
        data: {
          status: GamificationEventStatus.PROCESSED,
          processedAt: new Date(),
          failureReason: null,
        },
      }),
    );
  }

  fail(id: string, error: unknown) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.gamificationEventReceipt.update({
        where: { id },
        data: {
          status: GamificationEventStatus.FAILED,
          failureReason: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
        },
      }),
    );
  }
}
