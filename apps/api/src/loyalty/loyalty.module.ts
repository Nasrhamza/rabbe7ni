import { Module } from "@nestjs/common";

import { LoyaltyController } from "./loyalty.controller.js";
import { LoyaltyRepository } from "./loyalty.repository.js";
import { LoyaltyService } from "./loyalty.service.js";

@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyRepository, LoyaltyService],
  exports: [LoyaltyRepository, LoyaltyService],
})
export class LoyaltyModule {}
