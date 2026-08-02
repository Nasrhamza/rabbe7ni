import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ReportExecutionStatus, ReportFrequency, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";
import { createHash } from "node:crypto";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";

@Injectable()
export class ReportsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  list() {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.reportDefinition.findMany({
        where: {
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          executions: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { artifact: { select: { id: true, fileName: true, expiresAt: true } } },
          },
        },
      }),
    );
  }

  create(input: {
    organizationId: string;
    recipientCustomerId?: string | undefined;
    notificationTemplateId?: string | undefined;
    code: string;
    name: string;
    frequency: ReportFrequency;
    timezone: string;
    filters: Readonly<Record<string, string | number | boolean>>;
    metrics: readonly string[];
    active: boolean;
    retentionDays: number;
  }) {
    if (!this.context.canAccessOrganization(input.organizationId)) {
      throw new NotFoundException("Organization not found or outside scope");
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format();
    } catch {
      throw new BadRequestException("Invalid IANA timezone");
    }
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (input.recipientCustomerId) {
        const count = await transaction.customer.count({
          where: { id: input.recipientCustomerId, organizationId: input.organizationId },
        });
        if (count !== 1) throw new BadRequestException("Report recipient is outside organization");
      }
      if (input.notificationTemplateId) {
        const count = await transaction.notificationTemplate.count({
          where: { id: input.notificationTemplateId, organizationId: input.organizationId },
        });
        if (count !== 1) throw new BadRequestException("Report template is outside organization");
      }
      const definition = await transaction.reportDefinition.create({
        data: {
          tenantId,
          ...input,
          filters: input.filters as Prisma.InputJsonValue,
          metrics: [...input.metrics],
          nextRunAt: this.nextRun(input.frequency),
        } as Prisma.ReportDefinitionUncheckedCreateInput,
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "report.definition.create",
        eventType: "analytics.report-definition.created.v1",
        entityType: "report_definition",
        entityId: definition.id,
        payload: { frequency: definition.frequency, timezone: definition.timezone },
      });
      return definition;
    });
  }

  getDefinition(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const definition = await transaction.reportDefinition.findUnique({ where: { id } });
      return definition && this.context.canAccessOrganization(definition.organizationId)
        ? definition
        : null;
    });
  }

  createExecution(definitionId: string, periodStart: Date, periodEnd: Date) {
    const tenantId = this.context.tenantId();
    const key = `${definitionId}:${periodStart.toISOString()}:${periodEnd.toISOString()}`;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.reportExecution.upsert({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
        update: {},
        create: {
          tenantId,
          definitionId,
          idempotencyKey: key,
          periodStart,
          periodEnd,
        },
      }),
    );
  }

  loadExecution(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.reportExecution.findUnique({
        where: { id },
        include: { definition: true, artifact: true },
      }),
    );
  }

  start(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.reportExecution.update({
        where: { id },
        data: {
          status: ReportExecutionStatus.PROCESSING,
          attempts: { increment: 1 },
          startedAt: new Date(),
        },
      }),
    );
  }

  complete(
    id: string,
    definition: { name: string; retentionDays: number },
    csv: Buffer,
    summary: Readonly<Record<string, unknown>>,
  ) {
    const tenantId = this.context.tenantId();
    const checksum = createHash("sha256").update(csv).digest("hex");
    return this.transactions.run(tenantId, async (transaction) => {
      const artifact = await transaction.reportArtifact.upsert({
        where: { executionId: id },
        update: {},
        create: {
          tenantId,
          executionId: id,
          fileName: `${definition.name.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase()}-${id}.csv`,
          mimeType: "text/csv; charset=utf-8",
          content: Uint8Array.from(csv),
          checksum,
          sizeBytes: csv.byteLength,
          expiresAt: new Date(Date.now() + definition.retentionDays * 86_400_000),
        },
      });
      await transaction.reportExecution.update({
        where: { id },
        data: {
          status: ReportExecutionStatus.COMPLETED,
          resultSummary: summary as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return artifact;
    });
  }

  fail(id: string, reason: string, deadLetter: boolean) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.reportExecution.update({
        where: { id },
        data: {
          status: deadLetter ? ReportExecutionStatus.DEAD_LETTER : ReportExecutionStatus.FAILED,
          failureReason: reason,
          completedAt: new Date(),
        },
      }),
    );
  }

  artifact(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.reportArtifact.findFirst({
        where: { id, expiresAt: { gt: new Date() } },
        include: { execution: { include: { definition: true } } },
      }),
    );
  }

  private nextRun(frequency: ReportFrequency): Date {
    const days =
      frequency === ReportFrequency.DAILY ? 1 : frequency === ReportFrequency.WEEKLY ? 7 : 30;
    return new Date(Date.now() + days * 86_400_000);
  }
}
