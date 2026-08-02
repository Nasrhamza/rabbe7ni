import { Module } from "@nestjs/common";

import { GamificationController } from "./gamification.controller.js";
import { GamificationRepository } from "./gamification.repository.js";
import { GamificationService } from "./gamification.service.js";

@Module({
  controllers: [GamificationController],
  providers: [GamificationRepository, GamificationService],
  exports: [GamificationRepository, GamificationService],
})
export class GamificationModule {}
