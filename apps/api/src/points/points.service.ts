import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PointsEntryType } from "@rabbehni/database";

import { parseDto } from "../common/validation.js";
import {
  adjustPointsSchema,
  balanceQuerySchema,
  consumePointsSchema,
  earnPointsSchema,
  pointsEntryIdSchema,
  pointsListSchema,
  reversePointsSchema,
} from "./dto.js";
import { PointsRepository, type PointsOperation } from "./points.repository.js";

@Injectable()
export class PointsService {
  constructor(@Inject(PointsRepository) private readonly points: PointsRepository) {}
  earn(input: never) {
    const dto = parseDto(earnPointsSchema, input);
    return this.points.post({ ...dto, type: PointsEntryType.EARN, points: dto.points });
  }
  expire(input: never) {
    const dto = parseDto(consumePointsSchema, input);
    return this.points.post({ ...dto, type: PointsEntryType.EXPIRE, points: -dto.points });
  }
  adjust(input: never) {
    const dto = parseDto(adjustPointsSchema, input);
    return this.points.post({
      ...dto,
      type: PointsEntryType.ADJUST,
      metadata: { ...dto.metadata, reason: dto.reason },
    });
  }
  postOperation(input: PointsOperation) {
    return this.points.post(input);
  }
  async reverse(id: string, input: never) {
    const dto = parseDto(reversePointsSchema, input);
    const result = await this.points.reverse(
      parseDto(pointsEntryIdSchema, id),
      dto.idempotencyKey,
      dto.reason,
    );
    if (!result) throw new NotFoundException("Points entry not found or outside scope");
    return result;
  }
  async balance(input: never) {
    const dto = parseDto(balanceQuerySchema, input);
    const result = await this.points.balance(dto.customerId, dto.programId);
    if (!result) throw new NotFoundException("Customer not found or outside scope");
    return result;
  }
  list(input: never = {} as never) {
    return this.points.list(parseDto(pointsListSchema, input));
  }
}
