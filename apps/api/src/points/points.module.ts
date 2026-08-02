import { Module } from "@nestjs/common";

import { PointsController } from "./points.controller.js";
import { PointsRepository } from "./points.repository.js";
import { PointsService } from "./points.service.js";

@Module({
  controllers: [PointsController],
  providers: [PointsRepository, PointsService],
  exports: [PointsRepository, PointsService],
})
export class PointsModule {}
