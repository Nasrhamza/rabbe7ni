import { Module } from "@nestjs/common";

import { TenancyModule } from "../tenancy/tenancy.module.js";
import { CulturalProfileService } from "./cultural-profile.service.js";
import { RegionsController } from "./regions.controller.js";
import { RegionsRepository } from "./regions.repository.js";
import { RegionsService } from "./regions.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [RegionsController],
  providers: [RegionsRepository, RegionsService, CulturalProfileService],
  exports: [CulturalProfileService],
})
export class RegionsModule {}
