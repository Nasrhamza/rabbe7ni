import {
  createPrismaClient,
  OrganizationStatus,
  RegionStatus,
  TenantTransactionManager,
} from "@rabbehni/database";
import type { TenantTransactionService } from "@rabbehni/database/nest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CulturalProfileService } from "../src/regions/cultural-profile.service.js";
import { TenantContextStore } from "../src/tenancy/tenant-context.store.js";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;

integrationSuite("cultural profile resolution", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const context = new TenantContextStore();
  const service = new CulturalProfileService(
    context,
    transactions as unknown as TenantTransactionService,
  );

  const tenantId = randomUUID();
  const organizationTunis = randomUUID();
  const organizationNoRegion = randomUUID();
  const countryTunisia = randomUUID();
  const countryUnconfigured = randomUUID();
  const regionTunisia = randomUUID();

  beforeAll(async () => {
    await prisma.$connect();
    await transactions.run(tenantId, async (transaction) => {
      await transaction.tenant.create({
        data: {
          id: tenantId,
          slug: `culture-${tenantId.slice(0, 8)}`,
          region: "TEST",
          status: "ACTIVE",
        },
      });
      await transaction.organization.createMany({
        data: [
          {
            id: organizationTunis,
            tenantId,
            code: "TUNIS-CO",
            legalName: "Cafe Tunis SARL",
            displayName: "Cafe Tunis",
            countryCode: "TN",
            timezone: "Africa/Tunis",
            status: OrganizationStatus.ACTIVE,
          },
          {
            id: organizationNoRegion,
            tenantId,
            code: "UNCONFIGURED-CO",
            legalName: "No Region SARL",
            displayName: "No Region",
            countryCode: "ZZ",
            timezone: "UTC",
            status: OrganizationStatus.ACTIVE,
          },
        ],
      });
      await transaction.platformCountry.createMany({
        data: [
          {
            id: countryTunisia,
            tenantId,
            code: "TN",
            name: "Tunisia",
            defaultLocale: "ar",
            defaultCurrency: "TND",
          },
          {
            id: countryUnconfigured,
            tenantId,
            code: "ZZ",
            name: "Unconfigured",
            defaultLocale: "en",
            defaultCurrency: "USD",
          },
        ],
      });
      await transaction.platformRegion.create({
        data: {
          id: regionTunisia,
          tenantId,
          countryId: countryTunisia,
          code: "TN-NATIONAL",
          name: "Tunisia",
          timezone: "Africa/Tunis",
          locale: "ar-TN",
          currency: "TND",
          status: RegionStatus.ACTIVE,
          culturalProfile: {
            firstLanguage: "ar",
            secondaryLanguage: "fr",
            rewardStyle: "family-and-value",
          },
        },
      });
      // ZZ has a country row but deliberately no region, exercising the "country exists, region
      // does not" branch of the resolver.
    });
  });

  afterAll(async () => {
    await transactions
      .run(tenantId, (transaction) => transaction.tenant.delete({ where: { id: tenantId } }))
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it("resolves the full profile through organization -> country -> region", async () => {
    const profile = await context.run(
      { requestId: randomUUID(), tenantId, correlationId: randomUUID() },
      () => service.resolveForOrganization(organizationTunis),
    );
    expect(profile).toMatchObject({
      regionCode: "TN-NATIONAL",
      countryCode: "TN",
      currency: "TND",
      firstLanguage: "ar",
      secondaryLanguage: "fr",
      rewardStyle: "family-and-value",
    });
  });

  it("returns null when the country has no configured region", async () => {
    const profile = await context.run(
      { requestId: randomUUID(), tenantId, correlationId: randomUUID() },
      () => service.resolveForOrganization(organizationNoRegion),
    );
    expect(profile).toBeNull();
  });

  it("returns null for an organization outside the authorized tenant", async () => {
    const otherTenantId = randomUUID();
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
      await transaction.tenant.create({
        data: {
          id: otherTenantId,
          slug: `culture-b-${otherTenantId.slice(0, 8)}`,
          region: "TEST",
          status: "ACTIVE",
        },
      });
    });
    const profile = await context.run(
      { requestId: randomUUID(), tenantId: otherTenantId, correlationId: randomUUID() },
      () => service.resolveForOrganization(organizationTunis),
    );
    expect(profile).toBeNull();
    await transactions
      .run(otherTenantId, (transaction) =>
        transaction.tenant.delete({ where: { id: otherTenantId } }),
      )
      .catch(() => undefined);
  });
});
