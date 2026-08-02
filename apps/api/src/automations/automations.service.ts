import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AutomationStatus, AutomationType } from "@rabbehni/database";

import { parseDto } from "../common/validation.js";
import {
  automationIdSchema,
  automationListSchema,
  consumeMarketingEventSchema,
  createAutomationSchema,
  updateAutomationSchema,
} from "./dto.js";
import { AutomationQueue } from "./automations.queue.js";
import { AutomationsRepository } from "./automations.repository.js";
import { AutomationScheduler } from "./automations.scheduler.js";

@Injectable()
export class AutomationsService {
  constructor(
    @Inject(AutomationsRepository) private readonly automations: AutomationsRepository,
    @Inject(AutomationQueue) private readonly queue: AutomationQueue,
    @Inject(AutomationScheduler) private readonly scheduler: AutomationScheduler,
  ) {}

  list(input: never = {} as never) {
    return this.automations.list(parseDto(automationListSchema, input));
  }
  async get(id: string) {
    const result = await this.automations.get(parseDto(automationIdSchema, id));
    if (!result) throw new NotFoundException("Automation not found or outside scope");
    return result;
  }
  async create(input: never) {
    const workflow = await this.automations.create(parseDto(createAutomationSchema, input));
    await this.syncSchedule(workflow);
    return workflow;
  }
  async update(id: string, input: never) {
    const result = await this.automations.update(
      parseDto(automationIdSchema, id),
      parseDto(updateAutomationSchema, input),
    );
    if (!result) throw new NotFoundException("Automation not found or outside scope");
    await this.syncSchedule(result);
    return result;
  }
  async status(id: string, status: AutomationStatus) {
    const result = await this.automations.changeStatus(parseDto(automationIdSchema, id), status);
    if (!result) throw new NotFoundException("Automation not found or outside scope");
    await this.syncSchedule(result);
    return result;
  }
  async consume(input: never) {
    const event = parseDto(consumeMarketingEventSchema, input);
    const executions = await this.automations.beginForEvent(event);
    await Promise.all(
      executions.map((execution) => this.queue.enqueue(execution.tenantId, execution.id)),
    );
    return { accepted: true, executions: executions.length };
  }

  private async syncSchedule(workflow: {
    id: string;
    tenantId: string;
    type: AutomationType;
    status: AutomationStatus;
    schedule: string | null;
  }): Promise<void> {
    if (
      workflow.type === AutomationType.SCHEDULED &&
      workflow.status === AutomationStatus.ACTIVE &&
      workflow.schedule
    ) {
      await this.scheduler.schedule(workflow.tenantId, workflow.id, workflow.schedule);
      return;
    }
    await this.scheduler.unschedule(workflow.tenantId, workflow.id);
  }
}
