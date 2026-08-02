import { createPrismaClient, TenantTransactionManager } from "@rabbehni/database";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;

integrationSuite("Phase 4 PostgreSQL tenant and organization boundaries", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const franchiseA = randomUUID();

  beforeAll(async () => {
    await prisma.$connect();
    await transactions.run(tenantA, async (transaction) => {
      await transaction.tenant.create({
        data: { id: tenantA, slug: `phase4-a-${tenantA}`, region: "TEST", status: "ACTIVE" },
      });
      await transaction.organization.createMany({
        data: [
          {
            id: organizationA,
            tenantId: tenantA,
            code: "ORG-A",
            legalName: "Organization A",
            displayName: "Organization A",
            countryCode: "FR",
            timezone: "Europe/Paris",
            status: "ACTIVE",
          },
          {
            id: organizationB,
            tenantId: tenantA,
            code: "ORG-B",
            legalName: "Organization B",
            displayName: "Organization B",
            countryCode: "FR",
            timezone: "Europe/Paris",
            status: "ACTIVE",
          },
        ],
      });
      await transaction.franchise.create({
        data: {
          id: franchiseA,
          tenantId: tenantA,
          organizationId: organizationA,
          code: "FR-A",
          name: "Franchise A",
        },
      });
    });
    await transactions.run(tenantB, async (transaction) => {
      await transaction.tenant.create({
        data: { id: tenantB, slug: `phase4-b-${tenantB}`, region: "TEST", status: "ACTIVE" },
      });
      await transaction.organization.create({
        data: {
          tenantId: tenantB,
          code: "ORG-B",
          legalName: "Tenant B",
          displayName: "Tenant B",
          countryCode: "FR",
          timezone: "Europe/Paris",
          status: "ACTIVE",
        },
      });
    });
  });

  afterAll(async () => {
    for (const tenantId of [tenantA, tenantB]) {
      await transactions.run(tenantId, (transaction) =>
        transaction.tenant.delete({ where: { id: tenantId } }),
      );
    }
    await prisma.$disconnect();
  });

  it("allows multiple organizations inside one isolated tenant", async () => {
    const organizations = await transactions.run(tenantA, (transaction) =>
      transaction.organization.findMany({ orderBy: { code: "asc" } }),
    );
    expect(organizations).toHaveLength(2);
  });

  it("rejects a merchant linked to a franchise from another organization", async () => {
    await expect(
      transactions.run(tenantA, (transaction) =>
        transaction.merchant.create({
          data: {
            tenantId: tenantA,
            organizationId: organizationB,
            franchiseId: franchiseA,
            code: "INVALID",
            legalName: "Invalid relation",
            displayName: "Invalid relation",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("hides every Phase 4 row from another tenant context", async () => {
    const visible = await transactions.run(tenantB, (transaction) =>
      transaction.franchise.findMany(),
    );
    expect(visible).toEqual([]);
  });
});
