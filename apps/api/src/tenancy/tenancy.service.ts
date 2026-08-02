import { Inject, Injectable } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  createMembershipSchema,
  createRoleSchema,
  createTenantSchema,
  setTenantSettingSchema,
  type CreateMembershipDto,
  type CreateRoleDto,
  type CreateTenantDto,
  type SetTenantSettingDto,
} from "./dto.js";
import { TenancyRepository } from "./tenancy.repository.js";

@Injectable()
export class TenancyService {
  constructor(@Inject(TenancyRepository) private readonly tenants: TenancyRepository) {}

  createTenant(input: CreateTenantDto) {
    return this.tenants.createTenant(parseDto(createTenantSchema, input));
  }

  currentTenant() {
    return this.tenants.findCurrentTenant();
  }

  createMembership(input: CreateMembershipDto) {
    return this.tenants.createMembership(parseDto(createMembershipSchema, input));
  }

  createRole(input: CreateRoleDto) {
    return this.tenants.createRole(parseDto(createRoleSchema, input));
  }

  setSetting(input: SetTenantSettingDto) {
    return this.tenants.setSetting(parseDto(setTenantSettingSchema, input));
  }
}
