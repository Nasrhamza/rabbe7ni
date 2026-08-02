import { Module } from "@nestjs/common";

import { VisitsController } from "./visits.controller.js";
import { VisitsRepository } from "./visits.repository.js";
import { VisitsService } from "./visits.service.js";

@Module({
  controllers: [VisitsController],
  providers: [VisitsRepository, VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
