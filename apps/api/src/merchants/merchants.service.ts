import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  createMerchantSchema,
  merchantIdSchema,
  merchantListSchema,
  merchantStatusSchema,
  updateMerchantSchema,
  updateMerchantSettingsSchema,
  type CreateMerchantDto,
  type MerchantListDto,
  type MerchantStatusDto,
  type UpdateMerchantDto,
  type UpdateMerchantSettingsDto,
} from "./dto.js";
import { MerchantsRepository } from "./merchants.repository.js";

@Injectable()
export class MerchantsService {
  constructor(@Inject(MerchantsRepository) private readonly merchants: MerchantsRepository) {}

  async create(input: CreateMerchantDto) {
    const merchant = await this.merchants.create(parseDto(createMerchantSchema, input));
    if (!merchant) throw new NotFoundException("Organization or franchise boundary is invalid");
    return merchant;
  }

  list(input: MerchantListDto = {}) {
    return this.merchants.list(parseDto(merchantListSchema, input));
  }

  async get(id: string) {
    return this.require(await this.merchants.findById(parseDto(merchantIdSchema, id)));
  }

  async update(id: string, input: UpdateMerchantDto) {
    return this.require(
      await this.merchants.update(
        parseDto(merchantIdSchema, id),
        parseDto(updateMerchantSchema, input),
      ),
    );
  }

  async updateSettings(id: string, input: UpdateMerchantSettingsDto) {
    return this.require(
      await this.merchants.updateSettings(
        parseDto(merchantIdSchema, id),
        parseDto(updateMerchantSettingsSchema, input),
      ),
    );
  }

  async changeStatus(id: string, input: MerchantStatusDto) {
    const body = parseDto(merchantStatusSchema, input);
    return this.require(
      await this.merchants.changeStatus(parseDto(merchantIdSchema, id), body.status),
    );
  }

  async archive(id: string) {
    return this.require(await this.merchants.archive(parseDto(merchantIdSchema, id)));
  }

  private require<T>(value: T | null): T {
    if (!value) throw new NotFoundException("Merchant not found or relation boundary is invalid");
    return value;
  }
}
