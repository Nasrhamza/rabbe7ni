import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  AutomationExecutionStatus,
  AutomationStatus,
  AutomationStepType,
} from "@rabbehni/database";

import { BadgesService } from "../badges/badges.service.js";
import { GamificationService } from "../gamification/gamification.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PointsService } from "../points/points.service.js";
import { evaluateSegmentRule, type SegmentRuleGroup } from "../segments/rule-engine.js";
import { AutomationsRepository } from "./automations.repository.js";

@Injectable()
export class AutomationRunner {
  constructor(
    @Inject(AutomationsRepository) private readonly automations: AutomationsRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(PointsService) private readonly points: PointsService,
    @Inject(GamificationService) private readonly gamification: GamificationService,
    @Inject(BadgesService) private readonly badges: BadgesService,
  ) {}

  async run(executionId: string): Promise<{ waitUntil?: Date; completed: boolean }> {
    const execution = await this.automations.loadExecution(executionId);
    if (!execution) throw new BadRequestException("Automation execution not found");
    if (
      execution.status === AutomationExecutionStatus.COMPLETED ||
      execution.status === AutomationExecutionStatus.CANCELLED
    ) {
      return { completed: true };
    }
    if (execution.workflow.status === AutomationStatus.PAUSED) {
      return { waitUntil: new Date(Date.now() + 60_000), completed: false };
    }
    const step = execution.workflow.steps.find(({ id }) => id === execution.currentStepId);
    if (!step) {
      return { completed: true };
    }
    const idempotencyKey = `${execution.id}:${step.id}`;
    const stepRun = await this.automations.startStep(execution.id, step.id, idempotencyKey);
    if (stepRun.status === AutomationExecutionStatus.COMPLETED) {
      const next = this.nextStep(execution.workflow.steps, step.position);
      await this.automations.finishStep(execution.id, stepRun.id, next?.id ?? null, {
        replay: true,
      });
      return { completed: !next };
    }
    if (
      stepRun.status === AutomationExecutionStatus.WAITING &&
      execution.nextRunAt &&
      execution.nextRunAt <= new Date()
    ) {
      const next = this.nextStep(execution.workflow.steps, step.position);
      await this.automations.finishStep(execution.id, stepRun.id, next?.id ?? null, {
        resumedAt: new Date().toISOString(),
      });
      return { completed: !next };
    }
    const configuration = step.configuration as Readonly<Record<string, unknown>>;
    const exitConditions = execution.workflow.exitConditions as Readonly<Record<string, unknown>>;
    if (
      this.isRuleGroup(exitConditions) &&
      evaluateSegmentRule(
        exitConditions as unknown as SegmentRuleGroup,
        execution.context as Readonly<Record<string, unknown>>,
      )
    ) {
      await this.automations.finishStep(execution.id, stepRun.id, null, {
        exited: true,
        reason: "workflow-exit-condition",
      });
      return { completed: true };
    }
    if (step.type === AutomationStepType.WAIT) {
      const seconds =
        typeof configuration.seconds === "number" ? configuration.seconds : step.delaySeconds;
      const waitUntil = new Date(Date.now() + Math.max(0, seconds) * 1_000);
      await this.automations.wait(execution.id, stepRun.id, waitUntil);
      return { waitUntil, completed: false };
    }

    let conditionResult = true;
    if (step.type === AutomationStepType.CONDITION) {
      conditionResult = evaluateSegmentRule(
        configuration.rule as unknown as SegmentRuleGroup,
        execution.context as Readonly<Record<string, unknown>>,
      );
    } else if (step.type === AutomationStepType.NOTIFICATION) {
      const templateId = this.requiredString(configuration, "templateId");
      await this.notifications.queueDelivery({
        customerId: execution.customerId,
        templateId,
        automationExecutionId: execution.id,
        variables: {
          ...this.scalarVariables(execution.context),
          customerName: execution.customer.displayName,
        },
        idempotencyKey: `automation-notification:${idempotencyKey}`,
      } as never);
    } else if (step.type === AutomationStepType.REWARD) {
      await this.reward(configuration, execution.customerId, idempotencyKey);
    }

    const explicitNext =
      step.type === AutomationStepType.CONDITION
        ? conditionResult
          ? step.nextOnTrue
          : step.nextOnFalse
        : null;
    const next =
      step.type === AutomationStepType.EXIT
        ? null
        : ((explicitNext
            ? execution.workflow.steps.find(({ id }) => id === explicitNext)
            : this.nextStep(execution.workflow.steps, step.position)) ?? null);
    await this.automations.finishStep(execution.id, stepRun.id, next?.id ?? null, {
      conditionResult,
      type: step.type,
    });
    return { completed: !next };
  }

  private async reward(
    configuration: Readonly<Record<string, unknown>>,
    customerId: string,
    idempotencyKey: string,
  ): Promise<void> {
    const rewardType = this.requiredString(configuration, "rewardType");
    if (rewardType === "POINTS") {
      await this.points.earn({
        customerId,
        programId: this.requiredString(configuration, "programId"),
        points: this.requiredNumber(configuration, "amount"),
        idempotencyKey: `automation-points:${idempotencyKey}`,
        referenceType: "automation",
        referenceId: idempotencyKey,
        metadata: {},
      } as never);
      return;
    }
    if (rewardType === "XP") {
      await this.gamification.award({
        customerId,
        xp: this.requiredNumber(configuration, "amount"),
        idempotencyKey: `automation-xp:${idempotencyKey}`,
        referenceType: "automation",
        referenceId: idempotencyKey,
        metadata: {},
      } as never);
      return;
    }
    if (rewardType === "BADGE") {
      await this.badges.award({
        customerId,
        badgeId: this.requiredString(configuration, "badgeId"),
        idempotencyKey: `automation-badge:${idempotencyKey}`,
        metadata: {},
      } as never);
      return;
    }
    throw new BadRequestException("Unsupported automation reward type");
  }

  private nextStep<T extends { position: number }>(
    steps: readonly T[],
    position: number,
  ): T | null {
    return (
      [...steps]
        .filter((candidate) => candidate.position > position)
        .sort((left, right) => left.position - right.position)[0] ?? null
    );
  }

  private requiredString(configuration: Readonly<Record<string, unknown>>, key: string): string {
    const value = configuration[key];
    if (typeof value !== "string") throw new BadRequestException(`Automation ${key} is required`);
    return value;
  }

  private requiredNumber(configuration: Readonly<Record<string, unknown>>, key: string): number {
    const value = configuration[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new BadRequestException(`Automation ${key} is required`);
    }
    return value;
  }

  private scalarVariables(context: unknown): Readonly<Record<string, string | number | boolean>> {
    if (typeof context !== "object" || context === null) return {};
    return Object.fromEntries(
      Object.entries(context).filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1]),
      ),
    );
  }

  private isRuleGroup(value: Readonly<Record<string, unknown>>): boolean {
    return (
      (value.combinator === "AND" || value.combinator === "OR") &&
      Array.isArray(value.conditions) &&
      value.conditions.length > 0
    );
  }
}
