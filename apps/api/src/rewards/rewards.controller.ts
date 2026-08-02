import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { RewardsService } from "./rewards.service.js";

@ApiTags("rewards")
@Controller({ path: "rewards", version: "1" })
export class RewardsController {
  constructor(@Inject(RewardsService) private readonly rewards: RewardsService) {}
  @Get("categories")
  @RequirePermissions("reward.read")
  categories(@Query("organizationId") organizationId?: string) {
    return this.rewards.listCategories(organizationId);
  }
  @Post("categories")
  @RequirePermissions("reward.manage")
  createCategory(@Body() body: unknown) {
    return this.rewards.createCategory(body as never);
  }
  @Get("redemptions")
  @RequirePermissions("reward.read")
  redemptions(@Query() query: unknown) {
    return this.rewards.listRedemptions(query as never);
  }
  @Post("redemptions")
  @RequirePermissions("reward.redeem")
  redeem(@Body() body: unknown) {
    return this.rewards.redeem(body as never);
  }
  @Post("redemptions/:id/cancel")
  @RequirePermissions("reward.redeem")
  cancel(@Param("id") id: string, @Body() body: unknown) {
    return this.rewards.cancel(id, body as never);
  }
  @Post("redemptions/:id/reverse")
  @RequirePermissions("reward.redeem")
  reverse(@Param("id") id: string, @Body() body: unknown) {
    return this.rewards.reverse(id, body as never);
  }
  @Get()
  @RequirePermissions("reward.read")
  list(@Query() query: unknown) {
    return this.rewards.list(query as never);
  }
  @Post()
  @RequirePermissions("reward.manage")
  create(@Body() body: unknown) {
    return this.rewards.create(body as never);
  }
  @Get(":id")
  @RequirePermissions("reward.read")
  get(@Param("id") id: string) {
    return this.rewards.get(id);
  }
  @Patch(":id")
  @RequirePermissions("reward.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.rewards.update(id, body as never);
  }
  @Post(":id/status")
  @RequirePermissions("reward.manage")
  status(@Param("id") id: string, @Body() body: unknown) {
    return this.rewards.status(id, body as never);
  }
  @Post(":id/stock")
  @RequirePermissions("reward.manage")
  stock(@Param("id") id: string, @Body() body: unknown) {
    return this.rewards.stock(id, body as never);
  }
  @Post(":id/archive")
  @RequirePermissions("reward.manage")
  archive(@Param("id") id: string) {
    return this.rewards.archive(id);
  }
}
