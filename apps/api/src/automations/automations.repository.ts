import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AutomationExecutionStatus, AutomationStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { AutomationCreate, AutomationUpdate, MarketingDomainEvent } from "./dto.js";

@Injectable()
export class AutomationsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  list(input: {
    page: number;
    pageSize: number;
    search?: string | undefined;
    status?: AutomationStatus | undefined;
    type?: "EVENT_TRIGGERED" | "SCHEDULED" | undefined;
    triggerType?: string | undefined;
    sortDirection: "asc" | "desc";
  }) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.triggerType ? { triggerType: input.triggerType } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { code: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.automationWorkflow.findMany({
          where,
          ...pageWindow(input),
          orderBy: { createdAt: input.sortDirection },
          include: {
            steps: { orderBy: { position: "asc" } },
            _count: { select: { executions: true } },
          },
        }),
        transaction.automationWorkflow.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  get(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const workflow = await transaction.automationWorkflow.findUnique({
        where: { id },
        include: {
          steps: { orderBy: { position: "asc" } },
          executions: {
            orderBy: { startedAt: "desc" },
            take: 100,
            include: { stepExecutions: { orderBy: { startedAt: "asc" } } },
          },
        },
      });
      return workflow && this.context.canAccessOrganization(workflow.organizationId)
        ? workflow
        : null;
    });
  }

  create(input: AutomationCreate) {
    this.assertOrganization(input.organizationId);
    this.assertTimezone(input.timezone);
    this.assertUniquePositions(input.steps);
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const created = await transaction.automationWorkflow.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          type: input.type,
          status: input.status,
          triggerType: input.triggerType,
          triggerConfig: input.triggerConfig as Prisma.InputJsonValue,
          timezone: input.timezone,
          exitConditions: input.exitConditions as Prisma.InputJsonValue,
          maxExecutionsPerCustomer: input.maxExecutionsPerCustomer,
          ...(input.description ? { description: input.description } : {}),
          ...(input.schedule ? { schedule: input.schedule } : {}),
        } as Prisma.AutomationWorkflowUncheckedCreateInput,
      });
      await transaction.automationStep.createMany({
        data: input.steps.map((step) => ({
          tenantId,
          workflowId: created.id,
          code: step.code,
          name: step.name,
          position: step.position,
          type: step.type,
          delaySeconds: step.delaySeconds,
          configuration: step.configuration as Prisma.InputJsonValue,
          ...(step.nextOnTrue ? { nextOnTrue: step.nextOnTrue } : {}),
          ...(step.nextOnFalse ? { nextOnFalse: step.nextOnFalse } : {}),
        })),
      });
      const workflow = await transaction.automationWorkflow.findUniqueOrThrow({
        where: { id: created.id },
        include: { steps: { orderBy: { position: "asc" } } },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "automation.create",
        eventType: "marketing.automation.created.v1",
        entityType: "automation_workflow",
        entityId: workflow.id,
        payload: { type: workflow.type, triggerType: workflow.triggerType },
      });
      return workflow;
    });
  }

  update(id: string, input: AutomationUpdate) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.automationWorkflow.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      if (current.status !== AutomationStatus.DRAFT) {
        throw new BadRequestException("Only draft automation workflows can be edited");
      }
      if (input.organizationId) this.assertOrganization(input.organizationId);
      if (input.timezone) this.assertTimezone(input.timezone);
      if (input.steps) this.assertUniquePositions(input.steps);
      const { steps, triggerConfig, exitConditions, ...scalar } = input;
      await transaction.automationWorkflow.update({
        where: { id },
        data: {
          ...scalar,
          ...(triggerConfig ? { triggerConfig: triggerConfig as Prisma.InputJsonValue } : {}),
          ...(exitConditions ? { exitConditions: exitConditions as Prisma.InputJsonValue } : {}),
        } as Prisma.AutomationWorkflowUncheckedUpdateInput,
      });
      if (steps) {
        await transaction.automationStep.deleteMany({ where: { workflowId: id } });
        await transaction.automationStep.createMany({
          data: steps.map((step) => ({
            tenantId,
            workflowId: id,
            code: step.code,
            name: step.name,
            position: step.position,
            type: step.type,
            delaySeconds: step.delaySeconds,
            configuration: step.configuration as Prisma.InputJsonValue,
            ...(step.nextOnTrue ? { nextOnTrue: step.nextOnTrue } : {}),
            ...(step.nextOnFalse ? { nextOnFalse: step.nextOnFalse } : {}),
          })),
        });
      }
      const workflow = await transaction.automationWorkflow.findUniqueOrThrow({
        where: { id },
        include: { steps: { orderBy: { position: "asc" } } },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "automation.update",
        eventType: "marketing.automation.updated.v1",
        entityType: "automation_workflow",
        entityId: id,
        payload: { type: workflow.type, triggerType: workflow.triggerType },
      });
      return workflow;
    });
  }

  changeStatus(id: string, status: AutomationStatus) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.automationWorkflow.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      if (current.status === AutomationStatus.ARCHIVED) {
        throw new BadRequestException("Archived automation cannot change status");
      }
      const workflow = await transaction.automationWorkflow.update({
        where: { id },
        data: { status },
      });
      if (status === AutomationStatus.CANCELLED) {
        await transaction.automationExecution.updateMany({
          where: {
            workflowId: id,
            status: {
              in: [AutomationExecutionStatus.RUNNING, AutomationExecutionStatus.WAITING],
            },
          },
          data: { status: AutomationExecutionStatus.CANCELLED, completedAt: new Date() },
        });
      }
      await appendDomainChange(transaction, tenantId, request, {
        action: `automation.${status.toLowerCase()}`,
        eventType: "marketing.automation.status-changed.v1",
        entityType: "automation_workflow",
        entityId: id,
        payload: { from: current.status, to: status },
      });
      return workflow;
    });
  }

  beginForEvent(event: MarketingDomainEvent) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const workflows = await transaction.automationWorkflow.findMany({
        where: {
          organizationId: event.organizationId,
          triggerType: event.eventType,
          status: AutomationStatus.ACTIVE,
        },
        include: { steps: { orderBy: { position: "asc" }, take: 1 } },
      });
      const executions = [];
      for (const workflow of workflows) {
        const count = await transaction.automationExecution.count({
          where: { workflowId: workflow.id, customerId: event.customerId },
        });
        if (count >= workflow.maxExecutionsPerCustomer) continue;
        const idempotencyKey = `${event.eventId}:${workflow.id}:${event.customerId}`;
        const execution = await transaction.automationExecution.upsert({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
          update: {},
          create: {
            tenantId,
            workflowId: workflow.id,
            customerId: event.customerId,
            eventId: event.eventId,
            idempotencyKey,
            currentStepId: workflow.steps[0]?.id ?? null,
            context: {
              ...event.payload,
              eventId: event.eventId,
              eventType: event.eventType,
              customerId: event.customerId,
              organizationId: event.organizationId,
              occurredAt: event.occurredAt.toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
        executions.push(execution);
      }
      return executions;
    });
  }

  beginScheduled(workflowId: string, occurrence: Date) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:scheduled-automation:${workflowId}:${occurrence.toISOString()}`}))`;
      const workflow = await transaction.automationWorkflow.findUnique({
        where: { id: workflowId },
        include: { steps: { orderBy: { position: "asc" }, take: 1 } },
      });
      if (
        !workflow ||
        workflow.status !== AutomationStatus.ACTIVE ||
        workflow.type !== "SCHEDULED"
      ) {
        return [];
      }
      const trigger = this.jsonRecord(workflow.triggerConfig);
      const configuredCustomerIds = Array.isArray(trigger.customerIds)
        ? trigger.customerIds.filter((value): value is string => typeof value === "string")
        : [];
      const segmentId = typeof trigger.segmentId === "string" ? trigger.segmentId : undefined;
      const customers = await transaction.customer.findMany({
        where: {
          organizationId: workflow.organizationId,
          status: "ACTIVE",
          ...(configuredCustomerIds.length > 0 ? { id: { in: configuredCustomerIds } } : {}),
          ...(segmentId ? { segmentMemberships: { some: { segmentId } } } : {}),
        },
        select: { id: true, birthDate: true, createdAt: true },
      });
      const eligible = customers.filter((customer) =>
        this.scheduledTriggerMatches(
          workflow.triggerType,
          trigger,
          customer,
          occurrence,
          workflow.timezone,
        ),
      );
      const bucket = occurrence.toISOString();
      const executions = [];
      for (const customer of eligible) {
        const count = await transaction.automationExecution.count({
          where: { workflowId, customerId: customer.id },
        });
        if (count >= workflow.maxExecutionsPerCustomer) continue;
        const idempotencyKey = `schedule:${workflowId}:${bucket}:${customer.id}`;
        executions.push(
          await transaction.automationExecution.upsert({
            where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            update: {},
            create: {
              tenantId,
              workflowId,
              customerId: customer.id,
              eventId: `schedule:${bucket}`,
              idempotencyKey,
              currentStepId: workflow.steps[0]?.id ?? null,
              context: {
                eventId: `schedule:${bucket}`,
                eventType: workflow.triggerType,
                customerId: customer.id,
                organizationId: workflow.organizationId,
                occurredAt: bucket,
                scheduled: true,
              },
            },
          }),
        );
      }
      return executions;
    });
  }

  loadExecution(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.automationExecution.findUnique({
        where: { id },
        include: {
          workflow: { include: { steps: { orderBy: { position: "asc" } } } },
          customer: true,
        },
      }),
    );
  }

  startStep(executionId: string, stepId: string, idempotencyKey: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:automation-step:${idempotencyKey}`}))`;
      return transaction.automationStepExecution.upsert({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        update: {},
        create: { tenantId, executionId, stepId, idempotencyKey },
      });
    });
  }

  finishStep(
    executionId: string,
    stepExecutionId: string,
    nextStepId: string | null,
    output: Readonly<Record<string, unknown>>,
  ) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const stepRun = await transaction.automationStepExecution.update({
        where: { id: stepExecutionId },
        data: {
          status: AutomationExecutionStatus.COMPLETED,
          completedAt: new Date(),
          output: output as Prisma.InputJsonValue,
        },
      });
      const execution = await transaction.automationExecution.update({
        where: { id: executionId },
        data: nextStepId
          ? { currentStepId: nextStepId, status: AutomationExecutionStatus.RUNNING }
          : {
              currentStepId: null,
              status: AutomationExecutionStatus.COMPLETED,
              completedAt: new Date(),
            },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "automation.step.execute",
        eventType: "marketing.automation.step-executed.v1",
        entityType: "automation_execution",
        entityId: executionId,
        payload: { stepId: stepRun.stepId, completed: !nextStepId },
      });
      return execution;
    });
  }

  wait(executionId: string, stepExecutionId: string, nextRunAt: Date) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.automationStepExecution.update({
        where: { id: stepExecutionId },
        data: {
          status: AutomationExecutionStatus.WAITING,
          completedAt: new Date(),
          output: { nextRunAt: nextRunAt.toISOString() },
        },
      });
      return transaction.automationExecution.update({
        where: { id: executionId },
        data: { status: AutomationExecutionStatus.WAITING, nextRunAt },
      });
    });
  }

  fail(executionId: string, reason: string, deadLetter: boolean) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.automationExecution.update({
        where: { id: executionId },
        data: {
          status: deadLetter
            ? AutomationExecutionStatus.DEAD_LETTER
            : AutomationExecutionStatus.FAILED,
          failureReason: reason,
          attempts: { increment: 1 },
          ...(deadLetter ? { completedAt: new Date() } : {}),
        },
      }),
    );
  }

  private assertOrganization(organizationId: string): void {
    if (!this.context.canAccessOrganization(organizationId)) {
      throw new NotFoundException("Organization not found or outside scope");
    }
  }

  private assertTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException("Invalid IANA timezone");
    }
  }

  private assertUniquePositions(steps: readonly { position: number; code: string }[]): void {
    if (new Set(steps.map(({ position }) => position)).size !== steps.length) {
      throw new BadRequestException("Automation step positions must be unique");
    }
    if (new Set(steps.map(({ code }) => code)).size !== steps.length) {
      throw new BadRequestException("Automation step codes must be unique");
    }
  }

  private jsonRecord(value: Prisma.JsonValue): Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Readonly<Record<string, unknown>>)
      : {};
  }

  private scheduledTriggerMatches(
    triggerType: string,
    trigger: Readonly<Record<string, unknown>>,
    customer: { birthDate: Date | null; createdAt: Date },
    occurrence: Date,
    timezone: string,
  ): boolean {
    if (
      !["birthday", "customer.birthday", "anniversary", "customer.anniversary"].includes(
        triggerType,
      )
    ) {
      return true;
    }
    const target = triggerType.includes("birthday") ? customer.birthDate : customer.createdAt;
    if (!target) return false;
    const format = (date: Date) =>
      new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    return format(target) === format(occurrence);
  }
}
