import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { TenancyService } from "./tenancy.service.js";

@ApiTags("tenancy")
@Controller({ path: "tenancy", version: "1" })
export class TenancyController {
  constructor(@Inject(TenancyService) private readonly tenancy: TenancyService) {}

  @Get("current")
  @RequirePermissions("tenant.read")
  current() {
    return this.tenancy.currentTenant();
  }

  @Post("settings")
  @RequirePermissions("tenant.manage")
  setting(@Body() body: unknown) {
    return this.tenancy.setSetting(body as never);
  }
}
