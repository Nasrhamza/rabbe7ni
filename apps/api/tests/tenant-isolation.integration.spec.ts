import { createPrismaClient, TenantTransactionManager } from "@rabbehni/database";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;

integrationSuite("PostgreSQL tenant isolation", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const tenantA = randomUUID();
  const tenantB = randomUUID();

  beforeAll(async () => {
    await prisma.$connect();
    for (const [id, slug] of [
      [tenantA, `isolation-a-${tenantA}`],
      [tenantB, `isolation-b-${tenantB}`],
    ] as const) {
      await transactions.run(id, async (transaction) => {
        await transaction.tenant.create({
          data: {
            id,
            slug,
            status: "ACTIVE",
            region: "TEST",
            defaultCurrency: "EUR",
          },
        });
        await transaction.organization.create({
          data: {
            tenantId: id,
            code: "TEST",
            legalName: slug,
            displayName: slug,
            countryCode: "FR",
            timezone: "Europe/Paris",
          },
        });
        await transaction.platformCountry.create({
          data: {
            tenantId: id,
            code: id === tenantA ? "FR" : "TN",
            name: slug,
            defaultLocale: id === tenantA ? "fr-FR" : "fr-TN",
            defaultCurrency: id === tenantA ? "EUR" : "TND",
          },
        });
      });
    }
  });

  afterAll(async () => {
    for (const tenantId of [tenantA, tenantB]) {
      await transactions.run(tenantId, (transaction) =>
        transaction.tenant.delete({ where: { id: tenantId } }),
      );
    }
    await prisma.$disconnect();
  });

  it("returns only rows belonging to the active tenant without a where clause", async () => {
    const organizations = await transactions.run(tenantA, (transaction) =>
      transaction.organization.findMany(),
    );

    expect(organizations).toHaveLength(1);
    expect(organizations[0]?.tenantId).toBe(tenantA);
  });

  it("rejects a cross-tenant write even when the caller supplies another tenant id", async () => {
    await expect(
      transactions.run(tenantA, (transaction) =>
        transaction.organization.create({
          data: {
            tenantId: tenantB,
            code: "ATTACK",
            legalName: "Cross tenant",
            displayName: "Cross tenant",
            countryCode: "FR",
            timezone: "Europe/Paris",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("isolates the regional governance catalog and rejects cross-tenant assignments", async () => {
    const countries = await transactions.run(tenantA, (transaction) =>
      transaction.platformCountry.findMany(),
    );
    expect(countries).toHaveLength(1);
    expect(countries[0]?.tenantId).toBe(tenantA);
    expect(countries[0]?.code).toBe("FR");

    await expect(
      transactions.run(tenantA, (transaction) =>
        transaction.platformRegion.create({
          data: {
            tenantId: tenantB,
            countryId: countries[0]!.id,
            code: "CROSS-TENANT",
            name: "Cross tenant",
            timezone: "UTC",
            locale: "en",
            currency: "EUR",
          },
        }),
      ),
    ).rejects.toThrow();
  });
});
