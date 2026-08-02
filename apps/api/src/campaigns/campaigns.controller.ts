import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CampaignStatus } from "@rabbehni/database";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { CampaignsService } from "./campaigns.service.js";

@ApiTags("campaigns")
@RequireEntitlement("marketing_automation")
@Controller({ path: "campaigns", version: "1" })
export class CampaignsController {
  constructor(@Inject(CampaignsService) private readonly campaigns: CampaignsService) {}

  @Get()
  @RequirePermissions("campaign.read")
  list(@Query() query: unknown) {
    return this.campaigns.list(query as never);
  }
  @Get(":id")
  @RequirePermissions("campaign.read")
  get(@Param("id") id: string) {
    return this.campaigns.get(id);
  }
  @Post()
  @RequirePermissions("campaign.manage")
  create(@Body() body: unknown) {
    return this.campaigns.create(body as never);
  }
  @Patch(":id")
  @RequirePermissions("campaign.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.campaigns.update(id, body as never);
  }
  @Post(":id/duplicate")
  @RequirePermissions("campaign.manage")
  duplicate(@Param("id") id: string) {
    return this.campaigns.duplicate(id);
  }
  @Post(":id/review")
  @RequirePermissions("campaign.manage")
  review(@Param("id") id: string) {
    return this.campaigns.transition(id, CampaignStatus.REVIEW);
  }
  @Post(":id/approve")
  @RequirePermissions("campaign.approve")
  approve(@Param("id") id: string) {
    return this.campaigns.transition(id, CampaignStatus.APPROVED);
  }
  @Post(":id/schedule")
  @RequirePermissions("campaign.manage")
  schedule(@Param("id") id: string, @Body() body: unknown) {
    return this.campaigns.schedule(id, body as never);
  }
  @Post(":id/pause")
  @RequirePermissions("campaign.manage")
  pause(@Param("id") id: string) {
    return this.campaigns.transition(id, CampaignStatus.PAUSED);
  }
  @Post(":id/resume")
  @RequirePermissions("campaign.manage")
  resume(@Param("id") id: string) {
    return this.campaigns.transition(id, CampaignStatus.RUNNING);
  }
  @Post(":id/cancel")
  @RequirePermissions("campaign.manage")
  cancel(@Param("id") id: string) {
    return this.campaigns.transition(id, CampaignStatus.CANCELLED);
  }
  @Post(":id/archive")
  @RequirePermissions("campaign.manage")
  archive(@Param("id") id: string) {
    return this.campaigns.transition(id, CampaignStatus.ARCHIVED);
  }
  @Get(":id/metrics")
  @RequirePermissions("campaign.read")
  metrics(@Param("id") id: string) {
    return this.campaigns.metrics(id);
  }
  @Post(":id/metrics")
  @RequirePermissions("campaign.process")
  metric(@Param("id") id: string, @Body() body: unknown) {
    return this.campaigns.recordMetric(id, body as never);
  }
}
