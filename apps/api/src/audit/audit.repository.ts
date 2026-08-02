import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { RecordAuditDto } from "./dto.js";

@Injectable()
export class AuditRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService)
    private readonly transactions: TenantTransactionService,
  ) {}

  record(input: RecordAuditDto) {
    const requestContext = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.auditLog.create({
        data: {
          tenantId,
          action: input.action,
          entityType: input.entityType,
          correlationId: requestContext.correlationId,
          requestId: requestContext.requestId,
          ...(requestContext.actorId ? { actorUserId: requestContext.actorId } : {}),
          ...(input.entityId ? { entityId: input.entityId } : {}),
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
          ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
        },
      }),
    );
  }

  listRecent(limit: number) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.auditLog.findMany({
        where: { tenantId },
        take: Math.min(Math.max(limit, 1), 200),
        orderBy: { occurredAt: "desc" },
      }),
    );
  }
}
