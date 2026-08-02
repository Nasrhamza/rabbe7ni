import { Module } from "@nestjs/common";

import { TenancyModule } from "../tenancy/tenancy.module.js";
import { StaffController } from "./staff.controller.js";
import { StaffRepository } from "./staff.repository.js";
import { StaffService } from "./staff.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [StaffController],
  providers: [StaffRepository, StaffService],
  exports: [StaffService],
})
export class StaffModule {}
