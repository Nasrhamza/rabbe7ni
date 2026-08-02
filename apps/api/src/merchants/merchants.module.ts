import { Module } from "@nestjs/common";

import { TenancyModule } from "../tenancy/tenancy.module.js";
import { MerchantsController } from "./merchants.controller.js";
import { MerchantsRepository } from "./merchants.repository.js";
import { MerchantsService } from "./merchants.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [MerchantsController],
  providers: [MerchantsRepository, MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
