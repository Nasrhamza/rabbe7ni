import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  createFranchiseSchema,
  franchiseIdSchema,
  franchiseListSchema,
  franchiseStatusSchema,
  updateFranchiseSchema,
  updateFranchiseSettingsSchema,
  type CreateFranchiseDto,
  type FranchiseListDto,
  type FranchiseStatusDto,
  type UpdateFranchiseDto,
  type UpdateFranchiseSettingsDto,
} from "./dto.js";
import { FranchisesRepository } from "./franchises.repository.js";

@Injectable()
export class FranchisesService {
  constructor(
    @Inject(FranchisesRepository)
    private readonly franchises: FranchisesRepository,
  ) {}

  async create(input: CreateFranchiseDto) {
    const franchise = await this.franchises.create(parseDto(createFranchiseSchema, input));
    if (!franchise) throw new NotFoundException("Organization not found or archived");
    return franchise;
  }

  list(input: FranchiseListDto = {}) {
    return this.franchises.list(parseDto(franchiseListSchema, input));
  }

  async get(id: string) {
    const franchise = await this.franchises.findById(parseDto(franchiseIdSchema, id));
    if (!franchise) throw new NotFoundException("Franchise not found");
    return franchise;
  }

  async update(id: string, input: UpdateFranchiseDto) {
    return this.require(
      await this.franchises.update(
        parseDto(franchiseIdSchema, id),
        parseDto(updateFranchiseSchema, input),
      ),
    );
  }

  async updateSettings(id: string, input: UpdateFranchiseSettingsDto) {
    return this.require(
      await this.franchises.updateSettings(
        parseDto(franchiseIdSchema, id),
        parseDto(updateFranchiseSettingsSchema, input),
      ),
    );
  }

  async changeStatus(id: string, input: FranchiseStatusDto) {
    const body = parseDto(franchiseStatusSchema, input);
    return this.require(
      await this.franchises.changeStatus(parseDto(franchiseIdSchema, id), body.status),
    );
  }

  async archive(id: string) {
    return this.require(await this.franchises.archive(parseDto(franchiseIdSchema, id)));
  }

  private require<T>(value: T | null): T {
    if (!value) throw new NotFoundException("Franchise not found");
    return value;
  }
}
