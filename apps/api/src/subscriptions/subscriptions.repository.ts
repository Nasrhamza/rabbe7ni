import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  BillingInterval,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionChangeType,
  SubscriptionStatus,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import { PrismaService, TenantTransactionService } from "@rabbehni/database/nest";
import { createHash, randomBytes } from "node:crypto";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  ChangePlanDto,
  CheckoutConfirmationDto,
  CheckoutDto,
  CreatePlanDto,
  CreateSubscriptionDto,
  CustomDomainDto,
  LifecycleDto,
  LocalizationDto,
  QuotaOverrideDto,
  SandboxWebhookDto,
  StartTrialDto,
  UpdatePlanDto,
  UsageDto,
  WhiteLabelDto,
} from "./dto.js";

const subscriptionInclude = {
  plan: {
    include: {
      featureEntitlements: { orderBy: { featureKey: "asc" as const } },
      quotaLimits: { orderBy: { metricKey: "asc" as const } },
    },
  },
} satisfies Prisma.SubscriptionInclude;

@Injectable()
export class SubscriptionsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService)
    private readonly transactions: TenantTransactionService,
  ) {}

  listPlans(includeInactive = false) {
    return this.prisma.plan.findMany({
      ...(includeInactive ? {} : { where: { status: "ACTIVE" as const } }),
      include: {
        featureEntitlements: { orderBy: { featureKey: "asc" } },
        quotaLimits: { orderBy: { metricKey: "asc" } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { monthlyPriceMinor: "asc" }],
    });
  }

  createPlan(input: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        code: input.code,
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        status: input.status,
        currency: input.currency,
        monthlyPriceMinor: input.monthlyPriceMinor,
        annualPriceMinor: input.annualPriceMinor,
        transactionFeeBasisPoints: input.transactionFeeBasisPoints,
        trialDays: input.trialDays,
        sortOrder: input.sortOrder,
        entitlements: Object.fromEntries(
          input.features.map((feature) => [feature.featureKey, feature.enabled]),
        ),
        limits: Object.fromEntries(
          input.quotas.map((quota) => [quota.metricKey, quota.limitValue]),
        ),
        featureEntitlements: {
          create: input.features.map((feature) => ({
            featureKey: feature.featureKey,
            enabled: feature.enabled,
            configuration: feature.configuration as Prisma.InputJsonValue,
          })),
        },
        quotaLimits: { create: input.quotas },
      },
      include: subscriptionInclude.plan.include,
    });
  }

  async updatePlan(id: string, input: UpdatePlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Plan not found");
    return this.prisma.$transaction(async (transaction) => {
      if (input.features) {
        await transaction.planFeatureEntitlement.deleteMany({ where: { planId: id } });
      }
      if (input.quotas) {
        await transaction.planQuotaLimit.deleteMany({ where: { planId: id } });
      }
      return transaction.plan.update({
        where: { id },
        data: {
          ...(input.code ? { code: input.code } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.monthlyPriceMinor !== undefined
            ? { monthlyPriceMinor: input.monthlyPriceMinor }
            : {}),
          ...(input.annualPriceMinor !== undefined
            ? { annualPriceMinor: input.annualPriceMinor }
            : {}),
          ...(input.transactionFeeBasisPoints !== undefined
            ? { transactionFeeBasisPoints: input.transactionFeeBasisPoints }
            : {}),
          ...(input.trialDays !== undefined ? { trialDays: input.trialDays } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.features
            ? {
                entitlements: Object.fromEntries(
                  input.features.map((feature) => [feature.featureKey, feature.enabled]),
                ),
                featureEntitlements: {
                  create: input.features.map((feature) => ({
                    featureKey: feature.featureKey,
                    enabled: feature.enabled,
                    configuration: feature.configuration as Prisma.InputJsonValue,
                  })),
                },
              }
            : {}),
          ...(input.quotas
            ? {
                limits: Object.fromEntries(
                  input.quotas.map((quota) => [quota.metricKey, quota.limitValue]),
                ),
                quotaLimits: { create: input.quotas },
              }
            : {}),
        },
        include: subscriptionInclude.plan.include,
      });
    });
  }

  create(input: CreateSubscriptionDto) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const duplicate = await transaction.subscriptionChange.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
        include: { subscription: { include: subscriptionInclude } },
      });
      if (duplicate) return duplicate.subscription;
      const subscription = await transaction.subscription.create({
        data: {
          tenantId,
          planId: input.planId,
          status: input.status,
          billingInterval: input.billingInterval,
          startsAt: input.startsAt,
          currentPeriodStartsAt: input.startsAt,
          trialEndsAt: input.trialEndsAt ?? null,
          currentPeriodEndsAt: input.currentPeriodEndsAt ?? null,
        },
        include: subscriptionInclude,
      });
      await transaction.subscriptionChange.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          idempotencyKey: input.idempotencyKey,
          type:
            input.status === SubscriptionStatus.TRIALING
              ? SubscriptionChangeType.TRIAL_STARTED
              : SubscriptionChangeType.ACTIVATED,
          toPlanId: input.planId,
        },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: "subscription.create",
        eventType: "subscriptions.subscription.created.v2",
        entityType: "subscription",
        entityId: subscription.id,
        payload: { planId: input.planId, status: input.status },
      });
      return subscription;
    });
  }

  startTrial(input: StartTrialDto) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const duplicate = await transaction.subscriptionChange.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
        include: { subscription: { include: subscriptionInclude } },
      });
      if (duplicate) return duplicate.subscription;
      const current = await this.current(transaction, tenantId);
      if (current && current.status !== SubscriptionStatus.CANCELED) {
        throw new ConflictException("Tenant already has a current subscription");
      }
      const plan = await transaction.plan.findFirst({
        where: { id: input.planId, status: "ACTIVE" },
      });
      if (!plan) throw new NotFoundException("Active plan not found");
      const now = new Date();
      const trialEndsAt = this.addDays(now, plan.trialDays);
      const subscription = await transaction.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: plan.trialDays > 0 ? "TRIALING" : "ACTIVE",
          billingInterval: input.billingInterval,
          startsAt: now,
          trialEndsAt: plan.trialDays > 0 ? trialEndsAt : null,
          currentPeriodStartsAt: now,
          currentPeriodEndsAt:
            plan.trialDays > 0 ? trialEndsAt : this.addPeriod(now, input.billingInterval),
          nextBillingAt:
            plan.trialDays > 0 ? trialEndsAt : this.addPeriod(now, input.billingInterval),
        },
        include: subscriptionInclude,
      });
      await transaction.subscriptionChange.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          idempotencyKey: input.idempotencyKey,
          type:
            plan.trialDays > 0
              ? SubscriptionChangeType.TRIAL_STARTED
              : SubscriptionChangeType.ACTIVATED,
          toPlanId: plan.id,
        },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: "subscription.trial.start",
        eventType: "subscriptions.trial.started.v1",
        entityType: "subscription",
        entityId: subscription.id,
        payload: { planId: plan.id, trialEndsAt: subscription.trialEndsAt?.toISOString() },
      });
      return subscription;
    });
  }

  lifecycle(
    action: "activate" | "renew" | "cancel" | "suspend" | "reactivate",
    input: LifecycleDto,
  ) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const duplicate = await transaction.subscriptionChange.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
        include: { subscription: { include: subscriptionInclude } },
      });
      if (duplicate) return duplicate.subscription;
      const current = await this.current(transaction, tenantId);
      if (!current) throw new NotFoundException("Current subscription not found");
      const now = new Date();
      const map = {
        activate: SubscriptionChangeType.ACTIVATED,
        cancel: input.atPeriodEnd
          ? SubscriptionChangeType.CANCELLATION_SCHEDULED
          : SubscriptionChangeType.CANCELED,
        reactivate: SubscriptionChangeType.REACTIVATED,
        renew: SubscriptionChangeType.RENEWED,
        suspend: SubscriptionChangeType.SUSPENDED,
      } as const;
      const data: Prisma.SubscriptionUpdateInput =
        action === "cancel"
          ? input.atPeriodEnd
            ? { cancelAtPeriodEnd: true, canceledAt: now, version: { increment: 1 } }
            : {
                status: "CANCELED",
                cancelAtPeriodEnd: false,
                canceledAt: now,
                endedAt: now,
                nextBillingAt: null,
                version: { increment: 1 },
              }
          : action === "suspend"
            ? {
                status: "PAUSED",
                suspendedAt: now,
                nextBillingAt: null,
                version: { increment: 1 },
              }
            : action === "renew"
              ? {
                  status: "ACTIVE",
                  currentPeriodStartsAt: now,
                  currentPeriodEndsAt: this.addPeriod(now, current.billingInterval),
                  nextBillingAt: this.addPeriod(now, current.billingInterval),
                  cancelAtPeriodEnd: false,
                  version: { increment: 1 },
                }
              : {
                  status: "ACTIVE",
                  suspendedAt: null,
                  endedAt: null,
                  canceledAt: null,
                  cancelAtPeriodEnd: false,
                  nextBillingAt:
                    current.currentPeriodEndsAt ?? this.addPeriod(now, current.billingInterval),
                  version: { increment: 1 },
                };
      const updated = await transaction.subscription.update({
        where: { id_tenantId: { id: current.id, tenantId } },
        data,
        include: subscriptionInclude,
      });
      await transaction.subscriptionChange.create({
        data: {
          tenantId,
          subscriptionId: current.id,
          idempotencyKey: input.idempotencyKey,
          type: map[action],
          fromPlanId: current.planId,
          toPlanId: current.planId,
          reason: input.reason ?? null,
          metadata: { atPeriodEnd: input.atPeriodEnd },
        },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: `subscription.${action}`,
        eventType: `subscriptions.subscription.${action}.v1`,
        entityType: "subscription",
        entityId: current.id,
        payload: { status: updated.status, reason: input.reason, atPeriodEnd: input.atPeriodEnd },
      });
      return updated;
    });
  }

  changePlan(input: ChangePlanDto) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const duplicate = await transaction.subscriptionChange.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
        include: { subscription: { include: subscriptionInclude } },
      });
      if (duplicate) return duplicate.subscription;
      const current = await this.current(transaction, tenantId);
      if (!current) throw new NotFoundException("Current subscription not found");
      const nextPlan = await transaction.plan.findFirst({
        where: { id: input.planId, status: "ACTIVE" },
      });
      if (!nextPlan) throw new NotFoundException("Active destination plan not found");
      if (nextPlan.id === current.planId) throw new ConflictException("Plan is already active");
      const currentPrice =
        current.billingInterval === BillingInterval.ANNUAL
          ? current.plan.annualPriceMinor
          : current.plan.monthlyPriceMinor;
      const nextPrice =
        current.billingInterval === BillingInterval.ANNUAL
          ? nextPlan.annualPriceMinor
          : nextPlan.monthlyPriceMinor;
      const type =
        nextPrice >= currentPrice
          ? SubscriptionChangeType.UPGRADED
          : SubscriptionChangeType.DOWNGRADED;
      const updated = await transaction.subscription.update({
        where: { id_tenantId: { id: current.id, tenantId } },
        data: { planId: nextPlan.id, version: { increment: 1 } },
        include: subscriptionInclude,
      });
      await transaction.subscriptionChange.create({
        data: {
          tenantId,
          subscriptionId: current.id,
          idempotencyKey: input.idempotencyKey,
          type,
          fromPlanId: current.planId,
          toPlanId: nextPlan.id,
          reason: input.reason ?? null,
        },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action:
          type === SubscriptionChangeType.UPGRADED
            ? "subscription.upgrade"
            : "subscription.downgrade",
        eventType:
          type === SubscriptionChangeType.UPGRADED
            ? "subscriptions.subscription.upgraded.v1"
            : "subscriptions.subscription.downgraded.v1",
        entityType: "subscription",
        entityId: current.id,
        payload: { fromPlanId: current.planId, toPlanId: nextPlan.id },
      });
      return updated;
    });
  }

  createCheckout(input: CheckoutDto, checkoutToken: string) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const duplicate = await transaction.paymentIntent.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (duplicate) return duplicate;
      const subscription = await transaction.subscription.findUnique({
        where: { id_tenantId: { id: input.subscriptionId, tenantId } },
        include: { plan: true },
      });
      if (!subscription) throw new NotFoundException("Subscription not found");
      if (subscription.status === "CANCELED" || subscription.status === "EXPIRED") {
        throw new ConflictException("Canceled or expired subscriptions cannot be charged");
      }
      const amountMinor =
        subscription.billingInterval === "ANNUAL"
          ? subscription.plan.annualPriceMinor
          : subscription.plan.monthlyPriceMinor;
      const intent = await transaction.paymentIntent.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          idempotencyKey: input.idempotencyKey,
          checkoutTokenHash: this.digest(checkoutToken),
          amountMinor,
          currency: subscription.plan.currency,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: "billing.checkout.create",
        eventType: "billing.checkout.created.v1",
        entityType: "payment_intent",
        entityId: intent.id,
        payload: { amountMinor, currency: intent.currency, provider: intent.provider },
      });
      return intent;
    });
  }

  confirmCheckout(
    input: CheckoutConfirmationDto,
    transactionKey: string,
    tenantId = this.context.tenantId(),
  ) {
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const duplicate = await transaction.paymentTransaction.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: transactionKey } },
        include: { invoice: true, paymentIntent: true },
      });
      if (duplicate) return duplicate;
      const intent = await transaction.paymentIntent.findFirst({
        where: { tenantId, checkoutTokenHash: this.digest(input.checkoutToken) },
        include: { subscription: { include: { plan: true } } },
      });
      if (!intent) throw new NotFoundException("Sandbox checkout not found");
      if (intent.expiresAt < new Date()) throw new ConflictException("Sandbox checkout expired");
      if (intent.status !== PaymentStatus.PENDING) {
        throw new ConflictException("Sandbox checkout has already been processed");
      }
      const succeeded = input.outcome === "SUCCEEDED";
      const now = new Date();
      const feeMinor = succeeded
        ? Math.round(
            (intent.amountMinor * intent.subscription.plan.transactionFeeBasisPoints) / 10_000,
          )
        : 0;
      const periodEnd = this.addPeriod(now, intent.subscription.billingInterval);
      const invoice = await transaction.invoice.create({
        data: {
          tenantId,
          subscriptionId: intent.subscriptionId,
          number: `INV-${now.getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`,
          status: succeeded ? InvoiceStatus.PAID : InvoiceStatus.UNCOLLECTIBLE,
          currency: intent.currency,
          subtotalMinor: intent.amountMinor,
          feeMinor,
          totalMinor: intent.amountMinor + feeMinor,
          lineItems: [
            {
              type: "subscription",
              plan: intent.subscription.plan.code,
              amountMinor: intent.amountMinor,
            },
            { type: "transaction_fee", amountMinor: feeMinor },
          ],
          periodStart: now,
          periodEnd,
          dueAt: now,
          paidAt: succeeded ? now : null,
        },
      });
      const payment = await transaction.paymentTransaction.create({
        data: {
          tenantId,
          subscriptionId: intent.subscriptionId,
          paymentIntentId: intent.id,
          invoiceId: invoice.id,
          idempotencyKey: transactionKey,
          status: succeeded ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
          amountMinor: intent.amountMinor,
          feeMinor,
          currency: intent.currency,
          providerRef: `pfe_${randomBytes(8).toString("hex")}`,
          failureCode: succeeded ? null : (input.failureCode ?? "sandbox_card_declined"),
          failureMessage: succeeded ? null : "PFE sandbox simulated payment failure",
        },
        include: { invoice: true, paymentIntent: true },
      });
      await transaction.paymentIntent.update({
        where: { id_tenantId: { id: intent.id, tenantId } },
        data: {
          status: succeeded ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
          confirmedAt: now,
          failureCode: succeeded ? null : (input.failureCode ?? "sandbox_card_declined"),
        },
      });
      await transaction.subscription.update({
        where: { id_tenantId: { id: intent.subscriptionId, tenantId } },
        data: succeeded
          ? {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStartsAt: now,
              currentPeriodEndsAt: periodEnd,
              nextBillingAt: periodEnd,
              trialEndsAt: null,
              version: { increment: 1 },
            }
          : { status: SubscriptionStatus.PAST_DUE, version: { increment: 1 } },
      });
      if (succeeded && feeMinor > 0) {
        await transaction.usageRecord.create({
          data: {
            tenantId,
            subscriptionId: intent.subscriptionId,
            metricKey: "transaction_fee_minor",
            quantity: feeMinor,
            idempotencyKey: `fee:${transactionKey}`,
            referenceType: "payment_transaction",
            referenceId: payment.id,
          },
        });
      }
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: succeeded ? "billing.payment.succeeded" : "billing.payment.failed",
        eventType: succeeded ? "billing.payment.succeeded.v1" : "billing.payment.failed.v1",
        entityType: "payment_transaction",
        entityId: payment.id,
        payload: {
          invoiceId: invoice.id,
          amountMinor: payment.amountMinor,
          feeMinor,
          failureCode: payment.failureCode,
        },
      });
      return payment;
    });
  }

  processWebhook(input: SandboxWebhookDto, signatureHash: string) {
    const requestContext = this.context.current();
    return this.transactions.run(input.tenantId, async (transaction) => {
      const duplicate = await transaction.billingWebhook.findUnique({
        where: { tenantId_eventId: { tenantId: input.tenantId, eventId: input.eventId } },
      });
      if (duplicate) return duplicate;
      const intent = await transaction.paymentIntent.findUnique({
        where: { id_tenantId: { id: input.paymentIntentId, tenantId: input.tenantId } },
      });
      if (!intent) throw new NotFoundException("Webhook payment intent not found");
      return transaction.billingWebhook
        .create({
          data: {
            tenantId: input.tenantId,
            eventId: input.eventId,
            eventType:
              input.outcome === "SUCCEEDED" ? "payment_intent.succeeded" : "payment_intent.failed",
            signatureHash,
            payload: input as Prisma.InputJsonValue,
            status: "PROCESSED",
            processedAt: new Date(),
          },
        })
        .then(async (webhook) => {
          await appendDomainChange(transaction, input.tenantId, requestContext, {
            action: "billing.webhook.process",
            eventType: "billing.webhook.processed.v1",
            entityType: "billing_webhook",
            entityId: webhook.id,
            payload: { eventId: input.eventId, paymentIntentId: input.paymentIntentId },
          });
          return webhook;
        });
    });
  }

  getPaymentIntent(tenantId: string, id: string) {
    return this.transactions.run(tenantId, async (transaction) => {
      const intent = await transaction.paymentIntent.findUnique({
        where: { id_tenantId: { id, tenantId } },
      });
      if (!intent) throw new NotFoundException("Webhook payment intent not found");
      return intent;
    });
  }

  async recordUsage(input: UsageDto) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const duplicate = await transaction.usageRecord.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (duplicate) return duplicate;
      const subscription =
        (input.subscriptionId
          ? await transaction.subscription.findUnique({
              where: { id_tenantId: { id: input.subscriptionId, tenantId } },
              include: { plan: { include: { quotaLimits: true } } },
            })
          : await this.current(transaction, tenantId)) ?? null;
      if (!subscription) throw new NotFoundException("Current subscription not found");
      const [override, aggregate] = await Promise.all([
        transaction.tenantQuotaOverride.findUnique({
          where: { tenantId_metricKey: { tenantId, metricKey: input.metricKey } },
        }),
        transaction.usageRecord.aggregate({
          where: {
            tenantId,
            metricKey: input.metricKey,
            occurredAt: { gte: this.monthStart(new Date()) },
          },
          _sum: { quantity: true },
        }),
      ]);
      const planLimit = subscription.plan.quotaLimits.find(
        (limit) => limit.metricKey === input.metricKey,
      );
      const limit =
        override && (!override.expiresAt || override.expiresAt > new Date())
          ? override.limitValue
          : planLimit?.limitValue;
      const projected = (aggregate._sum.quantity ?? 0) + input.quantity;
      if (limit !== undefined && projected > limit) {
        throw new ConflictException(`Quota exceeded for ${input.metricKey}: ${projected}/${limit}`);
      }
      const record = await transaction.usageRecord.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          metricKey: input.metricKey,
          quantity: input.quantity,
          idempotencyKey: input.idempotencyKey,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: "usage.record",
        eventType: "billing.usage.recorded.v1",
        entityType: "usage_record",
        entityId: record.id,
        payload: { metricKey: input.metricKey, quantity: input.quantity, projected, limit },
      });
      return { ...record, usage: projected, limit: limit ?? null };
    });
  }

  setQuotaOverride(input: QuotaOverrideDto) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const override = await transaction.tenantQuotaOverride.upsert({
        where: { tenantId_metricKey: { tenantId, metricKey: input.metricKey } },
        update: {
          limitValue: input.limitValue,
          reason: input.reason,
          expiresAt: input.expiresAt ?? null,
        },
        create: { tenantId, ...input, expiresAt: input.expiresAt ?? null },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: "quota.override",
        eventType: "billing.quota.override.updated.v1",
        entityType: "tenant_quota_override",
        entityId: override.id,
        payload: { metricKey: input.metricKey, limitValue: input.limitValue },
      });
      return override;
    });
  }

  overview() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await this.current(transaction, tenantId);
      const monthStart = this.monthStart(new Date());
      const [usage, quotaOverrides, invoices, payments, changes] = await Promise.all([
        transaction.usageRecord.groupBy({
          by: ["metricKey"],
          where: { tenantId, occurredAt: { gte: monthStart } },
          _sum: { quantity: true },
        }),
        transaction.tenantQuotaOverride.findMany({
          where: { tenantId },
          orderBy: { metricKey: "asc" },
        }),
        transaction.invoice.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        transaction.paymentTransaction.findMany({
          where: { tenantId },
          include: { invoice: true },
          orderBy: { processedAt: "desc" },
          take: 50,
        }),
        transaction.subscriptionChange.findMany({
          where: { tenantId },
          orderBy: { effectiveAt: "desc" },
          take: 30,
        }),
      ]);
      const limits = new Map(
        current?.plan.quotaLimits.map((limit) => [limit.metricKey, limit.limitValue]) ?? [],
      );
      for (const override of quotaOverrides) {
        if (!override.expiresAt || override.expiresAt > new Date()) {
          limits.set(override.metricKey, override.limitValue);
        }
      }
      return {
        current,
        entitlements:
          current?.plan.featureEntitlements.map((feature) => ({
            key: feature.featureKey,
            enabled: feature.enabled,
            configuration: feature.configuration,
          })) ?? [],
        usage: usage.map((item) => ({
          metricKey: item.metricKey,
          used: item._sum.quantity ?? 0,
          limit: limits.get(item.metricKey) ?? null,
        })),
        quotaOverrides,
        invoices,
        payments,
        changes,
      };
    });
  }

  invoices() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.invoice.findMany({
        where: { tenantId },
        include: { payments: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  payments() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.paymentTransaction.findMany({
        where: { tenantId },
        include: { invoice: true },
        orderBy: { processedAt: "desc" },
      }),
    );
  }

  branding() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const [profile, localization, domains] = await Promise.all([
        transaction.whiteLabelProfile.findUnique({ where: { tenantId } }),
        transaction.tenantLocalization.findUnique({ where: { tenantId } }),
        transaction.customDomain.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
      ]);
      return { profile, localization, domains };
    });
  }

  updateBranding(input: WhiteLabelDto) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const profile = await transaction.whiteLabelProfile.upsert({
        where: { tenantId },
        update: {
          ...input,
          logoUrl: input.logoUrl ?? null,
          faviconUrl: input.faviconUrl ?? null,
          emailReplyTo: input.emailReplyTo ?? null,
          emailFooter: input.emailFooter ?? null,
        },
        create: {
          tenantId,
          ...input,
          logoUrl: input.logoUrl ?? null,
          faviconUrl: input.faviconUrl ?? null,
          emailReplyTo: input.emailReplyTo ?? null,
          emailFooter: input.emailFooter ?? null,
        },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: "branding.update",
        eventType: "tenancy.branding.updated.v1",
        entityType: "white_label_profile",
        entityId: profile.id,
        payload: { productName: profile.productName, themeMode: profile.themeMode },
      });
      return profile;
    });
  }

  updateLocalization(input: LocalizationDto) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const data = {
        defaultLanguage: input.defaultLanguage,
        enabledLanguages: input.enabledLanguages,
        countries: input.countries.map((value) => value.toUpperCase()),
        currencies: input.currencies.map((value) => value.toUpperCase()),
        timezones: input.timezones,
        dateFormat: input.dateFormat,
        timeFormat: input.timeFormat,
        numberLocale: input.numberLocale,
        direction: input.direction,
      };
      const localization = await transaction.tenantLocalization.upsert({
        where: { tenantId },
        update: data,
        create: { tenantId, ...data },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: "localization.update",
        eventType: "tenancy.localization.updated.v1",
        entityType: "tenant_localization",
        entityId: localization.id,
        payload: { defaultLanguage: input.defaultLanguage, direction: input.direction },
      });
      return localization;
    });
  }

  addDomain(input: CustomDomainDto) {
    const tenantId = this.context.tenantId();
    const requestContext = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const domain = await transaction.customDomain.create({
        data: {
          tenantId,
          hostname: input.hostname,
          verificationToken: randomBytes(18).toString("base64url"),
        },
      });
      await appendDomainChange(transaction, tenantId, requestContext, {
        action: "custom_domain.create",
        eventType: "tenancy.custom-domain.created.v1",
        entityType: "custom_domain",
        entityId: domain.id,
        payload: { hostname: domain.hostname },
      });
      return domain;
    });
  }

  listCurrent() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.subscription.findMany({
        where: { tenantId },
        include: subscriptionInclude,
        orderBy: { startsAt: "desc" },
      }),
    );
  }

  hasEntitlement(featureKey: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await this.current(transaction, tenantId);
      if (
        !current ||
        current.status === SubscriptionStatus.CANCELED ||
        current.status === SubscriptionStatus.EXPIRED ||
        current.status === SubscriptionStatus.PAUSED
      ) {
        return false;
      }
      return current.plan.featureEntitlements.some(
        (feature) => feature.featureKey === featureKey && feature.enabled,
      );
    });
  }

  private current(transaction: TenantTransaction, tenantId: string) {
    return transaction.subscription.findFirst({
      where: { tenantId },
      include: subscriptionInclude,
      orderBy: { startsAt: "desc" },
    });
  }

  private addDays(value: Date, days: number): Date {
    return new Date(value.getTime() + days * 86_400_000);
  }

  private addPeriod(value: Date, interval: BillingInterval): Date {
    const next = new Date(value);
    if (interval === BillingInterval.ANNUAL) next.setUTCFullYear(next.getUTCFullYear() + 1);
    else next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }

  private monthStart(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }

  private digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
