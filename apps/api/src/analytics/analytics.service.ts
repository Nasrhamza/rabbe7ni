import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { AiRequestStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";
import { createHash } from "node:crypto";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { parseDto } from "../common/validation.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { AnalyticsGateway } from "./analytics.gateway.js";
import { analyticsRangeSchema, insightSchema } from "./dto.js";

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(AnalyticsGateway) private readonly gateway: AnalyticsGateway,
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  async dashboard(input: never) {
    const dto = parseDto(analyticsRangeSchema, input);
    await this.assertScope(dto);
    return this.gateway.metrics(this.context.tenantId(), dto);
  }

  quality() {
    return this.gateway.quality(this.context.tenantId());
  }

  async customerSummary() {
    const range = await this.customerRange();
    return this.gateway.metrics(this.context.tenantId(), range);
  }

  async customerRecommendation() {
    const range = await this.customerRange();
    return this.insight({
      ...range,
      capability: "REWARD_RECOMMENDATION",
      idempotencyKey: `customer-reward:${range.customerId}:${range.to.toISOString().slice(0, 10)}`,
      context: { audience: "customer", timezone: range.timezone },
    } as never);
  }

  async refresh(input: never) {
    const dto = parseDto(analyticsRangeSchema, input);
    await this.assertScope(dto);
    return this.gateway.backfill(this.context.tenantId(), dto);
  }

  async insight(input: never) {
    const dto = parseDto(insightSchema, input);
    await this.assertScope(dto);
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    const existing = await this.transactions.run(tenantId, (transaction) =>
      transaction.aiInsightRequest.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: dto.idempotencyKey } },
      }),
    );
    if (
      existing?.status === AiRequestStatus.COMPLETED ||
      existing?.status === AiRequestStatus.FALLBACK
    ) {
      return existing.output;
    }
    const dashboard = await this.gateway.metrics(tenantId, dto);
    const metrics = Object.fromEntries(dashboard.items.map(({ metric, value }) => [metric, value]));
    const digest = createHash("sha256").update(JSON.stringify(metrics)).digest("hex");
    const record = await this.transactions.run(tenantId, (transaction) =>
      transaction.aiInsightRequest.upsert({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: dto.idempotencyKey } },
        update: { status: AiRequestStatus.PROCESSING },
        create: {
          tenantId,
          capability: dto.capability,
          idempotencyKey: dto.idempotencyKey,
          inputDigest: digest,
          modelVersion: "pending",
          promptVersion: "pending",
          provider: "pending",
          redactedInput: { metrics, context: dto.context } as Prisma.InputJsonValue,
          ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
          ...(request.actorId ? { requestedById: request.actorId } : {}),
        },
      }),
    );
    try {
      const insight = await this.gateway.insight(tenantId, {
        capability: dto.capability,
        metrics,
        context: dto.context,
      });
      await this.transactions.run(tenantId, async (transaction) => {
        await transaction.aiInsightRequest.update({
          where: { id: record.id },
          data: {
            status: insight.fallback ? AiRequestStatus.FALLBACK : AiRequestStatus.COMPLETED,
            modelVersion: insight.modelVersion,
            promptVersion: insight.promptVersion,
            provider: insight.provider,
            confidence: insight.confidence,
            fallback: insight.fallback,
            output: insight as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        await appendDomainChange(transaction, tenantId, request, {
          action: "ai.insight.request",
          eventType: "analytics.ai-insight.completed.v1",
          entityType: "ai_insight_request",
          entityId: record.id,
          payload: {
            capability: dto.capability,
            confidence: insight.confidence,
            fallback: insight.fallback,
          },
        });
      });
      return insight;
    } catch (error) {
      await this.transactions.run(tenantId, (transaction) =>
        transaction.aiInsightRequest.update({
          where: { id: record.id },
          data: {
            status: AiRequestStatus.FAILED,
            failureReason: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
          },
        }),
      );
      throw error;
    }
  }

  private async customerRange() {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const customer = await this.transactions.run(tenantId, (transaction) =>
      transaction.customer.findFirst({
        where: { userId: principal.userId },
        select: { id: true },
      }),
    );
    if (!customer) throw new Error("Authenticated customer profile not found");
    const to = new Date();
    return {
      from: new Date(to.getTime() - 90 * 86_400_000),
      to,
      timezone: "UTC",
      customerId: customer.id,
    };
  }

  private async assertScope(scope: {
    organizationId?: string | undefined;
    franchiseId?: string | undefined;
    merchantId?: string | undefined;
    branchId?: string | undefined;
    customerId?: string | undefined;
  }) {
    const principal = this.context.authenticatedPrincipal();
    if (principal.access.tenantWide) return;
    if (scope.organizationId && !principal.access.organizationIds.includes(scope.organizationId)) {
      throw new ForbiddenException("Organization analytics scope denied");
    }
    if (scope.franchiseId && !principal.access.franchiseIds.includes(scope.franchiseId)) {
      throw new ForbiddenException("Franchise analytics scope denied");
    }
    if (scope.merchantId && !principal.access.merchantIds.includes(scope.merchantId)) {
      throw new ForbiddenException("Merchant analytics scope denied");
    }
    if (scope.branchId && !principal.access.branchIds.includes(scope.branchId)) {
      throw new ForbiddenException("Branch analytics scope denied");
    }
    if (scope.customerId) {
      const tenantId = this.context.tenantId();
      const customerId = scope.customerId;
      const customer = await this.transactions.run(tenantId, (transaction) =>
        transaction.customer.findUnique({
          where: { id: customerId },
          select: { organizationId: true },
        }),
      );
      if (!customer || !principal.access.organizationIds.includes(customer.organizationId)) {
        throw new ForbiddenException("Customer analytics scope denied");
      }
    }
  }
}
