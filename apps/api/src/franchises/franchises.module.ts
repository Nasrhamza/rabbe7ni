import { Module } from "@nestjs/common";

import { TenancyModule } from "../tenancy/tenancy.module.js";
import { FranchisesController } from "./franchises.controller.js";
import { FranchisesRepository } from "./franchises.repository.js";
import { FranchisesService } from "./franchises.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [FranchisesController],
  providers: [FranchisesRepository, FranchisesService],
  exports: [FranchisesService],
})
export class FranchisesModule {}
