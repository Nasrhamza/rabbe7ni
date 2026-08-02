import { Inject, Injectable } from "@nestjs/common";
import { MarketingEventStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { MarketingDomainEvent } from "../automations/dto.js";

@Injectable()
export class MarketingEventsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  begin(event: MarketingDomainEvent) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:marketing-event:${event.eventId}`}))`;
      const existing = await transaction.marketingEventReceipt.findUnique({
        where: { tenantId_eventId: { tenantId, eventId: event.eventId } },
      });
      if (existing?.status === MarketingEventStatus.PROCESSED) {
        return { receipt: existing, duplicate: true };
      }
      const receipt = existing
        ? await transaction.marketingEventReceipt.update({
            where: { id: existing.id },
            data: {
              status: MarketingEventStatus.PROCESSING,
              attempts: { increment: 1 },
              failureReason: null,
              nextRetryAt: null,
            },
          })
        : await transaction.marketingEventReceipt.create({
            data: {
              tenantId,
              eventId: event.eventId,
              eventType: event.eventType,
              payload: event.payload as Prisma.InputJsonValue,
            },
          });
      return { receipt, duplicate: false };
    });
  }

  complete(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.marketingEventReceipt.update({
        where: { id },
        data: { status: MarketingEventStatus.PROCESSED, processedAt: new Date() },
      }),
    );
  }

  fail(id: string, reason: string, deadLetter: boolean) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.marketingEventReceipt.update({
        where: { id },
        data: {
          status: deadLetter ? MarketingEventStatus.DEAD_LETTER : MarketingEventStatus.FAILED,
          failureReason: reason,
          nextRetryAt: deadLetter ? null : new Date(Date.now() + 60_000),
        },
      }),
    );
  }
}
