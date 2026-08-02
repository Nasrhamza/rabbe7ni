import { ConflictException } from "@nestjs/common";
import {
  BillingInterval,
  createPrismaClient,
  PlanStatus,
  SubscriptionStatus,
  TenantTransactionManager,
} from "@rabbehni/database";
import type { PrismaService, TenantTransactionService } from "@rabbehni/database/nest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AuthenticatedPrincipal } from "../src/auth/auth.types.js";
import { TenantContextStore } from "../src/tenancy/tenant-context.store.js";
import { SubscriptionsRepository } from "../src/subscriptions/subscriptions.repository.js";
import { SubscriptionsService } from "../src/subscriptions/subscriptions.service.js";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;

integrationSuite("Phase 9 PostgreSQL commercial lifecycle and tenant boundaries", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const context = new TenantContextStore();
  const repository = new SubscriptionsRepository(
    prisma as unknown as PrismaService,
    context,
    transactions as unknown as TenantTransactionService,
  );
  const service = new SubscriptionsService(repository, context);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const planId = randomUUID();

  const principal = (tenantId: string): AuthenticatedPrincipal => ({
    subject: randomUUID(),
    userId: randomUUID(),
    tenantId,
    membershipId: randomUUID(),
    email: "phase9@example.com",
    displayName: "Phase 9",
    locale: "fr",
    permissions: [
      "subscription.read",
      "subscription.manage",
      "billing.read",
      "billing.manage",
      "usage.write",
      "quota.manage",
    ],
    roles: ["phase9-test"],
    access: {
      organizationIds: [],
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
    await prisma.plan.create({
      data: {
        id: planId,
        code: `phase9-${planId}`,
        name: "Phase 9 runtime",
        status: PlanStatus.ACTIVE,
        currency: "TND",
        monthlyPriceMinor: 12_000,
        annualPriceMinor: 120_000,
        transactionFeeBasisPoints: 250,
        trialDays: 7,
        entitlements: { gamification: true },
        limits: { api_calls: 3 },
        quotaLimits: {
          create: [{ metricKey: "api_calls", limitValue: 3, period: "MONTH" }],
        },
        featureEntitlements: {
          create: [{ featureKey: "gamification", enabled: true, configuration: {} }],
        },
      },
    });
    for (const tenantId of [tenantA, tenantB]) {
      await transactions.run(tenantId, (transaction) =>
        transaction.tenant.create({
          data: {
            id: tenantId,
            slug: `phase9-${tenantId}`,
            region: "TEST",
            status: "ACTIVE",
          },
        }),
      );
    }
  });

  afterAll(async () => {
    for (const tenantId of [tenantA, tenantB]) {
      await transactions.run(tenantId, async (transaction) => {
        await transaction.billingWebhook.deleteMany({ where: { tenantId } });
        await transaction.paymentTransaction.deleteMany({ where: { tenantId } });
        await transaction.invoice.deleteMany({ where: { tenantId } });
        await transaction.paymentIntent.deleteMany({ where: { tenantId } });
        await transaction.usageRecord.deleteMany({ where: { tenantId } });
        await transaction.subscriptionChange.deleteMany({ where: { tenantId } });
        await transaction.tenantQuotaOverride.deleteMany({ where: { tenantId } });
        await transaction.auditLog.deleteMany({ where: { tenantId } });
        await transaction.outboxEvent.deleteMany({ where: { tenantId } });
        await transaction.subscription.deleteMany({ where: { tenantId } });
        await transaction.tenant.delete({ where: { id: tenantId } });
      });
    }
    await prisma.plan.delete({ where: { id: planId } });
    await prisma.$disconnect();
  });

  it("runs trial, activation, suspension and reactivation idempotently", async () => {
    const trialKey = `trial:${randomUUID()}`;
    const trial = await runAs(tenantA, () =>
      repository.startTrial({
        planId,
        billingInterval: BillingInterval.MONTHLY,
        idempotencyKey: trialKey,
      }),
    );
    const replay = await runAs(tenantA, () =>
      repository.startTrial({
        planId,
        billingInterval: BillingInterval.MONTHLY,
        idempotencyKey: trialKey,
      }),
    );
    expect(replay.id).toBe(trial.id);
    expect(trial.status).toBe(SubscriptionStatus.TRIALING);

    const activated = await runAs(tenantA, () =>
      repository.lifecycle("activate", {
        idempotencyKey: `activate:${randomUUID()}`,
        atPeriodEnd: false,
      }),
    );
    expect(activated.status).toBe(SubscriptionStatus.ACTIVE);
    const suspended = await runAs(tenantA, () =>
      repository.lifecycle("suspend", {
        idempotencyKey: `suspend:${randomUUID()}`,
        reason: "Runtime boundary test",
        atPeriodEnd: false,
      }),
    );
    expect(suspended.status).toBe(SubscriptionStatus.PAUSED);
    const reactivated = await runAs(tenantA, () =>
      repository.lifecycle("reactivate", {
        idempotencyKey: `reactivate:${randomUUID()}`,
        atPeriodEnd: false,
      }),
    );
    expect(reactivated.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("creates sandbox payment, invoice and transaction fee without real money", async () => {
    const subscription = await runAs(tenantA, () => repository.listCurrent());
    const checkoutKey = `checkout:${randomUUID()}`;
    const checkout = await runAs(tenantA, () =>
      service.checkout({ subscriptionId: subscription[0]?.id, idempotencyKey: checkoutKey }),
    );
    const payment = await runAs(tenantA, () =>
      service.confirmCheckout({
        checkoutToken: checkout.checkoutToken,
        outcome: "SUCCEEDED",
        idempotencyKey: `confirm:${randomUUID()}`,
      }),
    );
    expect(payment.status).toBe("SUCCEEDED");
    expect(payment.invoice?.status).toBe("PAID");
    expect(payment.feeMinor).toBe(300);
  });

  it("simulates a failed payment and marks the subscription past due", async () => {
    const subscription = await runAs(tenantA, () => repository.listCurrent());
    const checkout = await runAs(tenantA, () =>
      service.checkout({
        subscriptionId: subscription[0]?.id,
        idempotencyKey: `checkout-failed:${randomUUID()}`,
      }),
    );
    const payment = await runAs(tenantA, () =>
      service.confirmCheckout({
        checkoutToken: checkout.checkoutToken,
        outcome: "FAILED",
        failureCode: "sandbox_insufficient_funds",
        idempotencyKey: `confirm-failed:${randomUUID()}`,
      }),
    );
    expect(payment.status).toBe("FAILED");
    expect(payment.invoice?.status).toBe("UNCOLLECTIBLE");
    expect(payment.failureCode).toBe("sandbox_insufficient_funds");
    const current = await runAs(tenantA, () => repository.listCurrent());
    expect(current[0]?.status).toBe(SubscriptionStatus.PAST_DUE);
  });

  it("validates and replays a signed sandbox webhook idempotently", async () => {
    const subscription = await runAs(tenantA, () => repository.listCurrent());
    const checkout = await runAs(tenantA, () =>
      service.checkout({
        subscriptionId: subscription[0]?.id,
        idempotencyKey: `checkout-webhook:${randomUUID()}`,
      }),
    );
    const payload = {
      tenantId: tenantA,
      eventId: `event:${randomUUID()}`,
      paymentIntentId: checkout.paymentIntentId,
      outcome: "SUCCEEDED" as const,
    };
    const signature = service.signWebhook(payload);
    const first = await runAs(tenantA, () => service.webhook(payload, signature));
    const replay = await runAs(tenantA, () => service.webhook(payload, signature));
    expect(first.webhook.id).toBe(replay.webhook.id);
    expect(first.payment.id).toBe(replay.payment.id);
    expect(first.payment.status).toBe("SUCCEEDED");
  });

  it("enforces plan quotas and preserves usage idempotency", async () => {
    const key = `usage:${randomUUID()}`;
    const first = await runAs(tenantA, () =>
      repository.recordUsage({
        metricKey: "api_calls",
        quantity: 2,
        idempotencyKey: key,
        metadata: {},
      }),
    );
    const replay = await runAs(tenantA, () =>
      repository.recordUsage({
        metricKey: "api_calls",
        quantity: 2,
        idempotencyKey: key,
        metadata: {},
      }),
    );
    expect(replay.id).toBe(first.id);
    await expect(
      runAs(tenantA, () =>
        repository.recordUsage({
          metricKey: "api_calls",
          quantity: 2,
          idempotencyKey: `usage:${randomUUID()}`,
          metadata: {},
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("prevents cross-tenant reads through PostgreSQL RLS", async () => {
    await expect(runAs(tenantB, () => repository.listCurrent())).resolves.toEqual([]);
    const tenantBRows = await transactions.run(tenantB, (transaction) =>
      transaction.paymentTransaction.findMany(),
    );
    expect(tenantBRows).toEqual([]);
  });
});
