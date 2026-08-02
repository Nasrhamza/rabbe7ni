import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  createOrganizationSchema,
  organizationIdSchema,
  organizationListSchema,
  organizationStatusSchema,
  updateOrganizationSchema,
  updateOrganizationSettingsSchema,
  type CreateOrganizationDto,
  type OrganizationListDto,
  type OrganizationStatusDto,
  type UpdateOrganizationDto,
  type UpdateOrganizationSettingsDto,
} from "./dto.js";
import { OrganizationsRepository } from "./organizations.repository.js";

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsRepository)
    private readonly organizations: OrganizationsRepository,
  ) {}

  create(input: CreateOrganizationDto) {
    return this.organizations.create(parseDto(createOrganizationSchema, input));
  }

  list(input: OrganizationListDto) {
    return this.organizations.list(parseDto(organizationListSchema, input));
  }

  async get(id: string) {
    const organization = await this.organizations.findById(parseDto(organizationIdSchema, id));
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  async update(id: string, input: UpdateOrganizationDto) {
    const organization = await this.organizations.update(
      parseDto(organizationIdSchema, id),
      parseDto(updateOrganizationSchema, input),
    );
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  async updateSettings(id: string, input: UpdateOrganizationSettingsDto) {
    const organization = await this.organizations.updateSettings(
      parseDto(organizationIdSchema, id),
      parseDto(updateOrganizationSettingsSchema, input),
    );
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  async changeStatus(id: string, input: OrganizationStatusDto) {
    const body = parseDto(organizationStatusSchema, input);
    const organization = await this.organizations.changeStatus(
      parseDto(organizationIdSchema, id),
      body.status,
    );
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  async archive(id: string) {
    const organization = await this.organizations.archive(parseDto(organizationIdSchema, id));
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  current() {
    return this.organizations.list(parseDto(organizationListSchema, { pageSize: 1 }));
  }
}
