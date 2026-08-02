import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import { manualVisitSchema, reverseVisitSchema, visitListSchema } from "./dto.js";
import { VisitsRepository } from "./visits.repository.js";

@Injectable()
export class VisitsService {
  constructor(@Inject(VisitsRepository) private readonly visits: VisitsRepository) {}

  list(input: unknown) {
    return this.visits.list(parseDto(visitListSchema, input));
  }
  async createManual(input: unknown) {
    return this.require(await this.visits.createManual(parseDto(manualVisitSchema, input)));
  }
  createFromQr(input: Parameters<VisitsRepository["createFromQr"]>[0]) {
    return this.visits.createFromQr(input);
  }
  async reverse(id: string, input: unknown) {
    return this.require(await this.visits.reverse(id, parseDto(reverseVisitSchema, input)));
  }
  private require<T>(value: T | null): T {
    if (!value)
      throw new NotFoundException("Visit or related entity not found in the authorized scope");
    return value;
  }
}
