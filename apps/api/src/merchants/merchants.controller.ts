import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { MerchantsService } from "./merchants.service.js";

@ApiTags("merchants")
@Controller({ path: "merchants", version: "1" })
export class MerchantsController {
  constructor(@Inject(MerchantsService) private readonly merchants: MerchantsService) {}

  @Get()
  @RequirePermissions("merchant.read")
  list(@Query() query: unknown) {
    return this.merchants.list(query as never);
  }

  @Post()
  @RequirePermissions("merchant.manage")
  create(@Body() body: unknown) {
    return this.merchants.create(body as never);
  }

  @Get(":id")
  @RequirePermissions("merchant.read")
  get(@Param("id") id: string) {
    return this.merchants.get(id);
  }

  @Patch(":id")
  @RequirePermissions("merchant.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.merchants.update(id, body as never);
  }

  @Patch(":id/settings")
  @RequirePermissions("merchant.manage")
  updateSettings(@Param("id") id: string, @Body() body: unknown) {
    return this.merchants.updateSettings(id, body as never);
  }

  @Post(":id/status")
  @RequirePermissions("merchant.manage")
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.merchants.changeStatus(id, body as never);
  }

  @Post(":id/archive")
  @RequirePermissions("merchant.manage")
  archive(@Param("id") id: string) {
    return this.merchants.archive(id);
  }
}
