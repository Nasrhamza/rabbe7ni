import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { consumeMarketingEventSchema } from "../automations/dto.js";
import { RequirePermissions } from "../common/security.js";
import { parseDto } from "../common/validation.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { MarketingEventsQueue } from "./marketing-events.queue.js";

@ApiTags("marketing-events")
@Controller({ path: "marketing-events", version: "1" })
export class MarketingEventsController {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(MarketingEventsQueue) private readonly queue: MarketingEventsQueue,
  ) {}

  @Post()
  @RequirePermissions("automation.process")
  async consume(@Body() body: unknown) {
    const event = parseDto(consumeMarketingEventSchema, body);
    await this.queue.enqueue(this.context.tenantId(), event);
    return { accepted: true, eventId: event.eventId };
  }
}
