import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CampaignMetricType, type CampaignStatus } from "@rabbehni/database";

import { parseDto } from "../common/validation.js";
import {
  campaignIdSchema,
  campaignListSchema,
  campaignMetricSchema,
  campaignScheduleSchema,
  createCampaignSchema,
  updateCampaignSchema,
} from "./dto.js";
import { CampaignsRepository } from "./campaigns.repository.js";
import { CampaignScheduler } from "./campaigns.scheduler.js";

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(CampaignsRepository) private readonly campaigns: CampaignsRepository,
    @Inject(CampaignScheduler) private readonly scheduler: CampaignScheduler,
  ) {}

  list(input: never = {} as never) {
    return this.campaigns.list(parseDto(campaignListSchema, input));
  }
  async get(id: string) {
    const result = await this.campaigns.get(parseDto(campaignIdSchema, id));
    if (!result) throw new NotFoundException("Campaign not found or outside scope");
    return result;
  }
  create(input: never) {
    return this.campaigns.create(parseDto(createCampaignSchema, input));
  }
  async update(id: string, input: never) {
    const result = await this.campaigns.update(
      parseDto(campaignIdSchema, id),
      parseDto(updateCampaignSchema, input),
    );
    if (!result) throw new NotFoundException("Campaign not found or outside scope");
    return result;
  }
  async duplicate(id: string) {
    const result = await this.campaigns.duplicate(parseDto(campaignIdSchema, id));
    if (!result) throw new NotFoundException("Campaign not found or outside scope");
    return result;
  }
  async transition(id: string, status: CampaignStatus) {
    const result = await this.campaigns.transition(parseDto(campaignIdSchema, id), status);
    if (!result) throw new NotFoundException("Campaign not found or outside scope");
    return result;
  }
  async schedule(id: string, input: never) {
    const dto = parseDto(campaignScheduleSchema, input);
    const campaign = await this.campaigns.schedule(
      parseDto(campaignIdSchema, id),
      dto.startsAt,
      dto.endsAt,
      dto.timezone,
    );
    if (!campaign) throw new NotFoundException("Campaign not found or outside scope");
    await this.scheduler.schedule(campaign.tenantId, campaign.id, dto.startsAt, dto.endsAt);
    return campaign;
  }
  async metrics(id: string) {
    const result = await this.campaigns.metrics(parseDto(campaignIdSchema, id));
    if (!result) throw new NotFoundException("Campaign not found or outside scope");
    return result;
  }
  recordMetric(id: string, input: never) {
    const dto = parseDto(campaignMetricSchema, input);
    return this.campaigns.recordMetric(
      parseDto(campaignIdSchema, id),
      CampaignMetricType[dto.type],
      dto.eventId,
      dto.customerId,
      dto.metadata,
    );
  }
}
