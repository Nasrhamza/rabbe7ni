import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { TenantContextStore } from "../../tenancy/tenant-context.store.js";

export interface PublishTechnicalEvent {
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export abstract class TechnicalEventPublisher {
  abstract publish(event: PublishTechnicalEvent): Promise<string>;
}

@Injectable()
export class OutboxTechnicalEventPublisher extends TechnicalEventPublisher {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService)
    private readonly transactions: TenantTransactionService,
  ) {
    super();
  }

  async publish(event: PublishTechnicalEvent): Promise<string> {
    const requestContext = this.context.current();
    const tenantId = this.context.tenantId();

    const result = await this.transactions.run(tenantId, (transaction) =>
      transaction.outboxEvent.create({
        data: {
          tenantId,
          eventType: event.type,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          correlationId: requestContext.correlationId,
          payload: event.payload as Prisma.InputJsonValue,
        },
        select: { id: true },
      }),
    );
    return result.id;
  }
}
