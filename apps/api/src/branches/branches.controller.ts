import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { BranchesService } from "./branches.service.js";

@ApiTags("branches")
@Controller({ path: "branches", version: "1" })
export class BranchesController {
  constructor(@Inject(BranchesService) private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions("branch.read")
  list(@Query() query: unknown) {
    return this.branches.list(query as never);
  }

  @Post()
  @RequirePermissions("branch.manage")
  create(@Body() body: unknown) {
    return this.branches.create(body as never);
  }

  @Get(":id")
  @RequirePermissions("branch.read")
  get(@Param("id") id: string) {
    return this.branches.get(id);
  }

  @Patch(":id")
  @RequirePermissions("branch.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.branches.update(id, body as never);
  }

  @Post(":id/status")
  @RequirePermissions("branch.manage")
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.branches.changeStatus(id, body as never);
  }

  @Post(":id/archive")
  @RequirePermissions("branch.manage")
  archive(@Param("id") id: string) {
    return this.branches.archive(id);
  }
}
