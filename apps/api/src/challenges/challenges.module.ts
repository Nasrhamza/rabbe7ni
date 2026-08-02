import { Module } from "@nestjs/common";

import { BadgesModule } from "../badges/badges.module.js";
import { GamificationModule } from "../gamification/gamification.module.js";
import { PointsModule } from "../points/points.module.js";
import { ChallengesController } from "./challenges.controller.js";
import { ChallengesRepository } from "./challenges.repository.js";
import { ChallengesService } from "./challenges.service.js";

@Module({
  imports: [PointsModule, GamificationModule, BadgesModule],
  controllers: [ChallengesController],
  providers: [ChallengesRepository, ChallengesService],
  exports: [ChallengesRepository, ChallengesService],
})
export class ChallengesModule {}
