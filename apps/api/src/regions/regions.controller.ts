import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { RegionsService } from "./regions.service.js";

@ApiTags("countries-and-regions")
@Controller({ path: "regions", version: "1" })
export class RegionsController {
  constructor(@Inject(RegionsService) private readonly regions: RegionsService) {}
  @Get("countries") @RequirePermissions("tenant.read") countries(@Query() query: unknown) {
    return this.regions.countries(query as never);
  }
  @Post("countries") @RequirePermissions("tenant.manage") createCountry(@Body() body: unknown) {
    return this.regions.createCountry(body as never);
  }
  @Patch("countries/:id") @RequirePermissions("tenant.manage") updateCountry(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.regions.updateCountry(id, body as never);
  }
  @Get() @RequirePermissions("tenant.read") list(@Query() query: unknown) {
    return this.regions.list(query as never);
  }
  @Get(":id") @RequirePermissions("tenant.read") get(@Param("id") id: string) {
    return this.regions.get(id);
  }
  @Post() @RequirePermissions("tenant.manage") create(@Body() body: unknown) {
    return this.regions.create(body as never);
  }
  @Patch(":id") @RequirePermissions("tenant.manage") update(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.regions.update(id, body as never);
  }
  @Post(":id/status") @RequirePermissions("tenant.manage") status(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.regions.status(id, body as never);
  }
  @Post(":id/archive") @RequirePermissions("tenant.manage") archive(@Param("id") id: string) {
    return this.regions.archive(id);
  }
  @Post(":id/administrators") @RequirePermissions("tenant.manage", "staff.manage") assign(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.regions.assign(id, body as never);
  }
  @Delete(":id/administrators/:userId")
  @RequirePermissions("tenant.manage", "staff.manage")
  unassign(@Param("id") id: string, @Param("userId") userId: string) {
    return this.regions.unassign(id, userId);
  }
}
