import { ConflictException } from "@nestjs/common";
import { createPrismaClient, TenantTransactionManager } from "@rabbehni/database";
import type { PrismaService, TenantTransactionService } from "@rabbehni/database/nest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthRepository } from "../src/auth/auth.repository.js";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;

integrationSuite("merchant self-registration provisioning", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const repository = new AuthRepository(
    prisma as unknown as PrismaService,
    transactions as unknown as TenantTransactionService,
  );

  const provisionedTenants: string[] = [];

  const registration = (
    overrides: Partial<Parameters<typeof repository.provisionMerchantWorkspace>[0]> = {},
  ) => {
    const unique = randomUUID().slice(0, 8);
    return {
      workspaceSlug: `test-${unique}`,
      businessName: "Café Test",
      legalName: "Café Test SARL",
      countryCode: "TN",
      timezone: "Africa/Tunis",
      currency: "TND",
      locale: "ar",
      branchName: "Fondation",
      planCode: "starter",
      ownerName: "Owner Test",
      ownerEmail: `owner-${unique}@test.rabbehni.local`,
      ownerPhone: "+21600000000",
      externalSubject: randomUUID(),
      ...overrides,
    };
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    for (const tenantId of provisionedTenants) {
      // Tenant deletion cascades to every row created by provisioning.
      await transactions
        .run(tenantId, (transaction) => transaction.tenant.delete({ where: { id: tenantId } }))
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("provisions a complete, immediately usable workspace in one transaction", async () => {
    const input = registration();
    const workspace = await repository.provisionMerchantWorkspace(input);
    provisionedTenants.push(workspace.tenantId);

    expect(workspace.slug).toBe(input.workspaceSlug);
    expect(workspace.trialEndsAt.getTime()).toBeGreaterThan(Date.now());

    await transactions.run(workspace.tenantId, async (transaction) => {
      const [tenant, organization, merchant, branch, staff, subscription] = await Promise.all([
        transaction.tenant.findUnique({ where: { id: workspace.tenantId } }),
        transaction.organization.findUnique({ where: { id: workspace.organizationId } }),
        transaction.merchant.findUnique({ where: { id: workspace.merchantId } }),
        transaction.branch.findUnique({ where: { id: workspace.branchId } }),
        transaction.staff.findFirst({ where: { userId: workspace.userId } }),
        transaction.subscription.findUnique({ where: { id: workspace.subscriptionId } }),
      ]);

      expect(tenant?.status).toBe("ACTIVE");
      expect(organization?.status).toBe("ACTIVE");
      expect(merchant?.displayName).toBe(input.businessName);
      expect(branch?.currency).toBe("TND");
      expect(staff?.status).toBe("ACTIVE");
      expect(subscription?.status).toBe("TRIALING");
    });
  });

  it("grants the owner the full permission catalogue so the workspace is not locked out", async () => {
    const workspace = await repository.provisionMerchantWorkspace(registration());
    provisionedTenants.push(workspace.tenantId);

    const [catalogueSize, granted] = await Promise.all([
      prisma.permission.count(),
      transactions.run(workspace.tenantId, (transaction) =>
        transaction.rolePermission.count({ where: { tenantId: workspace.tenantId } }),
      ),
    ]);

    expect(catalogueSize).toBeGreaterThan(0);
    expect(granted).toBe(catalogueSize);
  });

  it("resolves the owner into a principal carrying real permissions", async () => {
    const input = registration();
    const workspace = await repository.provisionMerchantWorkspace(input);
    provisionedTenants.push(workspace.tenantId);

    const principal = await repository.resolveTokenPrincipal(
      {
        sub: input.externalSubject,
        tenant_id: workspace.tenantId,
        email: input.ownerEmail,
      },
      "bearer",
    );

    expect(principal.tenantId).toBe(workspace.tenantId);
    expect(principal.roles).toContain("owner");
    expect(principal.permissions).toContain("merchant.manage");
    expect(principal.permissions).toContain("tenant.read");
  });

  it("rejects a duplicate workspace slug even though row level security hides other tenants", async () => {
    const first = registration();
    const workspace = await repository.provisionMerchantWorkspace(first);
    provisionedTenants.push(workspace.tenantId);

    await expect(
      repository.provisionMerchantWorkspace(registration({ workspaceSlug: first.workspaceSlug })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a duplicate owner email", async () => {
    const first = registration();
    const workspace = await repository.provisionMerchantWorkspace(first);
    provisionedTenants.push(workspace.tenantId);

    await expect(
      repository.provisionMerchantWorkspace(registration({ ownerEmail: first.ownerEmail })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("leaves no partial workspace behind when provisioning fails", async () => {
    const conflicting = registration();
    const workspace = await repository.provisionMerchantWorkspace(conflicting);
    provisionedTenants.push(workspace.tenantId);

    const doomed = registration({ ownerEmail: conflicting.ownerEmail });
    await expect(repository.provisionMerchantWorkspace(doomed)).rejects.toThrow();

    // The failed attempt must not have committed its own slug.
    const availability = await repository.isWorkspaceSlugAvailable(doomed.workspaceSlug);
    expect(availability.available).toBe(true);
  });

  it("reports slug availability without a tenant context", async () => {
    const taken = registration();
    const workspace = await repository.provisionMerchantWorkspace(taken);
    provisionedTenants.push(workspace.tenantId);

    await expect(repository.isWorkspaceSlugAvailable(taken.workspaceSlug)).resolves.toMatchObject({
      available: false,
    });
    await expect(
      repository.isWorkspaceSlugAvailable(`free-${randomUUID().slice(0, 8)}`),
    ).resolves.toMatchObject({ available: true });
  });

  it("isolates each provisioned workspace from the others", async () => {
    const a = await repository.provisionMerchantWorkspace(registration());
    const b = await repository.provisionMerchantWorkspace(registration());
    provisionedTenants.push(a.tenantId, b.tenantId);

    const merchantsVisibleToA = await transactions.run(a.tenantId, (transaction) =>
      transaction.merchant.findMany({ select: { id: true } }),
    );

    expect(merchantsVisibleToA.map(({ id }) => id)).toContain(a.merchantId);
    expect(merchantsVisibleToA.map(({ id }) => id)).not.toContain(b.merchantId);
  });
});
