import { ConflictException } from "@nestjs/common";
import {
  createPrismaClient,
  PointsEntryType,
  QrPurpose,
  RewardRedemptionStatus,
  TenantTransactionManager,
} from "@rabbehni/database";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AuthenticatedPrincipal } from "../src/auth/auth.types.js";
import { PointsRepository } from "../src/points/points.repository.js";
import { QrRepository } from "../src/qr/qr.repository.js";
import { RewardsRepository } from "../src/rewards/rewards.repository.js";
import { TenantContextStore } from "../src/tenancy/tenant-context.store.js";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;

integrationSuite("Phase 5 PostgreSQL ledger, rewards and QR runtime", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const context = new TenantContextStore();
  const points = new PointsRepository(context, transactions);
  const rewards = new RewardsRepository(context, transactions);
  const qr = new QrRepository(context, transactions);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const organizationId = randomUUID();
  const customerId = randomUUID();
  const programId = randomUUID();
  const rewardId = randomUUID();

  const principal = (tenantId: string): AuthenticatedPrincipal => ({
    subject: randomUUID(),
    userId: randomUUID(),
    tenantId,
    membershipId: randomUUID(),
    email: "phase5@example.com",
    displayName: "Phase 5",
    locale: "en",
    permissions: [
      "customer.read",
      "loyalty.read",
      "points.read",
      "points.adjust",
      "reward.read",
      "reward.redeem",
      "qr.read",
      "qr.scan",
    ],
    roles: ["phase5-test"],
    access: {
      organizationIds: tenantId === tenantA ? [organizationId] : [],
      franchiseIds: [],
      merchantIds: [],
      branchIds: [],
      tenantWide: true,
    },
    authMethod: "session",
  });

  function runAs<T>(tenantId: string, operation: () => Promise<T>): Promise<T> {
    return context.run(
      {
        tenantId,
        principal: principal(tenantId),
        requestId: randomUUID(),
        correlationId: randomUUID(),
      },
      operation,
    );
  }

  beforeAll(async () => {
    await prisma.$connect();
    await transactions.run(tenantA, async (transaction) => {
      await transaction.tenant.create({
        data: { id: tenantA, slug: `phase5-a-${tenantA}`, region: "TEST", status: "ACTIVE" },
      });
      await transaction.organization.create({
        data: {
          id: organizationId,
          tenantId: tenantA,
          code: "PHASE5",
          legalName: "Phase 5",
          displayName: "Phase 5",
          countryCode: "FR",
          timezone: "Europe/Paris",
          status: "ACTIVE",
        },
      });
      await transaction.customer.create({
        data: {
          id: customerId,
          tenantId: tenantA,
          organizationId,
          displayName: "Ledger Customer",
          status: "ACTIVE",
        },
      });
      await transaction.loyaltyProgram.create({
        data: {
          id: programId,
          tenantId: tenantA,
          organizationId,
          code: "LEDGER",
          name: "Ledger",
          status: "ACTIVE",
          minimumEarnPoints: 1,
          minimumRedeemPoints: 1,
          appliesToAllMerchants: true,
          appliesToAllBranches: true,
        },
      });
      await transaction.reward.create({
        data: {
          id: rewardId,
          tenantId: tenantA,
          organizationId,
          programId,
          code: "RUNTIME",
          name: "Runtime reward",
          status: "ACTIVE",
          pointsCost: 10,
          stockQuantity: 2,
          unlimitedStock: false,
        },
      });
    });
    await transactions.run(tenantB, async (transaction) => {
      await transaction.tenant.create({
        data: { id: tenantB, slug: `phase5-b-${tenantB}`, region: "TEST", status: "ACTIVE" },
      });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps one immutable entry for an idempotent earn request", async () => {
    const operation = {
      customerId,
      programId,
      type: PointsEntryType.EARN,
      points: 100,
      idempotencyKey: `earn:${randomUUID()}`,
    };
    const first = await runAs(tenantA, () => points.post(operation));
    const replay = await runAs(tenantA, () => points.post(operation));
    expect(replay.entry.id).toBe(first.entry.id);
    expect(replay.idempotent).toBe(true);
    expect(replay.balance).toBe(100);
  });

  it("serializes concurrent debits and prevents a negative balance", async () => {
    const results = await Promise.allSettled([
      runAs(tenantA, () =>
        points.post({
          customerId,
          programId,
          type: PointsEntryType.EXPIRE,
          points: -80,
          idempotencyKey: `expire:${randomUUID()}`,
        }),
      ),
      runAs(tenantA, () =>
        points.post({
          customerId,
          programId,
          type: PointsEntryType.EXPIRE,
          points: -80,
          idempotencyKey: `expire:${randomUUID()}`,
        }),
      ),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(
      (results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason,
    ).toBeInstanceOf(ConflictException);
    await expect(
      runAs(tenantA, () => points.balance(customerId, programId)),
    ).resolves.toMatchObject({ balance: 20 });
  });

  it("redeems and reverses a reward atomically with points and stock", async () => {
    const redeemed = await runAs(tenantA, () =>
      rewards.redeem({
        customerId,
        rewardId,
        quantity: 1,
        idempotencyKey: `redeem:${randomUUID()}`,
        metadata: {},
      }),
    );
    expect(redeemed.balance).toBe(10);
    const afterRedeem = await transactions.run(tenantA, (transaction) =>
      transaction.reward.findUniqueOrThrow({ where: { id: rewardId } }),
    );
    expect(afterRedeem.stockQuantity).toBe(1);

    const reversed = await runAs(tenantA, () =>
      rewards.reverseRedemption(
        redeemed.redemption.id,
        `reverse:${randomUUID()}`,
        "Runtime verification",
        RewardRedemptionStatus.REVERSED,
      ),
    );
    expect(reversed?.redemption.status).toBe(RewardRedemptionStatus.REVERSED);
    await expect(
      runAs(tenantA, () => points.balance(customerId, programId)),
    ).resolves.toMatchObject({ balance: 20 });
    const afterReverse = await transactions.run(tenantA, (transaction) =>
      transaction.reward.findUniqueOrThrow({ where: { id: rewardId } }),
    );
    expect(afterReverse.stockQuantity).toBe(2);
  });

  it("prevents concurrent reward stock overselling across customers", async () => {
    const secondCustomerId = randomUUID();
    const limitedRewardId = randomUUID();
    await transactions.run(tenantA, async (transaction) => {
      await transaction.customer.create({
        data: {
          id: secondCustomerId,
          tenantId: tenantA,
          organizationId,
          displayName: "Second customer",
          status: "ACTIVE",
        },
      });
      await transaction.reward.create({
        data: {
          id: limitedRewardId,
          tenantId: tenantA,
          organizationId,
          programId,
          code: `LIMITED-${limitedRewardId}`,
          name: "Last item",
          status: "ACTIVE",
          pointsCost: 10,
          stockQuantity: 1,
          unlimitedStock: false,
        },
      });
    });
    await Promise.all([
      runAs(tenantA, () =>
        points.post({
          customerId,
          programId,
          type: PointsEntryType.EARN,
          points: 10,
          idempotencyKey: `stock-earn:${randomUUID()}`,
        }),
      ),
      runAs(tenantA, () =>
        points.post({
          customerId: secondCustomerId,
          programId,
          type: PointsEntryType.EARN,
          points: 10,
          idempotencyKey: `stock-earn:${randomUUID()}`,
        }),
      ),
    ]);
    const results = await Promise.allSettled([
      runAs(tenantA, () =>
        rewards.redeem({
          customerId,
          rewardId: limitedRewardId,
          quantity: 1,
          idempotencyKey: `limited:${randomUUID()}`,
          metadata: {},
        }),
      ),
      runAs(tenantA, () =>
        rewards.redeem({
          customerId: secondCustomerId,
          rewardId: limitedRewardId,
          quantity: 1,
          idempotencyKey: `limited:${randomUUID()}`,
          metadata: {},
        }),
      ),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const reward = await transactions.run(tenantA, (transaction) =>
      transaction.reward.findUniqueOrThrow({ where: { id: limitedRewardId } }),
    );
    expect(reward.stockQuantity).toBe(0);
  });

  it("enforces append-only ledger rows at PostgreSQL level", async () => {
    const entry = await transactions.run(tenantA, (transaction) =>
      transaction.pointsLedgerEntry.findFirstOrThrow({ where: { customerId } }),
    );
    await expect(
      transactions.run(tenantA, (transaction) =>
        transaction.pointsLedgerEntry.update({
          where: { id: entry.id },
          data: { points: 999_999 },
        }),
      ),
    ).rejects.toThrow("append-only");
  });

  it("hides Phase 5 rows from another tenant context", async () => {
    const [customers, entries, rewardsVisible] = await transactions.run(tenantB, (transaction) =>
      Promise.all([
        transaction.customer.findMany(),
        transaction.pointsLedgerEntry.findMany(),
        transaction.reward.findMany(),
      ]),
    );
    expect(customers).toEqual([]);
    expect(entries).toEqual([]);
    expect(rewardsVisible).toEqual([]);
  });

  it("allows exactly one concurrent claim of a signed QR record", async () => {
    const tokenId = randomUUID();
    const nonce = randomUUID().replaceAll("-", "");
    const tokenHash = "a".repeat(64);
    const expiresAt = new Date(Date.now() + 60_000);
    await transactions.run(tenantA, (transaction) =>
      transaction.customerQrToken.create({
        data: {
          id: tokenId,
          tenantId: tenantA,
          customerId,
          purpose: QrPurpose.IDENTITY,
          nonce,
          tokenHash,
          expiresAt,
        },
      }),
    );
    const payload = {
      v: 1 as const,
      tenantId: tenantA,
      customerId,
      purpose: QrPurpose.IDENTITY,
      nonce,
      exp: Math.floor(expiresAt.getTime() / 1_000),
      context: {},
    };
    const claims = await Promise.allSettled([
      runAs(tenantA, () => qr.claim(payload, tokenHash, `qr:${randomUUID()}`)),
      runAs(tenantA, () => qr.claim(payload, tokenHash, `qr:${randomUUID()}`)),
    ]);
    expect(claims.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(claims.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
