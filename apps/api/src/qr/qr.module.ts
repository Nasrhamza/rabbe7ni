import { Module } from "@nestjs/common";

import { PointsModule } from "../points/points.module.js";
import { RewardsModule } from "../rewards/rewards.module.js";
import { QrController } from "./qr.controller.js";
import { QrRepository } from "./qr.repository.js";
import { QrService } from "./qr.service.js";
import { QrTokenService } from "./qr-token.service.js";

@Module({
  imports: [PointsModule, RewardsModule],
  controllers: [QrController],
  providers: [QrRepository, QrTokenService, QrService],
  exports: [QrTokenService, QrService],
})
export class QrModule {}
