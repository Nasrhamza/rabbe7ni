import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AutomationStatus } from "@rabbehni/database";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { AutomationsService } from "./automations.service.js";

@ApiTags("automations")
@RequireEntitlement("marketing_automation")
@Controller({ path: "automations", version: "1" })
export class AutomationsController {
  constructor(@Inject(AutomationsService) private readonly automations: AutomationsService) {}

  @Get()
  @RequirePermissions("automation.read")
  list(@Query() query: unknown) {
    return this.automations.list(query as never);
  }
  @Get(":id")
  @RequirePermissions("automation.read")
  get(@Param("id") id: string) {
    return this.automations.get(id);
  }
  @Post()
  @RequirePermissions("automation.manage")
  create(@Body() body: unknown) {
    return this.automations.create(body as never);
  }
  @Patch(":id")
  @RequirePermissions("automation.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.automations.update(id, body as never);
  }
  @Post(":id/activate")
  @RequirePermissions("automation.manage")
  activate(@Param("id") id: string) {
    return this.automations.status(id, AutomationStatus.ACTIVE);
  }
  @Post(":id/pause")
  @RequirePermissions("automation.manage")
  pause(@Param("id") id: string) {
    return this.automations.status(id, AutomationStatus.PAUSED);
  }
  @Post(":id/resume")
  @RequirePermissions("automation.manage")
  resume(@Param("id") id: string) {
    return this.automations.status(id, AutomationStatus.ACTIVE);
  }
  @Post(":id/cancel")
  @RequirePermissions("automation.manage")
  cancel(@Param("id") id: string) {
    return this.automations.status(id, AutomationStatus.CANCELLED);
  }
  @Post("events")
  @RequirePermissions("automation.process")
  event(@Body() body: unknown) {
    return this.automations.consume(body as never);
  }
}
