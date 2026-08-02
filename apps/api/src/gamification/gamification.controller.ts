import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { GamificationService } from "./gamification.service.js";

@ApiTags("gamification")
@RequireEntitlement("gamification")
@Controller({ path: "gamification", version: "1" })
export class GamificationController {
  constructor(@Inject(GamificationService) private readonly gamification: GamificationService) {}

  @Get("config")
  @RequirePermissions("gamification.read")
  config() {
    return this.gamification.config();
  }
  @Patch("config")
  @RequirePermissions("gamification.manage")
  updateConfig(@Body() body: unknown) {
    return this.gamification.updateConfig(body as never);
  }
  @Get("xp-rules")
  @RequirePermissions("gamification.read")
  rules() {
    return this.gamification.rules();
  }
  @Post("xp-rules")
  @RequirePermissions("gamification.manage")
  createRule(@Body() body: unknown) {
    return this.gamification.createRule(body as never);
  }
  @Patch("xp-rules/:id")
  @RequirePermissions("gamification.manage")
  updateRule(@Param("id") id: string, @Body() body: unknown) {
    return this.gamification.updateRule(id, body as never);
  }
  @Get("levels")
  levels() {
    return this.gamification.levels();
  }
  @Post("levels")
  @RequirePermissions("gamification.manage")
  createLevel(@Body() body: unknown) {
    return this.gamification.createLevel(body as never);
  }
  @Patch("levels/:id")
  @RequirePermissions("gamification.manage")
  updateLevel(@Param("id") id: string, @Body() body: unknown) {
    return this.gamification.updateLevel(id, body as never);
  }
  @Post("xp/award")
  @RequirePermissions("gamification.process")
  award(@Body() body: unknown) {
    return this.gamification.award(body as never);
  }
  @Post("xp/adjust")
  @RequirePermissions("gamification.adjust")
  adjust(@Body() body: unknown) {
    return this.gamification.adjust(body as never);
  }
  @Post("xp/:id/reverse")
  @RequirePermissions("gamification.adjust")
  reverse(@Param("id") id: string, @Body() body: unknown) {
    return this.gamification.reverse(id, body as never);
  }
  @Get("xp/transactions")
  @RequirePermissions("gamification.read")
  transactions(@Query() query: unknown) {
    return this.gamification.transactions(query as never);
  }
  @Get("profile")
  profile(@Query() query: unknown) {
    return this.gamification.profile(query as never);
  }
  @Patch("profile/privacy")
  privacy(@Body() body: unknown) {
    return this.gamification.privacy(body as never);
  }
}
