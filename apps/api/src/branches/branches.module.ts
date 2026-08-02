import { Module } from "@nestjs/common";

import { TenancyModule } from "../tenancy/tenancy.module.js";
import { BranchesController } from "./branches.controller.js";
import { BranchesRepository } from "./branches.repository.js";
import { BranchesService } from "./branches.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [BranchesController],
  providers: [BranchesRepository, BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
