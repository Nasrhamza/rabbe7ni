import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { OrganizationsService } from "./organizations.service.js";

@ApiTags("organizations")
@Controller({ path: "organizations", version: "1" })
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "List tenant organizations" })
  list(@Query() query: unknown) {
    return this.organizations.list(query as never);
  }

  @Post()
  @RequirePermissions("tenant.manage", "organization.manage")
  @ApiOperation({ summary: "Create an organization owned by the authenticated tenant" })
  create(@Body() body: unknown) {
    return this.organizations.create(body as never);
  }

  @Get(":id")
  @RequirePermissions("organization.read")
  get(@Param("id") id: string) {
    return this.organizations.get(id);
  }

  @Patch(":id")
  @RequirePermissions("organization.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.organizations.update(id, body as never);
  }

  @Patch(":id/settings")
  @RequirePermissions("organization.manage")
  updateSettings(@Param("id") id: string, @Body() body: unknown) {
    return this.organizations.updateSettings(id, body as never);
  }

  @Post(":id/status")
  @RequirePermissions("organization.manage")
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.organizations.changeStatus(id, body as never);
  }

  @Post(":id/archive")
  @RequirePermissions("organization.manage")
  archive(@Param("id") id: string) {
    return this.organizations.archive(id);
  }
}
