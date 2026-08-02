import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  assignRegionAdminSchema,
  countryIdSchema,
  countryListSchema,
  createCountrySchema,
  createRegionSchema,
  regionIdSchema,
  regionListSchema,
  regionStatusSchema,
  updateCountrySchema,
  updateRegionSchema,
} from "./dto.js";
import { RegionsRepository } from "./regions.repository.js";

@Injectable()
export class RegionsService {
  constructor(@Inject(RegionsRepository) private readonly regions: RegionsRepository) {}
  countries(input: never) {
    return this.regions.listCountries(parseDto(countryListSchema, input));
  }
  createCountry(input: never) {
    return this.regions.createCountry(parseDto(createCountrySchema, input));
  }
  updateCountry(id: string, input: never) {
    return this.regions.updateCountry(
      parseDto(countryIdSchema, id),
      parseDto(updateCountrySchema, input),
    );
  }
  list(input: never) {
    return this.regions.listRegions(parseDto(regionListSchema, input));
  }
  async get(id: string) {
    const region = await this.regions.getRegion(parseDto(regionIdSchema, id));
    if (!region) throw new NotFoundException("Region not found");
    return region;
  }
  create(input: never) {
    return this.regions.createRegion(parseDto(createRegionSchema, input));
  }
  update(id: string, input: never) {
    return this.regions.updateRegion(
      parseDto(regionIdSchema, id),
      parseDto(updateRegionSchema, input),
    );
  }
  status(id: string, input: never) {
    return this.regions.setStatus(
      parseDto(regionIdSchema, id),
      parseDto(regionStatusSchema, input).status,
    );
  }
  archive(id: string) {
    return this.regions.archive(parseDto(regionIdSchema, id));
  }
  assign(id: string, input: never) {
    return this.regions.assignAdministrator(
      parseDto(regionIdSchema, id),
      parseDto(assignRegionAdminSchema, input).userId,
    );
  }
  unassign(id: string, userId: string) {
    return this.regions.unassignAdministrator(
      parseDto(regionIdSchema, id),
      parseDto(assignRegionAdminSchema.shape.userId, userId),
    );
  }
}
