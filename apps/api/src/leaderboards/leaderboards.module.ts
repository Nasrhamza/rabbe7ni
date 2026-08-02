import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { LeaderboardsController } from "./leaderboards.controller.js";
import { LeaderboardsRepository } from "./leaderboards.repository.js";
import {
  LEADERBOARD_QUEUE,
  LeaderboardProcessor,
  LeaderboardScheduler,
} from "./leaderboards.scheduler.js";
import { LeaderboardsService } from "./leaderboards.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: LEADERBOARD_QUEUE })],
  controllers: [LeaderboardsController],
  providers: [
    LeaderboardsRepository,
    LeaderboardsService,
    LeaderboardScheduler,
    LeaderboardProcessor,
  ],
  exports: [LeaderboardsRepository, LeaderboardsService],
})
export class LeaderboardsModule {}
