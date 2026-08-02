import { Module } from "@nestjs/common";

import { PointsModule } from "../points/points.module.js";
import { RewardsModule } from "../rewards/rewards.module.js";
import { GamesController } from "./games.controller.js";
import { GamesRepository } from "./games.repository.js";
import { GamesService } from "./games.service.js";

@Module({
  imports: [PointsModule, RewardsModule],
  controllers: [GamesController],
  providers: [GamesRepository, GamesService],
})
export class GamesModule {}
