import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsRepository } from "./campaigns.repository.js";
import {
  CAMPAIGN_QUEUE,
  CampaignScheduler,
  CampaignStartProcessor,
} from "./campaigns.scheduler.js";
import { CampaignsService } from "./campaigns.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: CAMPAIGN_QUEUE })],
  controllers: [CampaignsController],
  providers: [CampaignsRepository, CampaignsService, CampaignScheduler, CampaignStartProcessor],
  exports: [CampaignsRepository, CampaignsService],
})
export class CampaignsModule {}
