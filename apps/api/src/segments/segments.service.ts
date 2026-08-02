import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MarketingStatus, SegmentType } from "@rabbehni/database";

import { parseDto } from "../common/validation.js";
import {
  createSegmentSchema,
  idSchema,
  segmentListSchema,
  segmentPreviewSchema,
  staticMembershipSchema,
  updateSegmentSchema,
} from "./dto.js";
import { SegmentsRepository } from "./segments.repository.js";
import { SegmentScheduler } from "./segments.scheduler.js";

@Injectable()
export class SegmentsService {
  constructor(
    @Inject(SegmentsRepository) private readonly segments: SegmentsRepository,
    @Inject(SegmentScheduler) private readonly scheduler: SegmentScheduler,
  ) {}

  list(input: never = {} as never) {
    return this.segments.list(parseDto(segmentListSchema, input));
  }
  async get(id: string) {
    const result = await this.segments.get(parseDto(idSchema, id));
    if (!result) throw new NotFoundException("Segment not found or outside scope");
    return result;
  }
  async create(input: never) {
    const segment = await this.segments.create(parseDto(createSegmentSchema, input));
    await this.syncSchedule(segment);
    return segment;
  }
  async update(id: string, input: never) {
    const result = await this.segments.update(
      parseDto(idSchema, id),
      parseDto(updateSegmentSchema, input),
    );
    if (!result) throw new NotFoundException("Segment not found or outside scope");
    await this.syncSchedule(result);
    return result;
  }
  preview(input: never) {
    const dto = parseDto(segmentPreviewSchema, input);
    return this.segments.preview(dto.organizationId, dto.rules, dto.limit);
  }
  async refresh(id: string) {
    const result = await this.segments.refresh(parseDto(idSchema, id));
    if (!result) throw new NotFoundException("Segment not found or outside scope");
    return result;
  }
  async replaceMembers(id: string, input: never) {
    const dto = parseDto(staticMembershipSchema, input);
    const result = await this.segments.replaceStaticMembers(
      parseDto(idSchema, id),
      dto.customerIds,
    );
    if (!result) throw new NotFoundException("Segment not found or outside scope");
    return result;
  }

  private async syncSchedule(segment: {
    id: string;
    tenantId: string;
    type: SegmentType;
    status: MarketingStatus;
    schedule: string | null;
  }): Promise<void> {
    if (
      segment.type === SegmentType.DYNAMIC &&
      segment.status === MarketingStatus.ACTIVE &&
      segment.schedule
    ) {
      await this.scheduler.schedule(segment.tenantId, segment.id, segment.schedule);
      return;
    }
    await this.scheduler.unschedule(segment.tenantId, segment.id);
  }
}
