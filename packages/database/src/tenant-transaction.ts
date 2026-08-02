import type { Prisma, PrismaClient } from "./generated/prisma/client.js";

export type TenantTransaction = Prisma.TransactionClient;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class TenantTransactionManager {
  constructor(private readonly prisma: PrismaClient) {}

  async run<T>(
    tenantId: string,
    operation: (transaction: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    if (!UUID_PATTERN.test(tenantId)) {
      throw new TypeError("A valid tenant UUID is required");
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT set_config('app.current_tenant_id', ${tenantId}, true)
      `;
      return operation(transaction);
    });
  }
}
