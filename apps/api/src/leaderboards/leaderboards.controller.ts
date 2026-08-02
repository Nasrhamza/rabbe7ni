import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { LeaderboardsService } from "./leaderboards.service.js";

@ApiTags("leaderboards")
@RequireEntitlement("gamification")
@Controller({ path: "leaderboards", version: "1" })
export class LeaderboardsController {
  constructor(@Inject(LeaderboardsService) private readonly leaderboards: LeaderboardsService) {}
  @Get()
  @RequirePermissions("leaderboard.read")
  list(@Query() query: unknown) {
    return this.leaderboards.list(query as never);
  }
  @Get("public")
  publicConfigs() {
    return this.leaderboards.publicConfigs();
  }
  @Post()
  @RequirePermissions("leaderboard.manage")
  create(@Body() body: unknown) {
    return this.leaderboards.create(body as never);
  }
  @Patch(":id")
  @RequirePermissions("leaderboard.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.leaderboards.update(id, body as never);
  }
  @Post(":id/snapshots")
  @RequirePermissions("leaderboard.process")
  generate(@Param("id") id: string, @Body() body: unknown) {
    return this.leaderboards.generate(id, body as never);
  }
  @Get(":id/results")
  results(@Param("id") id: string, @Query() query: unknown) {
    return this.leaderboards.results(id, query as never);
  }
}
