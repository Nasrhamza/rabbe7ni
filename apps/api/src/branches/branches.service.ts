import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  branchIdSchema,
  branchListSchema,
  branchStatusSchema,
  createBranchSchema,
  updateBranchSchema,
  type BranchListDto,
  type BranchStatusDto,
  type CreateBranchDto,
  type UpdateBranchDto,
} from "./dto.js";
import { BranchesRepository } from "./branches.repository.js";

@Injectable()
export class BranchesService {
  constructor(@Inject(BranchesRepository) private readonly branches: BranchesRepository) {}

  async create(input: CreateBranchDto) {
    return this.require(await this.branches.create(parseDto(createBranchSchema, input)));
  }

  list(input: BranchListDto = {}) {
    return this.branches.list(parseDto(branchListSchema, input));
  }

  async get(id: string) {
    return this.require(await this.branches.findById(parseDto(branchIdSchema, id)));
  }

  async update(id: string, input: UpdateBranchDto) {
    return this.require(
      await this.branches.update(parseDto(branchIdSchema, id), parseDto(updateBranchSchema, input)),
    );
  }

  async changeStatus(id: string, input: BranchStatusDto) {
    const body = parseDto(branchStatusSchema, input);
    return this.require(
      await this.branches.changeStatus(parseDto(branchIdSchema, id), body.status),
    );
  }

  async archive(id: string) {
    return this.require(await this.branches.archive(parseDto(branchIdSchema, id)));
  }

  private require<T>(value: T | null): T {
    if (!value) throw new NotFoundException("Branch not found or relation boundary is invalid");
    return value;
  }
}
