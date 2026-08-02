import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "./generated/prisma/client.js";
import { TenantTransactionManager } from "./tenant-transaction.js";

describe("TenantTransactionManager", () => {
  it("rejects an invalid tenant identifier before opening a transaction", async () => {
    const transaction = vi.fn();
    const manager = new TenantTransactionManager({
      $transaction: transaction,
    } as unknown as PrismaClient);

    await expect(manager.run("tenant-a", vi.fn())).rejects.toThrow(
      "A valid tenant UUID is required",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("sets the PostgreSQL tenant context inside the same transaction", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ set_config: "tenant" }]);
    const transactionClient = { $queryRaw: queryRaw };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => Promise<string>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaClient;
    const manager = new TenantTransactionManager(prisma);
    const operation = vi.fn().mockResolvedValue("done");

    await expect(manager.run("10000000-0000-4000-8000-000000000001", operation)).resolves.toBe(
      "done",
    );
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith(transactionClient);
  });
});
