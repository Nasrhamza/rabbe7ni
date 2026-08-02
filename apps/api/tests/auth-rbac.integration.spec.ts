import { createPrismaClient, TenantTransactionManager } from "@rabbehni/database";
import type { PrismaService, TenantTransactionService } from "@rabbehni/database/nest";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthRepository } from "../src/auth/auth.repository.js";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;
const tenantId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000006";

integrationSuite("authentication RBAC and session tenant isolation", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const repository = new AuthRepository(
    prisma as unknown as PrismaService,
    transactions as unknown as TenantTransactionService,
  );
  const sessionHash = randomBytes(32).toString("hex");
  let sessionId: string | undefined;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (sessionId) {
      const id = sessionId;
      await transactions.run(tenantId, (transaction) =>
        transaction.authSession.delete({ where: { id } }),
      );
    }
    await prisma.$disconnect();
  });

  it("resolves roles and permissions from the active tenant membership", async () => {
    const principal = await repository.resolveTokenPrincipal(
      {
        sub: userId,
        tenant_id: tenantId,
        email: "owner@demo.rabbehni.local",
      },
      "bearer",
    );
    expect(principal).toMatchObject({
      tenantId,
      userId,
      roles: ["owner"],
    });
    expect(principal.permissions).toContain("tenant.read");
    expect(principal.permissions).toContain("merchant.manage");
  });

  it("rejects an identity claiming an unrelated tenant", async () => {
    await expect(
      repository.resolveTokenPrincipal(
        {
          sub: userId,
          tenant_id: randomUUID(),
          email: "owner@demo.rabbehni.local",
        },
        "bearer",
      ),
    ).rejects.toThrow();
  });

  it("stores sessions under RLS and hides them from another tenant context", async () => {
    const session = await repository.createSession({
      tenantId,
      userId,
      sessionTokenHash: sessionHash,
      refreshTokenCiphertext: "ciphertext",
      refreshTokenIv: "iv",
      refreshTokenTag: "tag",
      expiresAt: new Date(Date.now() + 60_000),
      idleExpiresAt: new Date(Date.now() + 60_000),
    });
    sessionId = session.id;
    await expect(repository.findSession(tenantId, sessionHash)).resolves.toMatchObject({
      id: session.id,
      tenantId,
    });
    await expect(repository.findSession(randomUUID(), sessionHash)).resolves.toBeNull();
  });
});
