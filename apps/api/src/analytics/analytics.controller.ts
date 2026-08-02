import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { AnalyticsService } from "./analytics.service.js";
import { AnalyticsAiQueue } from "./analytics-ai.queue.js";

@ApiTags("analytics")
@RequireEntitlement("advanced_analytics")
@Controller({ path: "analytics", version: "1" })
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(AnalyticsAiQueue) private readonly aiQueue: AnalyticsAiQueue,
  ) {}

  @Get("dashboard")
  @RequirePermissions("analytics.read")
  dashboard(@Query() query: unknown) {
    return this.analytics.dashboard(query as never);
  }

  @Get("quality")
  @RequirePermissions("analytics.read")
  quality() {
    return this.analytics.quality();
  }

  @Get("customer-summary")
  customerSummary() {
    return this.analytics.customerSummary();
  }

  @Post("customer-recommendation")
  customerRecommendation() {
    return this.analytics.customerRecommendation();
  }

  @Post("refresh")
  @RequirePermissions("analytics.manage")
  refresh(@Body() body: unknown) {
    return this.analytics.refresh(body as never);
  }

  @Post("insights")
  @RequirePermissions("ai.request")
  insight(@Body() body: unknown) {
    return this.analytics.insight(body as never);
  }

  @Post("insights/async")
  @RequirePermissions("ai.request")
  asyncInsight(@Body() body: unknown) {
    return this.aiQueue.enqueue(body);
  }
}
