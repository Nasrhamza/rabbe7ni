import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { BadgesService } from "./badges.service.js";

@ApiTags("badges")
@RequireEntitlement("gamification")
@Controller({ path: "badges", version: "1" })
export class BadgesController {
  constructor(@Inject(BadgesService) private readonly badges: BadgesService) {}
  @Get("categories")
  @RequirePermissions("badge.read")
  categories() {
    return this.badges.categories();
  }
  @Post("categories")
  @RequirePermissions("badge.manage")
  createCategory(@Body() body: unknown) {
    return this.badges.createCategory(body as never);
  }
  @Get()
  @RequirePermissions("badge.read")
  list(@Query() query: unknown) {
    return this.badges.list(query as never);
  }
  @Post()
  @RequirePermissions("badge.manage")
  create(@Body() body: unknown) {
    return this.badges.create(body as never);
  }
  @Patch(":id")
  @RequirePermissions("badge.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.badges.update(id, body as never);
  }
  @Post("achievement-rules")
  @RequirePermissions("badge.manage")
  createRule(@Body() body: unknown) {
    return this.badges.createRule(body as never);
  }
  @Post("award")
  @RequirePermissions("badge.award")
  award(@Body() body: unknown) {
    return this.badges.award(body as never);
  }
  @Post("awards/:id/revoke")
  @RequirePermissions("badge.revoke")
  revoke(@Param("id") id: string, @Body() body: unknown) {
    return this.badges.revoke(id, body as never);
  }
  @Get("collection/customer")
  collection(@Query() query: unknown) {
    return this.badges.collection(query as never);
  }
}
