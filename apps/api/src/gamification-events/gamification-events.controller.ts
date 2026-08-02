import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { parseDto } from "../common/validation.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { consumeGamificationEventSchema } from "./dto.js";
import { GamificationEventQueue } from "./gamification-events.queue.js";
import { GamificationEventsService } from "./gamification-events.service.js";

@ApiTags("gamification-events")
@Controller({ path: "gamification-events", version: "1" })
export class GamificationEventsController {
  constructor(
    @Inject(GamificationEventsService)
    private readonly events: GamificationEventsService,
    @Inject(GamificationEventQueue) private readonly queue: GamificationEventQueue,
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
  ) {}

  @Post("consume")
  @RequirePermissions("gamification.process")
  consume(@Body() body: unknown) {
    return this.events.consume(body as never);
  }

  @Post("enqueue")
  @RequirePermissions("gamification.process")
  enqueue(@Body() body: unknown) {
    const event = parseDto(consumeGamificationEventSchema, body);
    return this.queue.enqueue(this.context.tenantId(), event);
  }
}
