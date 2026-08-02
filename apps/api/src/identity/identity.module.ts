import { Module } from "@nestjs/common";

import { IdentityRepository } from "./identity.repository.js";
import { IdentityService } from "./identity.service.js";

@Module({
  providers: [IdentityRepository, IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
