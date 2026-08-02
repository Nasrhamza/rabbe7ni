import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  generateLeaderboardSchema,
  leaderboardConfigSchema,
  leaderboardIdSchema,
  leaderboardListSchema,
  leaderboardResultsSchema,
  updateLeaderboardConfigSchema,
} from "./dto.js";
import { LeaderboardsRepository } from "./leaderboards.repository.js";
import { LeaderboardScheduler } from "./leaderboards.scheduler.js";

@Injectable()
export class LeaderboardsService {
  constructor(
    @Inject(LeaderboardsRepository)
    private readonly leaderboards: LeaderboardsRepository,
    @Inject(LeaderboardScheduler) private readonly scheduler: LeaderboardScheduler,
  ) {}
  async create(input: never) {
    const config = await this.leaderboards.create(parseDto(leaderboardConfigSchema, input));
    await this.scheduler.schedule(config.tenantId, config.id, config.schedule);
    return config;
  }
  list(input: never = {} as never) {
    return this.leaderboards.list(parseDto(leaderboardListSchema, input));
  }
  publicConfigs() {
    return this.leaderboards.publicConfigs();
  }
  async update(id: string, input: never) {
    const config = await this.leaderboards.update(
      parseDto(leaderboardIdSchema, id),
      parseDto(updateLeaderboardConfigSchema, input),
    );
    if (!config) throw new NotFoundException("Leaderboard config not found");
    await this.scheduler.schedule(config.tenantId, config.id, config.schedule);
    return config;
  }
  async generate(id: string, input: never) {
    const dto = parseDto(generateLeaderboardSchema, input);
    const result = await this.leaderboards.snapshot(parseDto(leaderboardIdSchema, id), dto.at);
    if (!result) throw new NotFoundException("Active leaderboard config not found");
    return result;
  }
  async results(id: string, input: never) {
    const result = await this.leaderboards.results(
      parseDto(leaderboardIdSchema, id),
      parseDto(leaderboardResultsSchema, input),
    );
    if (!result) throw new NotFoundException("Leaderboard config not found");
    return result;
  }
}
