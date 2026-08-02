import { Module } from "@nestjs/common";

import { RewardsController } from "./rewards.controller.js";
import { RewardsRepository } from "./rewards.repository.js";
import { RewardsService } from "./rewards.service.js";

@Module({
  controllers: [RewardsController],
  providers: [RewardsRepository, RewardsService],
  exports: [RewardsRepository, RewardsService],
})
export class RewardsModule {}
