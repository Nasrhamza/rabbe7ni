import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { FranchisesService } from "./franchises.service.js";

@ApiTags("franchises")
@Controller({ path: "franchises", version: "1" })
export class FranchisesController {
  constructor(@Inject(FranchisesService) private readonly franchises: FranchisesService) {}

  @Get()
  @RequirePermissions("franchise.read")
  list(@Query() query: unknown) {
    return this.franchises.list(query as never);
  }

  @Post()
  @RequirePermissions("franchise.manage")
  create(@Body() body: unknown) {
    return this.franchises.create(body as never);
  }

  @Get(":id")
  @RequirePermissions("franchise.read")
  get(@Param("id") id: string) {
    return this.franchises.get(id);
  }

  @Patch(":id")
  @RequirePermissions("franchise.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.franchises.update(id, body as never);
  }

  @Patch(":id/settings")
  @RequirePermissions("franchise.manage")
  updateSettings(@Param("id") id: string, @Body() body: unknown) {
    return this.franchises.updateSettings(id, body as never);
  }

  @Post(":id/status")
  @RequirePermissions("franchise.manage")
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.franchises.changeStatus(id, body as never);
  }

  @Post(":id/archive")
  @RequirePermissions("franchise.manage")
  archive(@Param("id") id: string) {
    return this.franchises.archive(id);
  }
}
