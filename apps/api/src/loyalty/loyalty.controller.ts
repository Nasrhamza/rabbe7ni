import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { LoyaltyService } from "./loyalty.service.js";

@ApiTags("loyalty")
@Controller({ path: "loyalty-programs", version: "1" })
export class LoyaltyController {
  constructor(@Inject(LoyaltyService) private readonly loyalty: LoyaltyService) {}
  @Get()
  @RequirePermissions("loyalty.read")
  list(@Query() query: unknown) {
    return this.loyalty.list(query as never);
  }
  @Post()
  @RequirePermissions("loyalty.manage")
  create(@Body() body: unknown) {
    return this.loyalty.create(body as never);
  }
  @Get(":id")
  @RequirePermissions("loyalty.read")
  get(@Param("id") id: string) {
    return this.loyalty.get(id);
  }
  @Patch(":id")
  @RequirePermissions("loyalty.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.loyalty.update(id, body as never);
  }
  @Post(":id/status")
  @RequirePermissions("loyalty.manage")
  status(@Param("id") id: string, @Body() body: unknown) {
    return this.loyalty.status(id, body as never);
  }
  @Post(":id/archive")
  @RequirePermissions("loyalty.manage")
  archive(@Param("id") id: string) {
    return this.loyalty.archive(id);
  }
  @Post(":id/earning-rules")
  @RequirePermissions("loyalty.manage")
  createEarningRule(@Param("id") id: string, @Body() body: unknown) {
    return this.loyalty.createEarningRule(id, body as never);
  }
  @Patch(":id/earning-rules/:ruleId")
  @RequirePermissions("loyalty.manage")
  updateEarningRule(
    @Param("id") id: string,
    @Param("ruleId") ruleId: string,
    @Body() body: unknown,
  ) {
    return this.loyalty.updateEarningRule(id, ruleId, body as never);
  }
  @Post(":id/redemption-rules")
  @RequirePermissions("loyalty.manage")
  createRedemptionRule(@Param("id") id: string, @Body() body: unknown) {
    return this.loyalty.createRedemptionRule(id, body as never);
  }
  @Patch(":id/redemption-rules/:ruleId")
  @RequirePermissions("loyalty.manage")
  updateRedemptionRule(
    @Param("id") id: string,
    @Param("ruleId") ruleId: string,
    @Body() body: unknown,
  ) {
    return this.loyalty.updateRedemptionRule(id, ruleId, body as never);
  }
}
