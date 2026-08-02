import { Inject, Injectable } from "@nestjs/common";

import { AutomationsService } from "../automations/automations.service.js";
import { consumeMarketingEventSchema, type MarketingDomainEvent } from "../automations/dto.js";
import { parseDto } from "../common/validation.js";
import { MarketingEventsRepository } from "./marketing-events.repository.js";

@Injectable()
export class MarketingEventsService {
  constructor(
    @Inject(MarketingEventsRepository) private readonly events: MarketingEventsRepository,
    @Inject(AutomationsService) private readonly automations: AutomationsService,
  ) {}

  async process(raw: MarketingDomainEvent) {
    const event = parseDto(consumeMarketingEventSchema, raw);
    const started = await this.events.begin(event);
    if (started.duplicate) return { duplicate: true, executions: 0 };
    try {
      const result = await this.automations.consume(event as never);
      await this.events.complete(started.receipt.id);
      return { duplicate: false, ...result };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.events.fail(started.receipt.id, reason, started.receipt.attempts >= 8);
      throw error;
    }
  }
}
