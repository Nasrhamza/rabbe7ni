import { Module } from "@nestjs/common";

import { BadgesModule } from "../badges/badges.module.js";
import { GamificationModule } from "../gamification/gamification.module.js";
import { PointsModule } from "../points/points.module.js";
import { HabitsController } from "./habits.controller.js";
import { HabitsRepository } from "./habits.repository.js";
import { HabitsService } from "./habits.service.js";

@Module({
  imports: [PointsModule, GamificationModule, BadgesModule],
  controllers: [HabitsController],
  providers: [HabitsRepository, HabitsService],
  exports: [HabitsRepository, HabitsService],
})
export class HabitsModule {}
