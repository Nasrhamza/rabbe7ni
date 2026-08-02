import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { ChallengesService } from "./challenges.service.js";

@ApiTags("challenges")
@RequireEntitlement("gamification")
@Controller({ path: "challenges", version: "1" })
export class ChallengesController {
  constructor(@Inject(ChallengesService) private readonly challenges: ChallengesService) {}
  @Get()
  @RequirePermissions("challenge.read")
  list(@Query() query: unknown) {
    return this.challenges.list(query as never);
  }
  @Get(":id")
  @RequirePermissions("challenge.read")
  detail(@Param("id") id: string) {
    return this.challenges.detail(id);
  }
  @Post()
  @RequirePermissions("challenge.manage")
  create(@Body() body: unknown) {
    return this.challenges.create(body as never);
  }
  @Patch(":id")
  @RequirePermissions("challenge.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.challenges.update(id, body as never);
  }
  @Post(":id/scopes")
  @RequirePermissions("challenge.manage")
  addScope(@Param("id") id: string, @Body() body: unknown) {
    return this.challenges.addScope(id, body as never);
  }
  @Post(":id/rewards")
  @RequirePermissions("challenge.manage")
  addReward(@Param("id") id: string, @Body() body: unknown) {
    return this.challenges.addReward(id, body as never);
  }
  @Post(":id/enroll")
  enroll(@Param("id") id: string, @Body() body: unknown) {
    return this.challenges.enroll(id, body as never);
  }
  @Post(":id/progress")
  @RequirePermissions("challenge.process")
  progress(@Param("id") id: string, @Body() body: unknown) {
    return this.challenges.progress(id, body as never);
  }
  @Post("enrollments/:id/validate")
  @RequirePermissions("challenge.validate")
  validate(@Param("id") id: string, @Body() body: unknown) {
    return this.challenges.validate(id, body as never);
  }
  @Post("enrollments/:id/cancel")
  @RequirePermissions("challenge.manage")
  cancel(@Param("id") id: string) {
    return this.challenges.cancelEnrollment(id);
  }
  @Post("maintenance/expire")
  @RequirePermissions("challenge.process")
  expire() {
    return this.challenges.expireDue();
  }
}
