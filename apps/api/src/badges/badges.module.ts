import { Module } from "@nestjs/common";

import { BadgesController } from "./badges.controller.js";
import { BadgesRepository } from "./badges.repository.js";
import { BadgesService } from "./badges.service.js";

@Module({
  controllers: [BadgesController],
  providers: [BadgesRepository, BadgesService],
  exports: [BadgesRepository, BadgesService],
})
export class BadgesModule {}
