import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { HabitsService } from "./habits.service.js";

@ApiTags("habits")
@RequireEntitlement("smart_habits")
@Controller({ path: "habits", version: "1" })
export class HabitsController {
  constructor(@Inject(HabitsService) private readonly habits: HabitsService) {}
  @Get()
  @RequirePermissions("habit.read")
  list(@Query() query: unknown) {
    return this.habits.list(query as never);
  }
  @Get(":id")
  @RequirePermissions("habit.read")
  detail(@Param("id") id: string) {
    return this.habits.detail(id);
  }
  @Post()
  @RequirePermissions("habit.manage")
  create(@Body() body: unknown) {
    return this.habits.create(body as never);
  }
  @Patch(":id")
  @RequirePermissions("habit.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.habits.update(id, body as never);
  }
  @Post(":id/enroll")
  enroll(@Param("id") id: string, @Body() body: unknown) {
    return this.habits.enroll(id, body as never);
  }
  @Post(":id/progress")
  progress(@Param("id") id: string, @Body() body: unknown) {
    return this.habits.progress(id, body as never);
  }
  @Get("customer/calendar")
  calendar(@Query() query: unknown) {
    return this.habits.calendar(query as never);
  }
  @Get("streaks/rules")
  @RequirePermissions("streak.read")
  streakRules() {
    return this.habits.streakRules();
  }
  @Post("streaks/rules")
  @RequirePermissions("streak.manage")
  createStreakRule(@Body() body: unknown) {
    return this.habits.createStreakRule(body as never);
  }
  @Post("streaks/rules/:id/qualify")
  @RequirePermissions("streak.process")
  qualifyStreak(@Param("id") id: string, @Body() body: unknown) {
    return this.habits.qualifyStreak(id, body as never);
  }
  @Get("streaks/customer/:id")
  customerStreaks(@Param("id") id: string) {
    return this.habits.customerStreaks(id);
  }
}
